/**
 * API Endpoint: Remove Admin Rights
 * Удаление прав администратора у пользователя
 */

import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { removeAdmin, isAdmin, getAdminByUserId } from '$lib/server/db/admin';
import { getUserById } from '$lib/server/db/users';
import { logActivity } from '$lib/server/db/activityLog';

export async function POST({
	request,
	locals,
	platform,
	getClientAddress,
}: {
	request: Request;
	locals: App.Locals;
	platform: App.Platform | undefined;
	getClientAddress: () => string;
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
		// Получаем данные из запроса
		const { userId } = await request.json();

		if (!userId || typeof userId !== 'number') {
			throw error(400, 'Некорректный ID пользователя');
		}

		// Проверяем существование пользователя
		const targetUser = await getUserById(db, userId);
		if (!targetUser) {
			throw error(404, 'Пользователь не найден');
		}

		// Проверяем, является ли пользователь администратором
		const adminData = await getAdminByUserId(db, userId);
		if (!adminData) {
			throw error(400, 'Пользователь не является администратором');
		}

		// Проверяем, не является ли это superadmin (created_by IS NULL)
		if (adminData.created_by === null) {
			throw error(403, 'Нельзя удалить права у superadmin');
		}

		// Проверяем, не пытается ли админ удалить сам себя
		if (userId === locals.user.id) {
			throw error(403, 'Нельзя удалить права у самого себя');
		}

		// Удаляем права администратора
		await removeAdmin(db, userId);

		// Логируем действие
		await logActivity(
			db,
			locals.user.id,
			'admin_remove',
			JSON.stringify({
				targetUserId: userId,
				targetUserEmail: targetUser.email,
			}),
			getClientAddress()
		);

		return json({ success: true });
	} catch (err: any) {
		console.error('[remove-admin] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось удалить права администратора');
	}
}
