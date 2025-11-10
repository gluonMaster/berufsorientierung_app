/**
 * API Endpoint: GET /api/admin/events/export
 *
 * Экспорт всех мероприятий с регистрациями в JSON формате (только для администраторов)
 *
 * Функциональность:
 * - Получение всех мероприятий из БД
 * - Получение дополнительных полей для каждого мероприятия
 * - Получение всех регистраций для каждого мероприятия
 * - Формирование JSON с полной информацией
 * - Установка заголовков для скачивания файла
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { getAllEvents } from '$lib/server/db/events';
import { getEventFields } from '$lib/server/db/eventFields';
import { getEventRegistrations } from '$lib/server/db/registrations';
import { logActivity } from '$lib/server/db/activityLog';

export async function GET({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Получение всех мероприятий (без пагинации - получаем все)
		const eventsResult = await getAllEvents(platform!.env.DB, { limit: 10000, offset: 0 });
		const events = eventsResult.events;

		// Шаг 3: Для каждого мероприятия получаем дополнительные поля и регистрации
		const eventsWithDetails = await Promise.all(
			events.map(async (event) => {
				// Получаем дополнительные поля
				const additionalFields = await getEventFields(platform!.env.DB, event.id);

				// Получаем регистрации
				const registrations = await getEventRegistrations(platform!.env.DB, event.id);

				// Форматируем регистрации (убираем чувствительные данные пользователей)
				const formattedRegistrations = registrations.map((reg) => ({
					id: reg.id,
					user_id: reg.user_id,
					registered_at: reg.registered_at,
					cancelled_at: reg.cancelled_at,
					cancellation_reason: reg.cancellation_reason,
					additional_data: reg.additional_data,
				}));

				return {
					...event,
					additional_fields: additionalFields,
					registrations: formattedRegistrations,
					registrations_count: formattedRegistrations.filter((r) => !r.cancelled_at)
						.length,
				};
			})
		);

		// Шаг 4: Формирование итогового JSON
		const exportData = {
			exported_at: new Date().toISOString(),
			exported_by: admin.email,
			total_events: events.length,
			events: eventsWithDetails,
		};

		// Шаг 5: Логирование действия
		const ip = getClientIP(request);
		try {
			const logDetails = JSON.stringify({
				total_events: events.length,
				ip,
			});
			await logActivity(
				platform!.env.DB,
				admin.id,
				'event_export',
				logDetails,
				ip || undefined
			);
		} catch (error) {
			console.error('[EXPORT] Failed to log activity:', error);
		}

		// Шаг 6: Возврат JSON с заголовками для скачивания
		const fileName = `events_export_${new Date().toISOString().split('T')[0]}.json`;

		return new Response(JSON.stringify(exportData, null, 2), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${fileName}"`,
				'Cache-Control': 'no-cache',
			},
		});
	} catch (error: any) {
		console.error('[GET /api/admin/events/export] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to export events',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
