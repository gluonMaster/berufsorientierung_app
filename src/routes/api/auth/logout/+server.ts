/**
 * API Endpoint: POST /api/auth/logout
 *
 * Выход из системы (logout)
 *
 * Процесс выхода:
 * 1. Попытка получить текущего пользователя (необязательно)
 * 2. Логирование выхода (если пользователь авторизован)
 * 3. Удаление auth cookie (clearAuthCookie)
 * 4. Возврат успешного ответа
 *
 * ВАЖНО: Endpoint НЕ требует авторизации - можно вызвать в любой момент.
 * Если пользователь не авторизован, просто очищаем cookie (безопасный logout).
 *
 * @returns 200 OK с удалённым токеном в cookie
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { clearAuthCookie } from '$lib/server/auth';
import { getUserFromRequest, getClientIP } from '$lib/server/middleware/auth';
import { logActivity } from '$lib/server/db/activityLog';
import { handleApiError } from '$lib/server/middleware/errorHandler';
import { getDB } from '$lib/server/db';
import { dev } from '$app/environment';

/**
 * POST /api/auth/logout
 * Выход из системы
 */
export async function POST({ request, platform }: RequestEvent) {
	try {
		// Получаем доступ к БД
		const DB = getDB(platform);

		const JWT_SECRET = platform?.env?.JWT_SECRET || '';

		// Шаг 1: Пытаемся получить текущего пользователя (необязательно)
		let user = null;
		if (JWT_SECRET) {
			try {
				user = await getUserFromRequest(request, DB, JWT_SECRET);
			} catch (error) {
				// Игнорируем ошибки - пользователь может быть не авторизован
				// Это нормально для logout
				console.log('[Logout] User not found or token invalid (this is OK for logout)');
			}
		}

		// Шаг 2: Если пользователь авторизован, логируем выход
		if (user) {
			const clientIP = getClientIP(request);
			try {
				await logActivity(
					DB,
					user.id,
					'user_logout',
					JSON.stringify({ email: user.email }),
					clientIP || undefined
				);
			} catch (logError) {
				// Логирование не критично
				console.error('[Logout] Failed to log logout activity:', logError);
			}
		}

		// Шаг 3: Удаляем auth cookie
		// В production используем Secure cookie, в dev - нет (для локального HTTP)
		const cookieValue = clearAuthCookie(!dev);

		// Шаг 4: Возвращаем успешный ответ
		return json(
			{
				success: true,
				message: 'Logout successful',
			},
			{
				status: 200,
				headers: {
					'Set-Cookie': cookieValue,
				},
			}
		);
	} catch (error) {
		// Централизованная обработка ошибок
		// Даже при ошибке возвращаем успех и очищаем cookie
		console.error('[Logout] Error during logout:', error);

		const cookieValue = clearAuthCookie(!dev);

		return json(
			{
				success: true,
				message: 'Logout completed (with errors)',
			},
			{
				status: 200,
				headers: {
					'Set-Cookie': cookieValue,
				},
			}
		);
	}
}
