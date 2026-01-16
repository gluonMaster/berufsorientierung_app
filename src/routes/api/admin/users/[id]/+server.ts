/**
 * API Endpoint: Get User Details / Delete User
 * Получение детальной информации о пользователе (для админов)
 * Удаление пользователя (для админов)
 */

import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { isAdmin } from '$lib/server/db/admin';
import { getUserById } from '$lib/server/db/users';
import { deleteUserCompletely } from '$lib/server/db/gdpr';
import { logActivity } from '$lib/server/db/activityLog';

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

/**
 * DELETE /api/admin/users/{id}
 * Мгновенное удаление пользователя из админки
 *
 * Требования:
 * - Текущий пользователь должен быть админом
 * - Удаляемый пользователь НЕ должен быть админом (сначала нужно снять права)
 * - Нельзя удалить самого себя
 *
 * Response:
 * - 200: { success: true }
 * - 400: Некорректный ID / попытка удалить себя / пользователь админ
 * - 401: Не авторизован
 * - 403: Нет прав админа
 * - 404: Пользователь не найден
 * - 500: Ошибка сервера
 */
export async function DELETE({
	params,
	locals,
	platform,
	getClientAddress,
}: {
	params: { id: string };
	locals: App.Locals;
	platform: App.Platform | undefined;
	getClientAddress: () => string;
}) {
	// Шаг 1: Проверка аутентификации
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
		// Шаг 2: Валидация userId
		const userId = parseInt(params.id);
		if (isNaN(userId)) {
			throw error(400, 'Некорректный ID пользователя');
		}

		// Нельзя удалить самого себя
		if (userId === locals.user.id) {
			throw error(400, 'Нельзя удалить самого себя');
		}

		// Шаг 3: Проверяем, что удаляемый пользователь НЕ админ
		const targetIsAdmin = await isAdmin(db, userId);
		if (targetIsAdmin) {
			throw error(400, 'Нельзя удалить администратора. Сначала снимите права админа.');
		}

		// Шаг 4: Получаем данные пользователя для логирования ПЕРЕД удалением
		const targetUser = await getUserById(db, userId);
		if (!targetUser) {
			throw error(404, 'Пользователь не найден');
		}

		// Определяем, посещал ли пользователь мероприятия
		// (есть хотя бы одна активная регистрация на прошедшее мероприятие)
		// Note: e.date is stored as datetime-local format (YYYY-MM-DDTHH:MM), need to normalize 'T' separator
		const attendedResult = await db
			.prepare(
				`
				SELECT COUNT(*) as count
				FROM registrations r
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.user_id = ?
				  AND r.cancelled_at IS NULL
				  AND datetime(replace(e.date, 'T', ' ')) <= datetime('now')
			`
			)
			.bind(userId)
			.first<{ count: number }>();

		const attendedAny = (attendedResult?.count ?? 0) > 0;

		// Шаг 5: Полное удаление пользователя
		await deleteUserCompletely(db, userId);

		// Шаг 6: Логируем удаление с минимальной информацией о пользователе
		await logActivity(
			db,
			locals.user.id,
			'user_deleted',
			JSON.stringify({
				targetUserId: userId,
				target: {
					first_name: targetUser.first_name,
					last_name: targetUser.last_name,
					email: targetUser.email,
					phone: targetUser.phone,
				},
				attendedAny,
			}),
			getClientAddress()
		);

		return json({ success: true });
	} catch (err: any) {
		console.error('[delete-user] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось удалить пользователя');
	}
}
