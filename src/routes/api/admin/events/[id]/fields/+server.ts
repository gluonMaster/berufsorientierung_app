/**
 * GET /api/admin/events/[id]/fields
 * Получение дополнительных полей мероприятия
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getEventFields } from '$lib/server/db/eventFields';
import { requireAdmin } from '$lib/server/middleware/auth';

/**
 * GET - Получить дополнительные поля мероприятия
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

		// Получить дополнительные поля
		const fields = await getEventFields(db, eventId);

		return json({
			success: true,
			fields: fields || [],
		});
	} catch (err: any) {
		console.error('Failed to fetch event fields:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Failed to fetch event fields');
	}
}
