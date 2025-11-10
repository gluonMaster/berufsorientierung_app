/**
 * API Endpoint: POST /api/admin/events/publish
 *
 * Публикация мероприятия (только для администраторов)
 *
 * Функциональность:
 * - Проверка существования мероприятия
 * - Валидация обязательных полей для публикации
 * - Изменение статуса мероприятия с 'draft' на 'active'
 * - Логирование действия
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { getEventById, publishEvent } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';
import { z } from 'zod';

// Схема валидации запроса
const publishEventSchema = z.object({
	eventId: z.number().int().positive(),
});

export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = publishEventSchema.safeParse(body);

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

		const { eventId } = validation.data;

		// Шаг 3: Проверка существования мероприятия
		const event = await getEventById(platform!.env.DB, eventId);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		// Шаг 4: Проверка текущего статуса
		if (event.status === 'cancelled') {
			return json({ error: 'Cannot publish cancelled event' }, { status: 400 });
		}

		if (event.status === 'active') {
			return json({ error: 'Event is already published' }, { status: 400 });
		}

		// Шаг 5: Валидация обязательных полей
		const validationErrors: string[] = [];

		if (!event.title_de) validationErrors.push('German title is required');
		if (!event.date) validationErrors.push('Event date is required');
		if (!event.registration_deadline)
			validationErrors.push('Registration deadline is required');
		if (!event.max_participants) validationErrors.push('Maximum participants is required');

		// Проверка что даты корректны
		if (event.date && event.registration_deadline) {
			const eventDate = new Date(event.date);
			const deadline = new Date(event.registration_deadline);
			const now = new Date();

			if (deadline < now) {
				validationErrors.push('Registration deadline must be in the future');
			}

			if (eventDate <= deadline) {
				validationErrors.push('Event date must be after registration deadline');
			}
		}

		if (validationErrors.length > 0) {
			return json(
				{
					error: 'Event cannot be published',
					validationErrors,
				},
				{ status: 400 }
			);
		}

		// Шаг 6: Публикация мероприятия (изменение статуса на 'active')
		const publishedEvent = await publishEvent(platform!.env.DB, eventId);

		// Шаг 7: Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: eventId,
			event_title: publishedEvent.title_de,
			ip,
		});
		await logActivity(platform!.env.DB, admin.id, 'event_publish', logDetails, ip || undefined);

		// Шаг 8: Возврат успешного результата
		return json({
			success: true,
			event: publishedEvent,
			message: 'Event published successfully',
		});
	} catch (error: any) {
		console.error('[POST /api/admin/events/publish] Error:', error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		// Обработка других ошибок
		return json(
			{
				error: 'Failed to publish event',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
