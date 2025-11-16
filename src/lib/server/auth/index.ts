/**
 * Утилиты аутентификации
 *
 * Этот модуль предоставляет функции для:
 * - Хеширования и проверки паролей (bcryptjs)
 * - Генерации и проверки JWT токенов (jose + WebCrypto)
 * - Работы с auth cookies
 *
 * Используется в Cloudflare Workers окружении.
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// Константы
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_DAYS = 7;
const COOKIE_NAME = 'auth_token';
const JWT_ALGORITHM = 'HS256';

/**
 * Хеширует пароль с использованием bcrypt
 *
 * @param password - Пароль в открытом виде
 * @returns Promise с хешированным паролем
 * @throws Error если хеширование не удалось
 *
 * @example
 * const hash = await hashPassword('mySecurePassword123');
 */
export async function hashPassword(password: string): Promise<string> {
	try {
		const hash = await bcrypt.hash(password, SALT_ROUNDS);
		return hash;
	} catch (error) {
		throw new Error(
			`Ошибка хеширования пароля: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
		);
	}
}

/**
 * Проверяет соответствие пароля хешу
 *
 * @param password - Пароль в открытом виде
 * @param hash - Хеш пароля из базы данных
 * @returns Promise<boolean> - true если пароль совпадает
 *
 * @example
 * const isValid = await verifyPassword('myPassword', storedHash);
 * if (isValid) {
 *   // Пароль верный
 * }
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	try {
		const isMatch = await bcrypt.compare(password, hash);
		return isMatch;
	} catch (error) {
		// При ошибке проверки считаем пароль неверным
		console.error('Ошибка проверки пароля:', error);
		return false;
	}
}

/**
 * Генерирует JWT токен для пользователя
 *
 * Использует WebCrypto API (совместимо с Cloudflare Workers)
 * Токен действителен 7 дней
 *
 * @param userId - ID пользователя
 * @param email - Email пользователя
 * @param secret - Секретный ключ для подписи (из env)
 * @returns Promise с JWT токеном
 * @throws Error если генерация не удалась
 *
 * @example
 * const token = await generateToken(123, 'user@example.com', env.JWT_SECRET);
 */
export async function generateToken(
	userId: number,
	email: string,
	secret: string
): Promise<string> {
	try {
		// jose ожидает Uint8Array для секрета (не CryptoKey!)
		const secretKey = new TextEncoder().encode(secret);

		// Текущее время и время истечения
		const now = Math.floor(Date.now() / 1000);
		const exp = now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60; // 7 дней в секундах

		// Генерируем JWT
		const token = await new SignJWT({ userId, email })
			.setProtectedHeader({ alg: JWT_ALGORITHM })
			.setIssuedAt(now)
			.setExpirationTime(exp)
			.sign(secretKey);

		return token;
	} catch (error) {
		throw new Error(
			`Ошибка генерации токена: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
		);
	}
}

/**
 * Проверяет и декодирует JWT токен
 *
 * @param token - JWT токен для проверки
 * @param secret - Секретный ключ (должен совпадать с тем, что использовался при генерации)
 * @returns Promise с данными пользователя или null если токен невалидный/просрочен
 *
 * @example
 * const payload = await verifyToken(token, env.JWT_SECRET);
 * if (payload) {
 *   console.log('User ID:', payload.userId);
 * }
 */
export async function verifyToken(
	token: string,
	secret: string
): Promise<{ userId: number; email: string } | null> {
	try {
		// jose ожидает Uint8Array для секрета (не CryptoKey!)
		const secretKey = new TextEncoder().encode(secret);

		// Проверяем и декодируем токен
		const { payload } = await jwtVerify(token, secretKey);

		// Валидируем структуру payload
		if (typeof payload.userId === 'number' && typeof payload.email === 'string') {
			return {
				userId: payload.userId,
				email: payload.email,
			};
		}

		// Payload не содержит нужных полей
		return null;
	} catch (error) {
		// Токен невалидный или просрочен - возвращаем null, не бросаем ошибку
		console.error('Ошибка проверки токена:', error instanceof Error ? error.message : error);
		return null;
	}
}

/**
 * Извлекает JWT токен из cookie запроса
 *
 * @param request - Объект Request
 * @returns Токен или null если не найден
 *
 * @example
 * const token = extractTokenFromRequest(request);
 * if (token) {
 *   const payload = await verifyToken(token, env.JWT_SECRET);
 * }
 */
export function extractTokenFromRequest(request: Request): string | null {
	try {
		const cookieHeader = request.headers.get('Cookie');
		if (!cookieHeader) {
			return null;
		}

		// Парсим cookies
		const cookies = cookieHeader.split(';').reduce(
			(acc, cookie) => {
				const [key, value] = cookie.trim().split('=');
				if (key && value) {
					acc[key] = value;
				}
				return acc;
			},
			{} as Record<string, string>
		);

		return cookies[COOKIE_NAME] || null;
	} catch (error) {
		console.error('Ошибка извлечения токена из cookies:', error);
		return null;
	}
}

/**
 * Генерирует Set-Cookie header для установки auth токена
 *
 * Cookie настроены для максимальной безопасности:
 * - httpOnly: true (недоступно из JavaScript)
 * - secure: configurable (только HTTPS в production)
 * - sameSite: strict (защита от CSRF)
 * - maxAge: 7 дней
 *
 * @param token - JWT токен для сохранения
 * @param secure - Использовать Secure флаг (по умолчанию true для production)
 * @returns Строка для Set-Cookie header
 *
 * @example
 * // Production (Cloudflare Workers)
 * return new Response('OK', {
 *   headers: { 'Set-Cookie': setAuthCookie(token, true) }
 * });
 *
 * // Development (локальный HTTP)
 * return new Response('OK', {
 *   headers: { 'Set-Cookie': setAuthCookie(token, false) }
 * });
 */
export function setAuthCookie(token: string, secure = true): string {
	const maxAge = TOKEN_EXPIRY_DAYS * 24 * 60 * 60; // 7 дней в секундах

	const cookieParts = [
		`${COOKIE_NAME}=${token}`,
		'Path=/',
		`Max-Age=${maxAge}`,
		'HttpOnly',
		'SameSite=Strict',
	];

	// Добавляем Secure только если указано
	if (secure) {
		cookieParts.push('Secure');
	}

	return cookieParts.join('; ');
}

/**
 * Генерирует Set-Cookie header для удаления auth токена
 *
 * Используется при logout
 *
 * @param secure - Использовать Secure флаг (по умолчанию true для production)
 * @returns Строка для Set-Cookie header
 *
 * @example
 * // Production
 * return new Response('Logged out', {
 *   headers: { 'Set-Cookie': clearAuthCookie(true) }
 * });
 *
 * // Development
 * return new Response('Logged out', {
 *   headers: { 'Set-Cookie': clearAuthCookie(false) }
 * });
 */
export function clearAuthCookie(secure = true): string {
	const cookieParts = [`${COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'];

	// Добавляем Secure только если указано
	if (secure) {
		cookieParts.push('Secure');
	}

	return cookieParts.join('; ');
}
