import type { Handle } from '@sveltejs/kit';
import { ensureCsrfCookie } from '$lib/server/middleware/csrf';

/**
 * Главный hook для обработки всех HTTP запросов
 * Автоматически создает CSRF токены для GET запросов
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

	// Продолжаем обработку запроса
	const response = await resolve(event);

	return response;
};
