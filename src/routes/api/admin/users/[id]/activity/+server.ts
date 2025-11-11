/**
 * API Endpoint: Get User Activity Log
 * Получение истории активности пользователя (для админов)
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

		// Получаем последние 10 записей активности пользователя
		const activityResult = await db
			.prepare(
				`
				SELECT 
					id,
					action_type,
					details,
					ip_address,
					timestamp
				FROM activity_log
				WHERE user_id = ?
				ORDER BY timestamp DESC
				LIMIT 10
			`
			)
			.bind(userId)
			.all();

		const activity = activityResult.results || [];

		return json({ activity });
	} catch (err: any) {
		console.error('[get-user-activity] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось загрузить историю активности пользователя');
	}
}
