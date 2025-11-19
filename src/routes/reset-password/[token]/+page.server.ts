import type { ServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { hashPasswordResetToken } from '$lib/server/auth/passwordResetToken';

/**
 * Server-side load функция для страницы сброса пароля по токену
 *
 * Валидирует токен из URL и проверяет его срок действия:
 * - Получает токен из params.token
 * - Хеширует токен через SHA-256
 * - Ищет пользователя по хешу токена в БД (эффективный SQL-запрос)
 * - Проверяет, что password_reset_expires_at ещё в будущем
 * - Если токен невалиден/просрочен - возвращает флаг invalidToken: true
 * - Если токен валиден - передает CSRF токен и Turnstile site key для формы
 *
 * ВАЖНО: Мы не раскрываем причину невалидности токена (безопасность)
 */
export const load: ServerLoad = async ({ locals, platform, params }) => {
	const db = getDB(platform);
	const { token } = params;

	// Базовая структура ответа
	const baseResponse = {
		csrfToken: locals.csrfToken,
		turnstileSiteKey: platform?.env.TURNSTILE_SITE_KEY || '',
	};

	// Если токен пустой - сразу возвращаем как невалидный
	if (!token || token.trim().length === 0) {
		return {
			...baseResponse,
			invalidToken: true,
		};
	}

	try {
		// Хешируем токен через SHA-256 для поиска в БД
		const tokenHash = await hashPasswordResetToken(token);

		// Ищем пользователя по хешу токена (эффективный запрос с индексом)
		const foundUser = await db
			.prepare(
				`SELECT id, password_reset_expires_at
				 FROM users
				 WHERE password_reset_token_hash = ?
				   AND password_reset_expires_at IS NOT NULL
				 LIMIT 1`
			)
			.bind(tokenHash)
			.first<{ id: number; password_reset_expires_at: string }>();

		// Если пользователь не найден - токен невалиден
		if (!foundUser) {
			return {
				...baseResponse,
				invalidToken: true,
			};
		}

		// Проверяем срок действия токена
		const expiresAt = new Date(foundUser.password_reset_expires_at);
		const now = new Date();

		if (expiresAt <= now) {
			// Токен просрочен
			return {
				...baseResponse,
				invalidToken: true,
			};
		}

		// Токен валиден
		return {
			...baseResponse,
			invalidToken: false,
		};
	} catch (error) {
		console.error('Error validating password reset token:', error);

		// При любой ошибке возвращаем invalidToken: true (не раскрываем детали)
		return {
			...baseResponse,
			invalidToken: true,
		};
	}
};
