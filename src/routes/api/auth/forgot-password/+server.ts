/**
 * API Endpoint: POST /api/auth/forgot-password
 *
 * Запрос на восстановление пароля
 *
 * Процесс восстановления:
 * 1. Валидация входных данных (email)
 * 2. Поиск пользователя по email
 * 3. Генерация криптографически стойкого токена
 * 4. Хеширование токена (SHA-256)
 * 5. Сохранение хеша и времени истечения в БД
 * 6. Отправка email с ссылкой для сброса
 * 7. Возврат общего ответа (независимо от существования email)
 *
 * ⚠️ ВАЖНО: Endpoint всегда возвращает 200 с success: true,
 * даже если email не найден (защита от enumeration атак)
 *
 * @returns 200 OK с { success: true } в любом случае
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { forgotPasswordRequestSchema } from '$lib/server/validation/schemas';
import { getUserByEmail, setPasswordResetToken } from '$lib/server/db/users';
import { getDB } from '$lib/server/db';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { verifyCsrf } from '$lib/server/middleware/csrf';
import { verifyTurnstile, extractTurnstileToken } from '$lib/server/middleware/turnstile';
import { getClientIP } from '$lib/server/middleware/auth';
import { sendEmail, sendEmailSafely } from '$lib/server/email';
import { getPasswordResetEmail } from '$lib/server/email/templates';
import type { LanguageCode } from '$lib/types/common';
import {
	generatePasswordResetToken,
	hashPasswordResetToken,
} from '$lib/server/auth/passwordResetToken';

/**
 * POST /api/auth/forgot-password
 * Запрос на восстановление пароля
 */
export async function POST(event: RequestEvent) {
	try {
		// Шаг 0: Проверяем CSRF токен для защиты от атак
		try {
			await verifyCsrf(event);
		} catch (error) {
			console.error('[Forgot Password] CSRF verification failed:', error);
			throw errors.forbidden('Invalid CSRF token');
		}

		const { request, platform } = event;

		// Получаем доступ к БД и окружению через getDB()
		const DB = getDB(platform);

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
			if (!platform?.env) {
				throw new Error('Platform environment not available');
			}
			await verifyTurnstile(platform.env, turnstileToken, ipAddress || undefined);
		} catch (error) {
			console.error('[Forgot Password] Turnstile verification failed:', error);
			throw errors.forbidden(
				error instanceof Error ? error.message : 'Turnstile verification failed'
			);
		}

		// Шаг 2: Валидируем данные через Zod схему
		const validationResult = forgotPasswordRequestSchema.safeParse(requestData);

		if (!validationResult.success) {
			// Форматируем ошибки валидации
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const { email } = validationResult.data;

		// Шаг 3: Ищем пользователя по email
		const user = await getUserByEmail(DB, email);

		// ⚠️ ВАЖНО: Если пользователь не найден или заблокирован,
		// всё равно возвращаем успешный ответ (защита от enumeration)
		if (!user || user.is_blocked) {
			// Логируем попытку восстановления для несуществующего/заблокированного email
			console.log(
				`[Forgot Password] Attempt for ${user ? 'blocked' : 'non-existent'} email: ${email}`
			);

			// Возвращаем общий успешный ответ
			return json({ success: true }, { status: 200 });
		}

		// Шаг 4: Генерируем криптографически стойкий токен (32 байта = 43 символа base64url)
		const rawToken = generatePasswordResetToken(32);

		// Шаг 5: Хешируем токен для хранения в БД (SHA-256)
		const tokenHash = await hashPasswordResetToken(rawToken);

		// Шаг 6: Вычисляем время истечения (1 час от текущего времени)
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1 час
		const expiresAtISO = expiresAt.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS

		// Шаг 7: Сохраняем хеш токена и время истечения в БД
		try {
			await setPasswordResetToken(DB, user.id, tokenHash, expiresAtISO);
			console.log(`[Forgot Password] Token saved for user ${user.id}`);
		} catch (error) {
			console.error('[Forgot Password] Failed to save token:', error);
			// Не раскрываем внутренние ошибки пользователю
			return json({ success: true }, { status: 200 });
		}

		// Шаг 8: Формируем ссылку для сброса пароля
		// Используем APP_BASE_URL если есть, иначе origin из request.url
		const baseUrl = (platform?.env as any).APP_BASE_URL ?? new URL(request.url).origin;
		const resetLink = `${baseUrl}/reset-password/${encodeURIComponent(rawToken)}`;

		// Шаг 9: Определяем язык пользователя (или de по умолчанию)
		const language = (user.preferred_language as LanguageCode) || 'de';

		// Шаг 10: Отправляем email с ссылкой для сброса
		// Используем sendEmailSafely чтобы не блокировать ответ при ошибке email
		await sendEmailSafely(async () => {
			if (!platform?.env) {
				throw new Error('Platform env not available');
			}

			// Получаем email шаблон
			const emailContent = getPasswordResetEmail(user, language, resetLink);

			// Отправляем email
			await sendEmail(user.email, emailContent.subject, emailContent.text, platform.env);
		}, 'Password reset email');

		// Шаг 11: Возвращаем общий успешный ответ
		// ⚠️ ВАЖНО: Не раскрываем, существует ли email в системе
		return json({ success: true }, { status: 200 });
	} catch (error) {
		// Централизованная обработка всех ошибок
		return handleApiError(error);
	}
}
