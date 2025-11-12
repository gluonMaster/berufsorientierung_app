/**
 * Cloudflare Worker - Scheduled Event Handler
 *
 * Обрабатывает Cron триггеры из wrangler.toml
 * Запускается автоматически по расписанию: 0 2 * * * (каждый день в 02:00 UTC)
 *
 * ВАЖНО: Этот файл экспортирует обработчик scheduled для Cloudflare Workers.
 * После build SvelteKit создаёт _worker.js, который нужно расширить этим обработчиком.
 *
 * Для интеграции с SvelteKit:
 * 1. После npm run build скопируйте этот код в .svelte-kit/cloudflare/_worker.js
 * 2. Или используйте custom build script для автоматического мерджа
 *
 * Альтернатива: используйте HTTP endpoint /api/cron/delete-users с внешним Cron сервисом
 */

import type { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { DB } from './lib/server/db';

/**
 * Обработчик Cloudflare Scheduled Events (Cron)
 *
 * ИСПОЛЬЗОВАНИЕ:
 *
 * Вариант 1 (рекомендуется): Внешний Cron сервис
 * - Настройте cron-job.org или GitHub Actions
 * - Вызывайте GET /api/cron/delete-users с Authorization header
 *
 * Вариант 2: Интеграция с SvelteKit build
 * - После build добавьте этот export в .svelte-kit/cloudflare/_worker.js:
 *
 * ```javascript
 * export { scheduled } from '../../src/worker.js';
 * ```
 *
 * Вариант 3: Кастомный worker entry point
 * - Создайте src/entry-worker.ts, который импортирует SvelteKit worker и добавляет scheduled
 * - Укажите его в wrangler.toml как main
 *
 * @param event - ScheduledEvent с информацией о расписании
 * @param env - Environment переменные (включая DB, JWT_SECRET и т.д.)
 * @param ctx - ExecutionContext для управления жизненным циклом
 */
export async function scheduled(
	event: ScheduledEvent,
	env: App.Platform['env'],
	ctx: ExecutionContext
): Promise<void> {
	try {
		console.log('[CRON] Starting scheduled tasks...');
		console.log(`[CRON] Triggered at: ${new Date(event.scheduledTime).toISOString()}`);
		console.log(`[CRON] Cron pattern: ${event.cron}`);

		// 1. Выполнить удаление пользователей через GDPR модуль
		const deleted = await DB.gdpr.processScheduledDeletions(env.DB);
		console.log(`[CRON] Deleted ${deleted} user(s)`);

		// 2. Проверить истёкшие дедлайны регистрации
		const expiredCount = await DB.events.closeExpiredRegistrations(env.DB);
		if (expiredCount > 0) {
			console.log(`[CRON] Found ${expiredCount} event(s) with expired registration deadline`);
		}

		// 3. Логировать системное действие в activity_log
		await DB.activityLog.logActivity(
			env.DB,
			null, // userId = null (системное действие)
			'system_cron_deletion',
			JSON.stringify({
				deleted_count: deleted,
				expired_registrations_count: expiredCount,
				triggered_by: 'cloudflare_cron',
				cron_schedule: event.cron || '0 2 * * *',
				scheduled_time: new Date(event.scheduledTime).toISOString(),
			}),
			undefined // IP address не применим для Cron
		);

		console.log('[CRON] Successfully completed all tasks and logged to activity_log');
	} catch (error) {
		// Логирование ошибки (не прерываем выполнение, чтобы не блокировать будущие Cron'ы)
		console.error('[CRON] Scheduled error:', error);
		console.error('[CRON] Stack:', error instanceof Error ? error.stack : 'N/A');

		// Опционально: можно отправить алерт через webhook
		// await sendErrorAlert(env, error);
	}
}
