/**
 * API Endpoint: Make User Admin
 * Назначение пользователю прав администратора
 */

import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { addAdmin, isAdmin } from '$lib/server/db/admin';
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

		// Проверяем, не является ли пользователь уже администратором
		const targetIsAdmin = await isAdmin(db, userId);
		if (targetIsAdmin) {
			throw error(400, 'Пользователь уже является администратором');
		}

		// Добавляем пользователя в администраторы
		await addAdmin(db, userId, locals.user.id);

		// Логируем действие
		await logActivity(
			db,
			locals.user.id,
			'admin_add',
			JSON.stringify({
				targetUserId: userId,
				targetUserEmail: targetUser.email,
			}),
			getClientAddress()
		);

		return json({ success: true });
	} catch (err: any) {
		console.error('[make-admin] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось назначить администратора');
	}
}
