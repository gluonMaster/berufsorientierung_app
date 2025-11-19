/**
 * API Endpoint: POST /api/auth/reset-password
 *
 * Сброс пароля по токену из email
 *
 * Процесс сброса пароля:
 * 1. Валидация входных данных (token, new_password, new_password_confirm)
 * 2. Хеширование токена (SHA-256) и поиск пользователя по хешу в БД
 * 3. Проверка срока действия токена
 * 4. Хеширование нового пароля через bcrypt
 * 5. Обновление пароля в БД
 * 6. Очистка токена сброса (обнуление полей)
 * 7. Логирование действия в activity_log
 * 8. Возврат успешного ответа
 *
 * @returns 200 OK с { success: true } при успехе
 * @throws 400 Bad Request при невалидных данных
 * @throws 401 Unauthorized при невалидном/просроченном токене
 * @throws 500 Internal Server Error при ошибке сервера
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { passwordResetSchema } from '$lib/server/validation/schemas';
import { getUserById, clearPasswordResetToken } from '$lib/server/db/users';
import { hashPassword } from '$lib/server/auth';
import { hashPasswordResetToken } from '$lib/server/auth/passwordResetToken';
import { getDB } from '$lib/server/db';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { verifyCsrf } from '$lib/server/middleware/csrf';
import { verifyTurnstile, extractTurnstileToken } from '$lib/server/middleware/turnstile';
import { getClientIP } from '$lib/server/middleware/auth';
import { logActivity } from '$lib/server/db/activityLog';

/**
 * POST /api/auth/reset-password
 * Сброс пароля по токену
 */
export async function POST(event: RequestEvent) {
	try {
		// Шаг 0: Проверяем CSRF токен для защиты от атак
		try {
			await verifyCsrf(event);
		} catch (error) {
			console.error('[Reset Password] CSRF verification failed:', error);
			throw errors.forbidden('Invalid CSRF token');
		}

		const { request, platform } = event;

		// Получаем доступ к БД через getDB()
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
			console.error('[Reset Password] Turnstile verification failed:', error);
			throw errors.forbidden(
				error instanceof Error ? error.message : 'Turnstile verification failed'
			);
		}

		// Шаг 2: Валидируем данные через Zod схему
		const validationResult = passwordResetSchema.safeParse(requestData);

		if (!validationResult.success) {
			// Форматируем ошибки валидации
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const { token, new_password } = validationResult.data;

		// Шаг 3: Хешируем токен и ищем пользователя по хешу в БД
		const tokenHash = await hashPasswordResetToken(token);

		// Эффективный запрос - прямой поиск по хешу токена
		const foundUser = await DB.prepare(
			`SELECT id, password_reset_expires_at 
			FROM users 
			WHERE password_reset_token_hash = ?
			  AND password_reset_expires_at IS NOT NULL
			LIMIT 1`
		)
			.bind(tokenHash)
			.first<{ id: number; password_reset_expires_at: string }>();

		// Если пользователь не найден - токен невалиден
		if (!foundUser) {
			console.log('[Reset Password] Invalid token provided');
			throw errors.unauthorized('Invalid or expired token');
		}

		// Шаг 4: Проверяем срок действия токена
		const expiresAt = new Date(foundUser.password_reset_expires_at);
		const now = new Date();

		if (expiresAt <= now) {
			console.log(`[Reset Password] Expired token for user ${foundUser.id}`);
			throw errors.unauthorized('Invalid or expired token');
		}

		// Шаг 5: Получаем полные данные пользователя
		const user = await getUserById(DB, foundUser.id);

		if (!user) {
			console.error(`[Reset Password] User ${foundUser.id} not found after token validation`);
			throw errors.internal('User not found');
		}

		// Проверяем, не заблокирован ли пользователь
		if (user.is_blocked) {
			console.log(`[Reset Password] Blocked user ${user.id} attempted password reset`);
			throw errors.forbidden('Account is blocked');
		}

		// Шаг 6: Хешируем новый пароль
		const newPasswordHash = await hashPassword(new_password);

		// Шаг 7: Обновляем пароль в БД
		const updateResult = await DB.prepare(
			`UPDATE users 
			SET password_hash = ?, 
			    updated_at = datetime('now')
			WHERE id = ?`
		)
			.bind(newPasswordHash, user.id)
			.run();

		if (!updateResult.success) {
			console.error(`[Reset Password] Failed to update password for user ${user.id}`);
			throw errors.internal('Failed to update password');
		}

		// Шаг 8: Очищаем токен сброса пароля
		try {
			await clearPasswordResetToken(DB, user.id);
		} catch (error) {
			console.error(`[Reset Password] Failed to clear token for user ${user.id}:`, error);
			// Не критично, продолжаем
		}

		// Шаг 9: Логируем действие в activity_log
		try {
			await logActivity(
				DB,
				user.id,
				'password_reset',
				JSON.stringify({
					email: user.email,
					timestamp: new Date().toISOString(),
				}),
				ipAddress || undefined
			);
		} catch (error) {
			console.error(`[Reset Password] Failed to log activity for user ${user.id}:`, error);
			// Не критично, продолжаем
		}

		console.log(`[Reset Password] Password successfully reset for user ${user.id}`);

		// Шаг 10: Возвращаем успешный ответ
		return json({ success: true }, { status: 200 });
	} catch (error) {
		// Централизованная обработка всех ошибок
		return handleApiError(error);
	}
}
