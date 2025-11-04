import type { ServerLoad } from '@sveltejs/kit';

/**
 * Server-side load функция для страницы регистрации
 * Передает CSRF токен и Turnstile site key для защиты форм
 */
export const load: ServerLoad = async ({ locals, platform }) => {
	return {
		// CSRF токен для защиты формы регистрации
		csrfToken: locals.csrfToken,
		// Turnstile Site Key для клиентской защиты от ботов
		turnstileSiteKey: platform?.env.TURNSTILE_SITE_KEY || '',
	};
};
