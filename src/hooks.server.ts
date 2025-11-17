import type { Handle } from '@sveltejs/kit';
import { ensureCsrfCookie } from '$lib/server/middleware/csrf';
import { getUserFromRequest } from '$lib/server/middleware/auth';
import { isAdmin } from '$lib/server/db/admin';

/**
 * Главный hook для обработки всех HTTP запросов
 *
 * Выполняет:
 * 1. Создание CSRF токенов для GET запросов
 * 2. Извлечение пользователя из JWT и заполнение event.locals.user
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Для всех GET запросов создаем/обновляем CSRF токен
	if (event.request.method === 'GET') {
		try {
			// Генерируем или получаем существующий CSRF токен
			const csrfToken = ensureCsrfCookie(event);

			// Сохраняем токен в locals для доступа в load функциях
			event.locals.csrfToken = csrfToken;
		} catch (error) {
			// Логируем ошибку, но не блокируем запрос
			console.error('Failed to ensure CSRF cookie:', error);
		}
	}

	// Извлекаем пользователя из JWT и заполняем event.locals.user
	try {
		const db = event.platform?.env?.DB;
		const jwtSecret = event.platform?.env?.JWT_SECRET;

		// Проверяем доступность необходимых зависимостей
		if (db && jwtSecret) {
			// Пытаемся получить пользователя из JWT токена
			const user = await getUserFromRequest(event.request, db, jwtSecret);

			if (user) {
				// Проверяем, является ли пользователь администратором
				const userIsAdmin = await isAdmin(db, user.id);

				// Заполняем event.locals.user согласно типу из App.Locals
				event.locals.user = {
					id: user.id,
					email: user.email,
					firstName: user.first_name,
					lastName: user.last_name,
					isAdmin: userIsAdmin,
				};
			}
		}
	} catch (error) {
		// Логируем ошибку, но не прерываем запрос
		// Пользователь останется неавторизованным (event.locals.user будет undefined)
		console.error('[hooks.server] Failed to extract user from request:', error);
	}

	// Продолжаем обработку запроса
	const response = await resolve(event);

	return response;
};
