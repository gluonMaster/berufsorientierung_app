/**
 * API Endpoint: POST /api/admin/events/regenerate-qr
 *
 * Принудительная перегенерация QR-кодов для события (только для администраторов)
 *
 * Функциональность:
 * - Проверка прав администратора
 * - Валидация существования события
 * - Перегенерация QR-кодов (Telegram, WhatsApp или оба)
 * - Обновление URL в базе данных
 * - Логирование действия
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { getEventById } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';
import { generateAndUploadQR } from '$lib/server/storage/qr';

// Схема валидации входных данных
const regenerateQrSchema = z.object({
	eventId: z.number().int().positive('Event ID must be a positive integer'),
	type: z.enum(['telegram', 'whatsapp', 'all']).optional().default('all'),
});

export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = regenerateQrSchema.safeParse(body);

		if (!validation.success) {
			return json(
				{
					error: 'Validation failed',
					details: validation.error.issues.map((issue) => ({
						field: issue.path.join('.'),
						message: issue.message,
					})),
				},
				{ status: 400 }
			);
		}

		const { eventId, type } = validation.data;

		// Шаг 3: Проверка существования события
		const event = await getEventById(platform!.env.DB, eventId);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		// Шаг 4: Перегенерация QR-кодов в зависимости от типа
		const results: { telegram?: string | null; whatsapp?: string | null } = {};
		const errors: string[] = [];

		// Обработка Telegram QR
		if (type === 'telegram' || type === 'all') {
			if (!event.telegram_link) {
				if (type === 'telegram') {
					// Если запрошен только Telegram, но ссылки нет — возвращаем ошибку
					return json(
						{
							error: 'Telegram link is not set for this event',
							message: 'Cannot regenerate QR code without a link',
						},
						{ status: 400 }
					);
				}
				// Если запрошен 'all', просто пропускаем
				results.telegram = null;
			} else {
				try {
					const qrUrl = await generateAndUploadQR(
						platform!.env.R2_BUCKET,
						platform!.env.R2_PUBLIC_URL,
						eventId,
						event.telegram_link,
						'telegram'
					);
					results.telegram = qrUrl;

					// Обновление URL в БД
					await platform!.env.DB.prepare(
						`UPDATE events SET qr_telegram_url = ?, updated_at = datetime('now') WHERE id = ?`
					)
						.bind(qrUrl, eventId)
						.run();
				} catch (error) {
					const errorMsg = `Failed to regenerate Telegram QR: ${error instanceof Error ? error.message : 'Unknown error'}`;
					console.error('[REGENERATE QR]', errorMsg);
					errors.push(errorMsg);
				}
			}
		}

		// Обработка WhatsApp QR
		if (type === 'whatsapp' || type === 'all') {
			if (!event.whatsapp_link) {
				if (type === 'whatsapp') {
					// Если запрошен только WhatsApp, но ссылки нет — возвращаем ошибку
					return json(
						{
							error: 'WhatsApp link is not set for this event',
							message: 'Cannot regenerate QR code without a link',
						},
						{ status: 400 }
					);
				}
				// Если запрошен 'all', просто пропускаем
				results.whatsapp = null;
			} else {
				try {
					const qrUrl = await generateAndUploadQR(
						platform!.env.R2_BUCKET,
						platform!.env.R2_PUBLIC_URL,
						eventId,
						event.whatsapp_link,
						'whatsapp'
					);
					results.whatsapp = qrUrl;

					// Обновление URL в БД
					await platform!.env.DB.prepare(
						`UPDATE events SET qr_whatsapp_url = ?, updated_at = datetime('now') WHERE id = ?`
					)
						.bind(qrUrl, eventId)
						.run();
				} catch (error) {
					const errorMsg = `Failed to regenerate WhatsApp QR: ${error instanceof Error ? error.message : 'Unknown error'}`;
					console.error('[REGENERATE QR]', errorMsg);
					errors.push(errorMsg);
				}
			}
		}

		// Шаг 5: Проверка результатов
		if (errors.length > 0) {
			// Если были ошибки при генерации
			return json(
				{
					error: 'Failed to regenerate some QR codes',
					details: errors,
					partial_results: results,
				},
				{ status: 500 }
			);
		}

		// Проверка что хотя бы один QR был сгенерирован
		const regeneratedCount = Object.values(results).filter(
			(v) => v !== null && v !== undefined
		).length;
		if (regeneratedCount === 0) {
			return json(
				{
					error: 'No QR codes to regenerate',
					message: 'Event has no links set for the requested type',
				},
				{ status: 400 }
			);
		}

		// Шаг 6: Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: eventId,
			event_title: event.title_de,
			type,
			regenerated: results,
			ip,
		});
		await logActivity(
			platform!.env.DB,
			admin.id,
			'event_regenerate_qr',
			logDetails,
			ip || undefined
		);

		// Шаг 7: Возврат успешного результата
		return json({
			success: true,
			message: 'QR codes regenerated successfully',
			qr_urls: results,
		});
	} catch (error: any) {
		console.error('[POST /api/admin/events/regenerate-qr] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to regenerate QR codes',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
