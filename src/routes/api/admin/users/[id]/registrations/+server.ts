/**
 * API Endpoint: Get User Registrations
 * Получение всех регистраций пользователя на мероприятия (для админов)
 */

import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { isAdmin } from '$lib/server/db/admin';
import { getUserById } from '$lib/server/db/users';

export async function GET({
	params,
	locals,
	platform,
}: {
	params: { id: string };
	locals: App.Locals;
	platform: App.Platform | undefined;
}) {
	// Проверка аутентификации
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}

	const db = getDB(platform);

	// Проверка прав администратора
	const currentUserIsAdmin = await isAdmin(db, locals.user.id);
	if (!currentUserIsAdmin) {
		throw error(403, 'Доступ запрещён');
	}

	try {
		// Получаем ID пользователя из URL
		const userId = parseInt(params.id);
		if (isNaN(userId)) {
			throw error(400, 'Некорректный ID пользователя');
		}

		// Проверяем существование пользователя
		const user = await getUserById(db, userId);
		if (!user) {
			throw error(404, 'Пользователь не найден');
		}

		// Получаем все регистрации пользователя с метаданными мероприятий
		const registrationsResult = await db
			.prepare(
				`
				SELECT 
					r.id,
					r.event_id,
					r.registered_at,
					r.cancelled_at,
					r.cancellation_reason,
					r.additional_data,
					e.title_de as event_title,
					e.date as event_date,
					e.location_de as event_location,
					e.status as event_status
				FROM registrations r
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.user_id = ?
				ORDER BY r.registered_at DESC
			`
			)
			.bind(userId)
			.all();

		const registrations = registrationsResult.results || [];

		return json({ registrations });
	} catch (err: any) {
		console.error('[get-user-registrations] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось загрузить регистрации пользователя');
	}
}
