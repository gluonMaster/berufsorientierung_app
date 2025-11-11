/**
 * API Endpoint: Get User Details
 * Получение детальной информации о пользователе (для админов)
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

		// Получаем данные пользователя
		const user = await getUserById(db, userId);
		if (!user) {
			throw error(404, 'Пользователь не найден');
		}

		// Возвращаем данные без password_hash для безопасности
		const userResponse = {
			id: user.id,
			email: user.email,
			first_name: user.first_name,
			last_name: user.last_name,
			birth_date: user.birth_date,
			address_street: user.address_street,
			address_number: user.address_number,
			address_zip: user.address_zip,
			address_city: user.address_city,
			phone: user.phone,
			whatsapp: user.whatsapp,
			telegram: user.telegram,
			photo_video_consent: user.photo_video_consent,
			preferred_language: user.preferred_language,
			parental_consent: user.parental_consent,
			is_blocked: user.is_blocked,
			created_at: user.created_at,
			updated_at: user.updated_at,
		};

		return json({ user: userResponse });
	} catch (err: any) {
		console.error('[get-user] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось загрузить данные пользователя');
	}
}
