/**
 * API Endpoint: PUT /api/admin/events/update
 *
 * Обновление существующего мероприятия (только для администраторов)
 *
 * Функциональность:
 * - Валидация входных данных через Zod schema
 * - Обновление данных мероприятия в БД
 * - Регенерация QR-кодов при изменении ссылок (удаление старых, создание новых)
 * - Обновление дополнительных полей (если указаны)
 * - Логирование действия
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { eventUpdateWithFieldsSchema } from '$lib/server/validation/schemas';
import { getEventById, updateEvent } from '$lib/server/db/events';
import { setEventFields } from '$lib/server/db/eventFields';
import { logActivity } from '$lib/server/db/activityLog';
import { generateAndUploadQR } from '$lib/server/storage/qr';
import { deleteFileByUrl } from '$lib/server/storage/r2';
import type { EventUpdateData } from '$lib/types/event';

export async function PUT({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		let body = await request.json();

		// Нормализация: принимаем как eventId (из фронтенда), так и id (из схемы)
		// Для совместимости с EventFormModal который отправляет eventId
		if ('eventId' in body && !('id' in body)) {
			body.id = body.eventId;
		}

		const validation = eventUpdateWithFieldsSchema.safeParse(body);

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

		const data = validation.data;
		const eventId = data.id;

		// Шаг 3: Проверка существования мероприятия
		const existingEvent = await getEventById(platform!.env.DB, eventId);
		if (!existingEvent) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		// Шаг 4: Обработка QR-кодов (если изменились ссылки)
		let qrTelegramUrl: string | null | undefined = undefined;
		let qrWhatsappUrl: string | null | undefined = undefined;

		// Проверяем, изменилась ли ссылка на Telegram
		if (
			data.telegram_link !== undefined &&
			data.telegram_link !== existingEvent.telegram_link
		) {
			if (data.telegram_link) {
				// Генерируем новый QR (bucket.put перезапишет старый файл по тому же ключу)
				try {
					qrTelegramUrl = await generateAndUploadQR(
						platform!.env.R2_BUCKET,
						platform!.env.R2_PUBLIC_URL,
						eventId,
						data.telegram_link,
						'telegram'
					);
				} catch (error) {
					console.error('[UPDATE EVENT] Failed to generate Telegram QR:', error);
					// При ошибке генерации оставляем старый QR (не затираем qr_telegram_url)
					// qrTelegramUrl остаётся undefined, поэтому БД не будет обновлена
				}
			} else {
				// Ссылка удалена: устанавливаем NULL в БД и удаляем файл из R2
				qrTelegramUrl = null;
				if (existingEvent.qr_telegram_url) {
					try {
						await deleteFileByUrl(
							platform!.env.R2_BUCKET,
							existingEvent.qr_telegram_url
						);
					} catch (error) {
						console.error('[UPDATE EVENT] Failed to delete Telegram QR:', error);
					}
				}
			}
		}

		// Проверяем, изменилась ли ссылка на WhatsApp
		if (
			data.whatsapp_link !== undefined &&
			data.whatsapp_link !== existingEvent.whatsapp_link
		) {
			if (data.whatsapp_link) {
				// Генерируем новый QR (bucket.put перезапишет старый файл по тому же ключу)
				try {
					qrWhatsappUrl = await generateAndUploadQR(
						platform!.env.R2_BUCKET,
						platform!.env.R2_PUBLIC_URL,
						eventId,
						data.whatsapp_link,
						'whatsapp'
					);
				} catch (error) {
					console.error('[UPDATE EVENT] Failed to generate WhatsApp QR:', error);
					// При ошибке генерации оставляем старый QR (не затираем qr_whatsapp_url)
					// qrWhatsappUrl остаётся undefined, поэтому БД не будет обновлена
				}
			} else {
				// Ссылка удалена: устанавливаем NULL в БД и удаляем файл из R2
				qrWhatsappUrl = null;
				if (existingEvent.qr_whatsapp_url) {
					try {
						await deleteFileByUrl(
							platform!.env.R2_BUCKET,
							existingEvent.qr_whatsapp_url
						);
					} catch (error) {
						console.error('[UPDATE EVENT] Failed to delete WhatsApp QR:', error);
					}
				}
			}
		}

		// Шаг 5: Подготовка данных для обновления (без additional_fields и id)
		// Удаляем null значения, так как EventUpdateData использует undefined для опциональных полей
		const { id, additional_fields, ...rawUpdateData } = data;
		const updateData: Partial<EventUpdateData> = {};

		for (const [key, value] of Object.entries(rawUpdateData)) {
			if (value !== undefined) {
				// @ts-ignore - динамическое присваивание полей
				updateData[key] = value === null ? undefined : value;
			}
		}

		// Шаг 6: Обновление мероприятия в БД
		let event = await updateEvent(platform!.env.DB, eventId, updateData);

		// Шаг 7: Обновление QR URLs в БД (если были изменены ссылки)
		const qrUpdateSql = [];
		const qrUpdateBindings = [];

		if (qrTelegramUrl !== undefined) {
			qrUpdateSql.push('qr_telegram_url = ?');
			qrUpdateBindings.push(qrTelegramUrl);
		}
		if (qrWhatsappUrl !== undefined) {
			qrUpdateSql.push('qr_whatsapp_url = ?');
			qrUpdateBindings.push(qrWhatsappUrl);
		}

		if (qrUpdateSql.length > 0) {
			qrUpdateBindings.push(eventId);
			await platform!.env.DB.prepare(
				`UPDATE events SET ${qrUpdateSql.join(', ')}, updated_at = datetime('now') WHERE id = ?`
			)
				.bind(...qrUpdateBindings)
				.run();

			// Обновляем локальную копию
			if (qrTelegramUrl !== undefined) event.qr_telegram_url = qrTelegramUrl;
			if (qrWhatsappUrl !== undefined) event.qr_whatsapp_url = qrWhatsappUrl;
		}

		// Шаг 8: Обновление additional_fields (если указаны)
		if (additional_fields && additional_fields.length > 0) {
			// Приводим типы к EventAdditionalFieldInput
			const fields = additional_fields.map((field) => ({
				field_key: field.field_key,
				field_type: field.field_type,
				field_options: field.field_options ?? null,
				required: field.required,
				label_de: field.label_de,
				label_en: field.label_en ?? null,
				label_ru: field.label_ru ?? null,
				label_uk: field.label_uk ?? null,
				placeholder_de: field.placeholder_de ?? null,
				placeholder_en: field.placeholder_en ?? null,
				placeholder_ru: field.placeholder_ru ?? null,
				placeholder_uk: field.placeholder_uk ?? null,
			}));

			await setEventFields(platform!.env.DB, eventId, fields);
		}

		// Шаг 9: Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: eventId,
			event_title: event.title_de,
			updated_fields: Object.keys(updateData),
			ip,
		});
		await logActivity(platform!.env.DB, admin.id, 'event_update', logDetails, ip || undefined);

		// Шаг 10: Возврат успешного результата
		return json({
			success: true,
			event,
			message: 'Event updated successfully',
		});
	} catch (error: any) {
		console.error('[PUT /api/admin/events/update] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to update event',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
