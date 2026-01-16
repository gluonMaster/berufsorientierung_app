/**
 * API Endpoint: POST /api/auth/login
 *
 * Аутентификация пользователя (вход в систему)
 *
 * Процесс входа:
 * 1. Валидация входных данных (Zod schema)
 * 2. Поиск пользователя по email
 * 3. Проверка пароля
 * 4. Проверка блокировки аккаунта
 * 5. Проверка запланированного удаления
 * 6. Логирование входа
 * 7. Генерация JWT токена
 * 8. Установка auth cookie
 *
 * @returns 200 OK с токеном в cookie и профилем пользователя
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { userLoginSchema } from '$lib/validation/schemas';
import { verifyPassword, generateToken, setAuthCookie } from '$lib/server/auth';
import { getUserByEmail } from '$lib/server/db/users';
import { isAdmin } from '$lib/server/db/admin';
import { logActivity } from '$lib/server/db/activityLog';
import { getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { verifyCsrf } from '$lib/server/middleware/csrf';
import { verifyTurnstile, extractTurnstileToken } from '$lib/server/middleware/turnstile';
import { getDB } from '$lib/server/db';
import { dev } from '$app/environment';
import type { UserProfile } from '$lib/types/user';

/**
 * POST /api/auth/login
 * Вход в систему
 */
export async function POST(event: RequestEvent) {
	try {
		// Шаг 0: Проверяем CSRF токен для защиты от атак
		try {
			await verifyCsrf(event);
		} catch (error) {
			console.error('[Login] CSRF verification failed:', error);
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
			console.error('[Login] Turnstile verification failed:', error);
			throw errors.forbidden(
				error instanceof Error ? error.message : 'Turnstile verification failed'
			);
		}

		// Шаг 2: Валидируем данные через Zod схему
		const validationResult = userLoginSchema.safeParse(requestData);

		if (!validationResult.success) {
			// Форматируем ошибки валидации
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const { email, password } = validationResult.data;

		// Шаг 3: Ищем пользователя по email
		const user = await getUserByEmail(DB, email);

		if (!user) {
			// Логируем попытку входа с несуществующим email (для статистики)
			const clientIP = getClientIP(request);
			try {
				await logActivity(
					DB,
					null, // user_id = null, так как пользователь не найден
					'user_login_failed',
					JSON.stringify({ reason: 'invalid_email', email }),
					clientIP || undefined
				);
			} catch (logError) {
				// Логирование не критично
				console.error('[Login] Failed to log invalid email attempt:', logError);
			}

			// НЕ раскрываем, что именно неверно (email или пароль) - это security best practice
			throw errors.unauthorized('Invalid email or password');
		}

		// Шаг 4: Проверяем пароль
		const isPasswordValid = await verifyPassword(password, user.password_hash);

		if (!isPasswordValid) {
			// Логируем неудачную попытку входа
			const clientIP = getClientIP(request);
			try {
				await logActivity(
					DB,
					user.id,
					'user_login_failed',
					JSON.stringify({ reason: 'invalid_password' }),
					clientIP || undefined
				);
			} catch (logError) {
				// Логирование не критично
				console.error('[Login] Failed to log failed login attempt:', logError);
			}

			throw errors.unauthorized('Invalid email or password');
		}

		// Шаг 5: Проверяем, не заблокирован ли пользователь
		if (user.is_blocked) {
			// Логируем попытку входа заблокированного пользователя
			const clientIP = getClientIP(request);
			try {
				await logActivity(
					DB,
					user.id,
					'user_login_failed',
					JSON.stringify({ reason: 'account_blocked' }),
					clientIP || undefined
				);
			} catch (logError) {
				console.error('[Login] Failed to log blocked login attempt:', logError);
			}

			throw errors.forbidden('Account is blocked. Please contact support.');
		}

		// Шаг 6: Проверяем, не запланировано ли удаление аккаунта
		const pendingDeletionResult = await DB.prepare(
			'SELECT id FROM pending_deletions WHERE user_id = ? LIMIT 1'
		)
			.bind(user.id)
			.first<{ id: number }>();

		if (pendingDeletionResult) {
			// Логируем попытку входа для аккаунта, запланированного к удалению
			const clientIP = getClientIP(request);
			try {
				await logActivity(
					DB,
					user.id,
					'user_login_failed',
					JSON.stringify({ reason: 'account_scheduled_for_deletion' }),
					clientIP || undefined
				);
			} catch (logError) {
				console.error('[Login] Failed to log scheduled deletion login attempt:', logError);
			}

			throw errors.forbidden('Account is scheduled for deletion. Please contact support.');
		}

		// Шаг 7: Логируем успешный вход
		const clientIP = getClientIP(request);
		try {
			await logActivity(
				DB,
				user.id,
				'user_login',
				JSON.stringify({ email: user.email }),
				clientIP || undefined
			);
		} catch (logError) {
			// Логирование не критично, но предупреждаем
			console.error('[Login] Failed to log successful login:', logError);
		}

		// Шаг 8: Генерируем JWT токен
		let authToken: string;
		try {
			authToken = await generateToken(user.id, user.email, JWT_SECRET);
		} catch (error) {
			console.error('[Login] Token generation failed:', error);
			throw errors.internal('Failed to generate authentication token');
		}

		// Шаг 9: Проверяем является ли пользователь админом
		const userIsAdmin = await isAdmin(DB, user.id);

		// Шаг 10: Создаём профиль пользователя для ответа (без пароля, но с isAdmin)
		const userProfile: UserProfile & { isAdmin: boolean } = {
			id: user.id,
			email: user.email,
			first_name: user.first_name,
			last_name: user.last_name,
			birth_date: user.birth_date,
			address_street: user.address_street,
			address_number: user.address_number,
			address_zip: user.address_zip,
			address_city: user.address_city,
			phone: user.phone,
			whatsapp: user.whatsapp,
			telegram: user.telegram,
			photo_video_consent: user.photo_video_consent,
			parental_consent: user.parental_consent,
			preferred_language: user.preferred_language,
			guardian_first_name: user.guardian_first_name,
			guardian_last_name: user.guardian_last_name,
			guardian_phone: user.guardian_phone,
			guardian_consent: user.guardian_consent,
			is_blocked: user.is_blocked,
			created_at: user.created_at,
			updated_at: user.updated_at,
			isAdmin: userIsAdmin,
		};

		// Шаг 11: Возвращаем успешный ответ с установкой cookie
		// В production используем Secure cookie, в dev - нет (для локального HTTP)
		const cookieValue = setAuthCookie(authToken, !dev);

		return json(
			{
				user: userProfile,
				message: 'Login successful',
			},
			{
				status: 200,
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
