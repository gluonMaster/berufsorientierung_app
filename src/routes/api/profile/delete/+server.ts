/**
 * API Endpoint: POST /api/profile/delete
 * Удаление профиля пользователя с соблюдением GDPR
 *
 * Логика:
 * 1. Проверка авторизации (requireAuth)
 * 2. Логирование информации о пользователе (ДО удаления)
 * 3. Полное удаление пользователя (DB.gdpr.deleteUserCompletely)
 * 4. Очистка auth cookie
 * 5. Возврат: { deleted: true, immediate: true }
 *
 * ВАЖНО: Удаление всегда немедленное. Архив данных сохраняется
 * в deleted_users_archive через deleteUserCompletely.
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { DB } from '$lib/server/db';
import { clearAuthCookie } from '$lib/server/auth';

/**
 * POST /api/profile/delete
 *
 * Удаляет профиль текущего авторизованного пользователя
 *
 * Request body: пустой (пользователь определяется по auth токену)
 *
 * Response:
 * - 200: { deleted: true, immediate: true }
 * - 401: { error: 'Unauthorized' }
 * - 500: { error: 'Server error' }
 *
 * @example Немедленное удаление
 * ```
 * POST /api/profile/delete
 * → 200 { deleted: true, immediate: true }
 * ```
 */
export const POST = async ({ request, platform }: RequestEvent) => {
	try {
		// Проверка окружения
		if (!platform?.env?.DB || !platform?.env?.JWT_SECRET) {
			console.error('[DELETE Profile] Missing environment variables');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		const db = platform.env.DB;
		const jwtSecret = platform.env.JWT_SECRET;

		// Шаг 1: Проверка авторизации
		let user;
		try {
			user = await requireAuth(request, db, jwtSecret);
		} catch (error: any) {
			return json(
				{ error: error.message || 'Unauthorized' },
				{ status: error.status || 401 }
			);
		}

		// Получаем IP адрес для логирования
		const ipAddress = getClientIP(request);

		try {
			// Шаг 2: Проверяем, посещал ли пользователь мероприятия
			// (есть хотя бы одна запись на прошедшее мероприятие, cancelled_at IS NULL)
			// Note: e.date is stored as datetime-local format (YYYY-MM-DDTHH:MM), need to normalize 'T' separator
			const attendedResult = await db
				.prepare(
					`SELECT COUNT(*) as cnt
					 FROM registrations r
					 JOIN events e ON r.event_id = e.id
					 WHERE r.user_id = ?
					   AND r.cancelled_at IS NULL
					   AND datetime(replace(e.date, 'T', ' ')) <= datetime('now')`
				)
				.bind(user.id)
				.first<{ cnt: number }>();

			const attendedAny = (attendedResult?.cnt ?? 0) > 0;

			// Шаг 3: Логируем информацию ДО удаления (пока данные еще есть)
			await DB.activityLog.logActivity(
				db,
				null, // user_id = null, т.к. пользователь будет удален
				'profile_deleted_immediate',
				JSON.stringify({
					deleted_user_id: user.id,
					first_name: user.first_name || null,
					last_name: user.last_name || null,
					email: user.email,
					phone: user.phone || null,
					attendedAny,
				}),
				ipAddress || undefined
			);

			// Шаг 4: Полное удаление пользователя (включая архивацию)
			await DB.gdpr.deleteUserCompletely(db, user.id);

			console.log(`[DELETE Profile] User ${user.id} (${user.email}) deleted immediately`);

			// Возвращаем ответ с заголовком для очистки cookie
			return json(
				{
					deleted: true,
					immediate: true,
				},
				{
					status: 200,
					headers: {
						// Очищаем auth cookie (secure зависит от окружения: false для dev HTTP, true для production HTTPS)
						'Set-Cookie': clearAuthCookie(!dev),
					},
				}
			);
		} catch (error) {
			console.error('[DELETE Profile] Error during immediate deletion:', error);

			// Логируем ошибку
			await DB.activityLog.logActivity(
				db,
				user.id,
				'profile_deletion_failed',
				JSON.stringify({
					reason: 'immediate_deletion_error',
					error: error instanceof Error ? error.message : 'Unknown error',
				}),
				ipAddress || undefined
			);

			return json({ error: 'Failed to delete profile' }, { status: 500 });
		}
	} catch (error) {
		// Общий обработчик непредвиденных ошибок
		console.error('[DELETE Profile] Unexpected error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
