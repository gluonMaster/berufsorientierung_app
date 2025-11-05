/**
 * API Endpoint: POST /api/profile/delete
 * Удаление профиля пользователя с соблюдением GDPR
 *
 * Логика:
 * 1. Проверка авторизации (requireAuth)
 * 2. Проверка возможности немедленного удаления (DB.gdpr.canDeleteUser)
 * 3. Если можно удалить сейчас:
 *    - Полное удаление (DB.gdpr.deleteUserCompletely)
 *    - Очистка auth cookie
 *    - Логирование
 *    - Возврат: { deleted: true, immediate: true }
 * 4. Если нельзя удалить сейчас:
 *    - Планирование удаления (DB.gdpr.scheduleUserDeletion)
 *    - Немедленная блокировка доступа (is_blocked = 1)
 *    - Очистка auth cookie
 *    - Логирование
 *    - Возврат: { deleted: true, immediate: false, deletionDate: "..." }
 *
 * ВАЖНО: После вызова этого endpoint пользователь ВСЕГДА разлогинен
 * (либо удален полностью, либо заблокирован и запланирован к удалению)
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
 * - 200: { deleted: true, immediate: boolean, deletionDate?: string }
 * - 401: { error: 'Unauthorized' }
 * - 500: { error: 'Server error' }
 *
 * @example Немедленное удаление (прошло >= 28 дней после последнего мероприятия)
 * ```
 * POST /api/profile/delete
 * → 200 { deleted: true, immediate: true }
 * ```
 *
 * @example Запланированное удаление (есть предстоящие мероприятия или прошло < 28 дней)
 * ```
 * POST /api/profile/delete
 * → 200 {
 *     deleted: true,
 *     immediate: false,
 *     deletionDate: "2025-12-05T10:00:00.000Z"
 *   }
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

		// Шаг 2: Проверяем, можно ли удалить пользователя прямо сейчас
		let canDeleteResult;
		try {
			canDeleteResult = await DB.gdpr.canDeleteUser(db, user.id);
		} catch (error) {
			console.error('[DELETE Profile] Error checking if user can be deleted:', error);
			return json({ error: 'Failed to check deletion eligibility' }, { status: 500 });
		}

		// Шаг 3: Если можно удалить немедленно
		if (canDeleteResult.canDelete) {
			try {
				// Полное удаление пользователя (включая архивацию)
				await DB.gdpr.deleteUserCompletely(db, user.id);

				// Логируем успешное удаление
				// ВАЖНО: логирование ПОСЛЕ удаления, т.к. user_id будет NULL в логе
				await DB.activityLog.logActivity(
					db,
					null, // user_id = null, т.к. пользователь уже удален
					'profile_deleted_immediate',
					JSON.stringify({
						deleted_user_id: user.id,
						email: user.email,
						reason: 'immediate_deletion',
					}),
					ipAddress || undefined
				);

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
		}

		// Шаг 4: Если нельзя удалить сейчас - планируем удаление
		try {
			// Планируем удаление + немедленно блокируем аккаунт
			let deletionDate: string;

			try {
				deletionDate = await DB.gdpr.scheduleUserDeletion(db, user.id);
			} catch (scheduleError: any) {
				// Graceful handling: если удаление уже запланировано, возвращаем существующую дату
				if (scheduleError.message?.includes('already scheduled')) {
					// Получаем существующую запланированную дату
					const existingDeletion = await db
						.prepare('SELECT deletion_date FROM pending_deletions WHERE user_id = ?')
						.bind(user.id)
						.first<{ deletion_date: string }>();

					if (existingDeletion) {
						deletionDate = existingDeletion.deletion_date;
						console.log(
							`[DELETE Profile] User ${user.id} (${user.email}) deletion already scheduled for ${deletionDate}`
						);
					} else {
						// Не нашли запись - это неожиданно, пробрасываем ошибку
						throw scheduleError;
					}
				} else {
					// Другая ошибка - пробрасываем
					throw scheduleError;
				}
			}

			// Логируем запланированное удаление (только если это новая запись)
			if (deletionDate) {
				await DB.activityLog.logActivity(
					db,
					user.id,
					'profile_deletion_scheduled',
					JSON.stringify({
						deletion_date: deletionDate,
						reason: canDeleteResult.reason || 'Unknown reason',
						account_blocked: true,
					}),
					ipAddress || undefined
				);

				console.log(
					`[DELETE Profile] User ${user.id} (${user.email}) deletion scheduled for ${deletionDate}. Account blocked.`
				);
			}

			// Возвращаем ответ с датой планируемого удаления и очищаем cookie
			return json(
				{
					deleted: true,
					immediate: false,
					deletionDate: deletionDate,
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
			console.error('[DELETE Profile] Error during scheduled deletion:', error);

			// Логируем ошибку
			await DB.activityLog.logActivity(
				db,
				user.id,
				'profile_deletion_failed',
				JSON.stringify({
					reason: 'scheduled_deletion_error',
					error: error instanceof Error ? error.message : 'Unknown error',
				}),
				ipAddress || undefined
			);

			return json({ error: 'Failed to schedule profile deletion' }, { status: 500 });
		}
	} catch (error) {
		// Общий обработчик непредвиденных ошибок
		console.error('[DELETE Profile] Unexpected error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
