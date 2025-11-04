import type { ServerLoad } from '@sveltejs/kit';

/**
 * Server-side load функция для страницы регистрации
 * Передает CSRF токен для защиты форм
 */
export const load: ServerLoad = async ({ locals }) => {
	return {
		// CSRF токен для защиты формы регистрации
		csrfToken: locals.csrfToken,
	};
};
