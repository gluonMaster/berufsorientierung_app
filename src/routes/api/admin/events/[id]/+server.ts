/**
 * GET /api/admin/events/[id]
 * Получение полных данных мероприятия с дополнительными полями и информацией о создателе
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getEventWithFields } from '$lib/server/db/events';
import { getUserById } from '$lib/server/db/users';
import { requireAdmin } from '$lib/server/middleware/auth';

/**
 * GET - Получить полные данные мероприятия
 * Требует права администратора
 */
export async function GET({ params, platform, request }: RequestEvent) {
	const eventId = parseInt(params.id || '0');
	if (isNaN(eventId) || eventId <= 0) {
		throw error(400, 'Invalid event ID');
	}

	try {
		const db = platform?.env?.DB;
		const jwtSecret = platform?.env?.JWT_SECRET;

		if (!db || !jwtSecret) {
			throw error(500, 'Database or JWT secret not configured');
		}

		// Проверка прав администратора
		await requireAdmin(request, db, jwtSecret);

		// Получить мероприятие с дополнительными полями
		const eventWithFields = await getEventWithFields(db, eventId);

		if (!eventWithFields) {
			throw error(404, 'Event not found');
		}

		// Получить информацию о создателе (админе)
		let creatorName = 'Unknown';
		if (eventWithFields.created_by) {
			const creator = await getUserById(db, eventWithFields.created_by);
			if (creator) {
				creatorName = `${creator.first_name} ${creator.last_name}`;
			}
		}

		// Возвращаем мероприятие с дополнительной информацией
		return json({
			success: true,
			event: {
				...eventWithFields,
				creator_name: creatorName,
			},
		});
	} catch (err: any) {
		console.error('Failed to fetch event:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Failed to fetch event');
	}
}
