/**
 * API Endpoint: POST /api/admin/events/create
 *
 * Создание нового мероприятия (только для администраторов)
 *
 * Функциональность:
 * - Валидация входных данных через Zod schema
 * - Создание мероприятия со статусом 'draft'
 * - Генерация и загрузка QR-кодов в R2 (если указаны ссылки на Telegram/WhatsApp)
 * - Сохранение дополнительных полей (additional_fields)
 * - Логирование действия в activity_log
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { eventCreateWithFieldsSchema } from '$lib/server/validation/schemas';
import { createEvent, updateEvent } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';
import { generateAndUploadQR } from '$lib/server/storage/qr';

export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = eventCreateWithFieldsSchema.safeParse(body);

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

		// Шаг 3: Создание мероприятия в БД (со статусом draft по умолчанию)
		// additional_fields обрабатываются внутри createEvent
		// Приводим типы к EventCreateData
		const eventData = {
			...data,
			additional_fields: data.additional_fields?.map((field) => ({
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
			})),
		};

		let event = await createEvent(platform!.env.DB, eventData, admin.id);

		// Шаг 4: Генерация QR-кодов (если указаны ссылки)
		let qrTelegramUrl: string | null = null;
		let qrWhatsappUrl: string | null = null;

		if (data.telegram_link) {
			try {
				qrTelegramUrl = await generateAndUploadQR(
					platform!.env.R2_BUCKET,
					platform!.env.R2_PUBLIC_URL,
					event.id,
					data.telegram_link,
					'telegram'
				);
			} catch (error) {
				console.error('[CREATE EVENT] Failed to generate Telegram QR:', error);
				// Не прерываем создание мероприятия из-за ошибки QR
			}
		}

		if (data.whatsapp_link) {
			try {
				qrWhatsappUrl = await generateAndUploadQR(
					platform!.env.R2_BUCKET,
					platform!.env.R2_PUBLIC_URL,
					event.id,
					data.whatsapp_link,
					'whatsapp'
				);
			} catch (error) {
				console.error('[CREATE EVENT] Failed to generate WhatsApp QR:', error);
				// Не прерываем создание мероприятия из-за ошибки QR
			}
		}

		// Шаг 5: Обновление мероприятия с URL QR-кодов (если были сгенерированы)
		if (qrTelegramUrl || qrWhatsappUrl) {
			// Обновляем event напрямую через SQL, так как qr_* поля не в EventUpdateData
			const updateSql = [];
			const updateBindings = [];

			if (qrTelegramUrl) {
				updateSql.push('qr_telegram_url = ?');
				updateBindings.push(qrTelegramUrl);
			}
			if (qrWhatsappUrl) {
				updateSql.push('qr_whatsapp_url = ?');
				updateBindings.push(qrWhatsappUrl);
			}
			updateBindings.push(event.id);

			await platform!.env.DB.prepare(
				`UPDATE events SET ${updateSql.join(', ')}, updated_at = datetime('now') WHERE id = ?`
			)
				.bind(...updateBindings)
				.run();

			// Обновляем локальную копию
			event.qr_telegram_url = qrTelegramUrl;
			event.qr_whatsapp_url = qrWhatsappUrl;
		}

		// Шаг 6: Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: event.id,
			event_title: event.title_de,
			status: event.status,
			ip,
		});
		await logActivity(platform!.env.DB, admin.id, 'event_create', logDetails, ip || undefined);

		// Шаг 7: Возврат успешного результата
		return json(
			{
				success: true,
				event,
				message: 'Event created successfully',
			},
			{ status: 201 }
		);
	} catch (error: any) {
		console.error('[POST /api/admin/events/create] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to create event',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
