/**
 * API Endpoint: POST /api/admin/cron/trigger-delete
 *
 * Ручной запуск удаления пользователей (только для администраторов)
 *
 * Этот endpoint полезен для:
 * - Тестирования Cron функционала локально
 * - Ручного запуска удаления в production (если нужно)
 * - Отладки процесса удаления
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { DB } from '$lib/server/db';

export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Получаем database
		const database = platform!.env.DB;

		// Шаг 3: Выполняем удаление
		console.log('[MANUAL_CRON] Starting manual deletion trigger by admin:', admin.id);
		const deletedCount = await DB.gdpr.processScheduledDeletions(database);
		console.log(`[MANUAL_CRON] Completed. Deleted ${deletedCount} user(s)`);

		// Шаг 4: Логирование
		const clientIP = getClientIP(request);
		await DB.activityLog.logActivity(
			database,
			admin.id,
			'system_cron_deletion',
			JSON.stringify({
				deleted_count: deletedCount,
				triggered_by: 'manual_admin',
				admin_id: admin.id,
			}),
			clientIP ?? undefined
		);

		// Шаг 5: Возвращаем результат
		return json({
			success: true,
			deleted: deletedCount,
			message: `Successfully deleted ${deletedCount} user(s)`,
			timestamp: new Date().toISOString(),
		});
	} catch (error: any) {
		console.error('[MANUAL_CRON] Error during manual deletion:', error);

		// Определяем правильный HTTP статус код
		// Если middleware выбросила ошибку со status (401/403) - используем её
		// Иначе проверяем сообщение для обратной совместимости
		// По умолчанию - 500 (Internal Server Error)
		const status =
			typeof error?.status === 'number'
				? error.status
				: error instanceof Error && /Unauthorized/i.test(error.message)
					? 401
					: 500;

		return json(
			{
				success: false,
				error: error?.message ?? 'Unknown error',
				timestamp: new Date().toISOString(),
			},
			{ status }
		);
	}
}
