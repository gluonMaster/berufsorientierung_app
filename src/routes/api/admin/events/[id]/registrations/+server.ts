/**
 * GET /api/admin/events/[id]/registrations
 * Получение списка регистраций на мероприятие с информацией о пользователях
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { getEventRegistrations } from '$lib/server/db/registrations';
import { requireAdmin } from '$lib/server/middleware/auth';

/**
 * GET - Получить список регистраций на мероприятие
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

		// Получить все регистрации на мероприятие с информацией о пользователях
		const registrations = await getEventRegistrations(db, eventId);

		// Трансформировать данные для фронтенда
		// getEventRegistrations возвращает RegistrationWithUser[], нужно преобразовать в формат с вложенным user
		const formattedRegistrations = registrations.map((reg) => ({
			id: reg.id,
			user_id: reg.user_id,
			event_id: reg.event_id,
			additional_data: reg.additional_data,
			registered_at: reg.registered_at,
			cancelled_at: reg.cancelled_at,
			cancellation_reason: reg.cancellation_reason,
			user: {
				id: reg.user_id,
				first_name: reg.user_first_name,
				last_name: reg.user_last_name,
				email: reg.user_email,
				phone: reg.user_phone,
				whatsapp: reg.user_whatsapp,
				telegram: reg.user_telegram,
			},
		}));

		return json({
			success: true,
			registrations: formattedRegistrations,
			total: formattedRegistrations.length,
		});
	} catch (err: any) {
		console.error('Failed to fetch registrations:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Failed to fetch registrations');
	}
}
