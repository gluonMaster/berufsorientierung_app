/**
 * API Endpoint: POST /api/admin/events/import
 *
 * Импорт мероприятий из JSON файла (только для администраторов)
 *
 * Функциональность:
 * - Валидация структуры JSON
 * - Проверка обязательных полей для каждого мероприятия
 * - Создание мероприятий в БД
 * - Создание дополнительных полей (если указаны)
 * - Генерация QR-кодов для новых мероприятий
 * - Логирование действия
 *
 * ВАЖНО: Не импортирует регистрации (только структуру мероприятий)
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { createEvent } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';
import { generateAndUploadQR } from '$lib/server/storage/qr';
import { z } from 'zod';
import type { EventCreateData } from '$lib/types/event';

// Схема валидации импортируемого мероприятия
const importEventSchema = z.object({
	title_de: z.string().min(1),
	title_en: z.string().optional().nullable(),
	title_ru: z.string().optional().nullable(),
	title_uk: z.string().optional().nullable(),
	description_de: z.string().optional().nullable(),
	description_en: z.string().optional().nullable(),
	description_ru: z.string().optional().nullable(),
	description_uk: z.string().optional().nullable(),
	requirements_de: z.string().optional().nullable(),
	requirements_en: z.string().optional().nullable(),
	requirements_ru: z.string().optional().nullable(),
	requirements_uk: z.string().optional().nullable(),
	location_de: z.string().optional().nullable(),
	location_en: z.string().optional().nullable(),
	location_ru: z.string().optional().nullable(),
	location_uk: z.string().optional().nullable(),
	date: z.string(),
	registration_deadline: z.string(),
	max_participants: z.number().int().positive(),
	telegram_link: z.string().optional().nullable(),
	whatsapp_link: z.string().optional().nullable(),
	status: z.enum(['draft', 'active']).optional(),
	additional_fields: z.array(z.any()).optional(),
});

const importDataSchema = z.object({
	events: z.array(importEventSchema),
});

export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = importDataSchema.safeParse(body);

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

		const importData = validation.data;
		const eventsToImport = importData.events;

		if (eventsToImport.length === 0) {
			return json({ error: 'No events to import' }, { status: 400 });
		}

		// Шаг 3: Импорт мероприятий
		const results = {
			success: 0,
			failed: 0,
			errors: [] as Array<{ index: number; title: string; error: string }>,
		};

		for (let i = 0; i < eventsToImport.length; i++) {
			const eventData = eventsToImport[i];

			try {
				// Валидация дат
				const eventDate = new Date(eventData.date);
				const deadline = new Date(eventData.registration_deadline);
				const now = new Date();

				if (isNaN(eventDate.getTime())) {
					throw new Error('Invalid event date format');
				}

				if (isNaN(deadline.getTime())) {
					throw new Error('Invalid registration deadline format');
				}

				// Пропускаем мероприятия с прошедшими датами (опционально)
				if (eventDate < now) {
					console.warn(`[IMPORT] Skipping event "${eventData.title_de}" with past date`);
					results.failed++;
					results.errors.push({
						index: i,
						title: eventData.title_de,
						error: 'Event date is in the past',
					});
					continue;
				}

				// Создание мероприятия
				const createData: EventCreateData = {
					title_de: eventData.title_de,
					title_en: eventData.title_en || null,
					title_ru: eventData.title_ru || null,
					title_uk: eventData.title_uk || null,
					description_de: eventData.description_de || null,
					description_en: eventData.description_en || null,
					description_ru: eventData.description_ru || null,
					description_uk: eventData.description_uk || null,
					requirements_de: eventData.requirements_de || null,
					requirements_en: eventData.requirements_en || null,
					requirements_ru: eventData.requirements_ru || null,
					requirements_uk: eventData.requirements_uk || null,
					location_de: eventData.location_de || null,
					location_en: eventData.location_en || null,
					location_ru: eventData.location_ru || null,
					location_uk: eventData.location_uk || null,
					date: eventData.date,
					registration_deadline: eventData.registration_deadline,
					max_participants: eventData.max_participants,
					telegram_link: eventData.telegram_link || undefined,
					whatsapp_link: eventData.whatsapp_link || undefined,
					status: eventData.status || 'draft',
					additional_fields: eventData.additional_fields as any,
				};

				const event = await createEvent(platform!.env.DB, createData, admin.id);

				// Генерация QR-кодов (если указаны ссылки)
				const qrUpdates: string[] = [];
				const qrBindings: any[] = [];

				if (eventData.telegram_link) {
					try {
						const qrUrl = await generateAndUploadQR(
							platform!.env.R2_BUCKET,
							platform!.env.R2_PUBLIC_URL,
							event.id,
							eventData.telegram_link,
							'telegram'
						);
						qrUpdates.push('qr_telegram_url = ?');
						qrBindings.push(qrUrl);
					} catch (error) {
						console.error(
							`[IMPORT] Failed to generate Telegram QR for event ${event.id}:`,
							error
						);
					}
				}

				if (eventData.whatsapp_link) {
					try {
						const qrUrl = await generateAndUploadQR(
							platform!.env.R2_BUCKET,
							platform!.env.R2_PUBLIC_URL,
							event.id,
							eventData.whatsapp_link,
							'whatsapp'
						);
						qrUpdates.push('qr_whatsapp_url = ?');
						qrBindings.push(qrUrl);
					} catch (error) {
						console.error(
							`[IMPORT] Failed to generate WhatsApp QR for event ${event.id}:`,
							error
						);
					}
				}

				// Обновление QR URLs в БД
				if (qrUpdates.length > 0) {
					qrBindings.push(event.id);
					await platform!.env.DB.prepare(
						`UPDATE events SET ${qrUpdates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
					)
						.bind(...qrBindings)
						.run();
				}

				results.success++;
			} catch (error) {
				console.error(`[IMPORT] Failed to import event at index ${i}:`, error);
				results.failed++;
				results.errors.push({
					index: i,
					title: eventData.title_de,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		// Шаг 4: Логирование действия
		const ip = getClientIP(request);
		try {
			const logDetails = JSON.stringify({
				total_events: eventsToImport.length,
				imported: results.success,
				failed: results.failed,
				ip,
			});
			await logActivity(
				platform!.env.DB,
				admin.id,
				'event_import',
				logDetails,
				ip || undefined
			);
		} catch (error) {
			console.error('[IMPORT] Failed to log activity:', error);
		}

		// Шаг 5: Возврат результатов
		return json({
			success: true,
			message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
			imported: results.success,
			failed: results.failed,
			total: eventsToImport.length,
			errors: results.errors.length > 0 ? results.errors : undefined,
		});
	} catch (error: any) {
		console.error('[POST /api/admin/events/import] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to import events',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
