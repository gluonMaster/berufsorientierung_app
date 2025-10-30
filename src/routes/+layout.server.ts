/**
 * Root Layout Server Load
 * Загружает данные текущего пользователя для всех страниц приложения
 */

import type { LayoutServerLoad } from './$types';
import type { User } from '$lib/types';
import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';
import { getUserById } from '$lib/server/db/users';
import { isAdmin } from '$lib/server/db/admin';

/**
 * Тип данных, возвращаемых layout
 */
type RootLayoutData = {
	user: (User & { isAdmin: boolean }) | null;
};

/**
 * Load функция для корневого layout
 * Проверяет авторизацию пользователя и возвращает его данные
 * НЕ редиректит неавторизованных - это публичное приложение
 */
export const load: LayoutServerLoad = async ({ request, platform }) => {
	// Извлекаем токен из cookies
	const token = extractTokenFromRequest(request);

	// Если токена нет - возвращаем null user
	if (!token) {
		return {
			user: null,
		} satisfies RootLayoutData;
	}

	try {
		// Проверяем JWT токен
		const jwtSecret = platform?.env?.JWT_SECRET;
		if (!jwtSecret) {
			console.error('JWT_SECRET не настроен');
			return { user: null } satisfies RootLayoutData;
		}

		const payload = await verifyToken(token, jwtSecret);
		if (!payload) {
			// Токен невалидный или просрочен
			return { user: null } satisfies RootLayoutData;
		}

		// Получаем полные данные пользователя из БД
		const db = platform?.env?.DB;
		if (!db) {
			console.error('DB не настроена');
			return { user: null } satisfies RootLayoutData;
		}

		const user = await getUserById(db, payload.userId);
		if (!user) {
			// Пользователь не найден (возможно удалён)
			return { user: null } satisfies RootLayoutData;
		}

		// Проверяем заблокирован ли пользователь
		if (user.is_blocked) {
			// Пользователь заблокирован - не возвращаем данные
			return { user: null } satisfies RootLayoutData;
		}

		// Проверяем является ли пользователь админом
		const userIsAdmin = await isAdmin(db, user.id);

		// Возвращаем данные пользователя с флагом admin
		return {
			user: {
				...user,
				isAdmin: userIsAdmin,
			},
		} satisfies RootLayoutData;
	} catch (error) {
		// При любой ошибке возвращаем null user
		console.error('Ошибка загрузки данных пользователя:', error);
		return {
			user: null,
		} satisfies RootLayoutData;
	}
};
