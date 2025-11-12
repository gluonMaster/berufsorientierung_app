/**
 * Cloudflare Cron Trigger для автоматического удаления пользователей
 *
 * Запускается каждый день в 02:00 UTC через Cloudflare Cron
 * Обрабатывает запланированные удаления из таблицы pending_deletions
 *
 * Security: Требует Bearer token (CRON_SECRET) в заголовке Authorization
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { DB } from '$lib/server/db';

export async function GET({ request, platform }: RequestEvent) {
	try {
		// 1. Проверка Authorization header
		const authHeader = request.headers.get('Authorization');

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return json(
				{
					success: false,
					error: 'Missing or invalid Authorization header',
				},
				{ status: 401 }
			);
		}

		// Извлекаем токен
		const token = authHeader.slice(7); // Убираем "Bearer "
		const expectedToken = platform?.env?.CRON_SECRET;

		// Проверяем наличие CRON_SECRET в env
		if (!expectedToken) {
			console.error('[CRON] CRON_SECRET not configured in environment');
			return json(
				{
					success: false,
					error: 'Server configuration error',
				},
				{ status: 500 }
			);
		}

		// Проверяем совпадение токенов
		if (token !== expectedToken) {
			console.warn('[CRON] Invalid CRON_SECRET provided');
			return json(
				{
					success: false,
					error: 'Invalid authorization token',
				},
				{ status: 401 }
			);
		}

		// 2. Выполнить удаление через GDPR модуль
		const database = platform?.env?.DB;
		if (!database) {
			throw new Error('Database not available');
		}

		console.log('[CRON] Starting scheduled user deletions...');
		const deletedCount = await DB.gdpr.processScheduledDeletions(database);
		console.log(`[CRON] Completed. Deleted ${deletedCount} user(s)`);

		// 3. Логирование системного действия
		await DB.activityLog.logActivity(
			database,
			null, // Системное действие
			'system_cron_deletion',
			JSON.stringify({
				deleted_count: deletedCount,
				triggered_by: 'cloudflare_cron',
				cron_schedule: '0 2 * * *', // Каждый день в 02:00 UTC
			}),
			undefined // IP address
		);

		// 4. Вернуть результат
		const timestamp = new Date().toISOString();

		return json({
			success: true,
			deleted: deletedCount,
			timestamp,
			message: `Successfully deleted ${deletedCount} user(s)`,
		});
	} catch (error) {
		console.error('[CRON] Error during scheduled deletion:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}
