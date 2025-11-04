/**
 * API Endpoint: POST /api/auth/register
 *
 * Регистрация нового пользователя с полной валидацией и GDPR compliance
 *
 * Процесс регистрации:
 * 1. Валидация входных данных (Zod schema)
 * 2. Проверка возраста и согласия родителей (если < 18 лет)
 * 3. Проверка уникальности email
 * 4. Хеширование пароля (bcrypt)
 * 5. Создание пользователя в БД
 * 6. Логирование действия
 * 7. Отправка welcome email (не блокирует регистрацию при ошибке)
 * 8. Генерация JWT токена
 * 9. Установка auth cookie
 *
 * @returns 201 Created с токеном в cookie
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { userRegistrationSchema } from '$lib/validation/schemas';
import { hashPassword, generateToken, setAuthCookie } from '$lib/server/auth';
import { createUser, getUserByEmail } from '$lib/server/db/users';
import { logActivity } from '$lib/server/db/activityLog';
import { getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { verifyCsrf } from '$lib/server/middleware/csrf';
import { verifyTurnstile, extractTurnstileToken } from '$lib/server/middleware/turnstile';
import { getDB } from '$lib/server/db';
import { dev } from '$app/environment';
import type { UserProfile } from '$lib/types/user';
import type { LanguageCode } from '$lib/types';
import { sendEmailSafely, sendEmail } from '$lib/server/email';
import { getWelcomeEmail } from '$lib/server/email/templates';

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
export async function POST(event: RequestEvent) {
	try {
		// Шаг 0: Проверяем CSRF токен для защиты от атак
		try {
			await verifyCsrf(event);
		} catch (error) {
			console.error('[Register] CSRF verification failed:', error);
			throw errors.forbidden('Invalid CSRF token');
		}

		const { request, platform } = event;

		// Получаем доступ к БД и окружению через getDB()
		const DB = getDB(platform);

		if (!platform?.env?.JWT_SECRET) {
			throw errors.internal('JWT secret not configured');
		}

		const JWT_SECRET = platform.env.JWT_SECRET;

		// Шаг 1: Парсим тело запроса
		let requestData: unknown;
		try {
			requestData = await request.json();
		} catch (error) {
			throw errors.badRequest('Invalid JSON in request body');
		}

		// Шаг 1.5: Верифицируем Turnstile токен для защиты от ботов
		const turnstileToken = extractTurnstileToken(requestData as Record<string, unknown>);
		const ipAddress = getClientIP(request);

		try {
			await verifyTurnstile(platform?.env, turnstileToken, ipAddress || undefined);
		} catch (error) {
			console.error('[Register] Turnstile verification failed:', error);
			throw errors.forbidden(
				error instanceof Error ? error.message : 'Turnstile verification failed'
			);
		}

		// Шаг 2: Валидируем данные через Zod схему
		const validationResult = userRegistrationSchema.safeParse(requestData);

		if (!validationResult.success) {
			// Форматируем ошибки валидации
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			// 400 Bad Request для ошибок валидации (согласно промпту)
			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const data = validationResult.data;

		// Шаг 3: Устанавливаем язык по умолчанию если не указан
		const preferredLanguage = data.preferred_language ?? 'de';

		// Шаг 4: Проверяем возраст и согласие родителей
		// Эта проверка уже включена в Zod схему, но для ясности можно добавить явную проверку
		const birthDate = new Date(data.birth_date);
		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
			age--;
		}

		if (age < 18 && !data.parental_consent) {
			// 400 Bad Request для ошибок валидации (согласно промпту)
			throw errors.badRequest('Parental consent is required for users under 18', {
				field: 'parental_consent',
				age,
			});
		}

		// Шаг 5: Проверяем уникальность email
		const existingUser = await getUserByEmail(DB, data.email);
		if (existingUser) {
			throw errors.conflict('Email already registered', { field: 'email' });
		}

		// Шаг 6: Хешируем пароль
		let passwordHash: string;
		try {
			passwordHash = await hashPassword(data.password);
		} catch (error) {
			console.error('[Register] Password hashing failed:', error);
			throw errors.internal('Failed to process password');
		}

		// Шаг 7: Создаём пользователя в БД
		let newUser;
		try {
			newUser = await createUser(DB, {
				email: data.email,
				password_hash: passwordHash,
				first_name: data.first_name,
				last_name: data.last_name,
				birth_date: data.birth_date,
				address_street: data.address_street,
				address_number: data.address_number,
				address_zip: data.address_zip,
				address_city: data.address_city,
				phone: data.phone,
				whatsapp: data.whatsapp || undefined,
				telegram: data.telegram || undefined,
				photo_video_consent: data.photo_video_consent,
				parental_consent: data.parental_consent,
				preferred_language: preferredLanguage,
			});
		} catch (error) {
			console.error('[Register] User creation failed:', error);
			throw errors.internal('Failed to create user account');
		}

		// Шаг 8: Логируем действие регистрации
		const clientIP = getClientIP(request);
		try {
			const logDetails = JSON.stringify({
				email: data.email,
				language: preferredLanguage,
				age,
				parental_consent_required: age < 18,
			});

			await logActivity(DB, newUser.id, 'user_register', logDetails, clientIP || undefined);
		} catch (error) {
			// Логирование не критично, просто записываем в консоль
			console.error('[Register] Activity logging failed:', error);
		}

		// Шаг 9: Отправка welcome email (не блокирует регистрацию при ошибке)
		await sendEmailSafely(async () => {
			const emailData = getWelcomeEmail(newUser, preferredLanguage as LanguageCode);

			await sendEmail(newUser.email, emailData.subject, emailData.text, platform!.env);
		}, `Welcome email to ${newUser.email} after registration`);

		// Шаг 10: Генерируем JWT токен
		let authToken: string;
		try {
			authToken = await generateToken(newUser.id, newUser.email, JWT_SECRET);
		} catch (error) {
			console.error('[Register] Token generation failed:', error);
			throw errors.internal('Failed to generate authentication token');
		}

		// Шаг 11: Создаём профиль пользователя для ответа (без пароля)
		const userProfile: UserProfile = {
			id: newUser.id,
			email: newUser.email,
			first_name: newUser.first_name,
			last_name: newUser.last_name,
			birth_date: newUser.birth_date,
			address_street: newUser.address_street,
			address_number: newUser.address_number,
			address_zip: newUser.address_zip,
			address_city: newUser.address_city,
			phone: newUser.phone,
			whatsapp: newUser.whatsapp,
			telegram: newUser.telegram,
			photo_video_consent: newUser.photo_video_consent,
			parental_consent: newUser.parental_consent,
			preferred_language: newUser.preferred_language,
			is_blocked: newUser.is_blocked,
			created_at: newUser.created_at,
			updated_at: newUser.updated_at,
		};

		// Шаг 12: Возвращаем успешный ответ с установкой cookie
		// В production используем Secure cookie, в dev - нет (для локального HTTP)
		const cookieValue = setAuthCookie(authToken, !dev);

		return json(
			{
				user: userProfile,
				message: 'Registration successful',
			},
			{
				status: 201,
				headers: {
					'Set-Cookie': cookieValue,
				},
			}
		);
	} catch (error) {
		// Централизованная обработка всех ошибок
		return handleApiError(error);
	}
}
