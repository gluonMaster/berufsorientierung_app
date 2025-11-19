/**
 * Password Reset Token Utilities
 *
 * Универсальные хелперы для работы с токенами сброса пароля.
 * Используют Web Crypto API (совместимо с Cloudflare Workers).
 *
 * Алгоритмы:
 * - Генерация: crypto.getRandomValues() → base64url кодирование (безопасно для URL)
 * - Хеширование: SHA-256 → hex строка (для хранения в БД)
 *
 * ВАЖНО: Не используйте bcrypt для токенов - SHA-256 достаточно,
 * так как сами токены уже криптографически стойкие (32 байта случайных данных).
 */

/**
 * Генерация криптографически стойкого токена для сброса пароля
 *
 * Использует Web Crypto API для генерации случайных байтов,
 * затем конвертирует в base64url формат (безопасный для URL).
 *
 * @param length - Длина токена в байтах (по умолчанию 32 байта = ~43 символа base64url)
 * @returns Токен в виде base64url строки (без padding символов =)
 *
 * @example
 * const token = generatePasswordResetToken(32);
 * // Результат: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1"
 */
export function generatePasswordResetToken(length: number = 32): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);

	// Конвертируем в base64url (безопасный для URL формат)
	// base64url использует - и _ вместо + и /, и убирает padding (=)
	const base64 = btoa(String.fromCharCode(...bytes));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Хеширование токена через SHA-256 для хранения в БД
 *
 * Использует Web Crypto API для совместимости с Cloudflare Workers.
 * Результат - hex строка (64 символа для SHA-256).
 *
 * @param token - Исходный токен (строка в base64url формате)
 * @returns Hex строка хеша SHA-256 (64 символа)
 *
 * @example
 * const hash = await hashPasswordResetToken("a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6");
 * // Результат: "abc123def456..." (64 символа hex)
 */
export async function hashPasswordResetToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверка токена сброса пароля
 *
 * Хеширует предоставленный токен и сравнивает с хешем из БД.
 * Используйте эту функцию вместо bcrypt verifyPassword для токенов сброса.
 *
 * @param token - Токен из URL (в открытом виде)
 * @param storedHash - Хеш токена из БД (SHA-256 hex строка)
 * @returns true если токен совпадает с хешем, false в противном случае
 *
 * @example
 * const isValid = await verifyPasswordResetToken(token, user.password_reset_token_hash);
 * if (isValid) {
 *   // Токен валиден, можно сбросить пароль
 * }
 */
export async function verifyPasswordResetToken(
	token: string,
	storedHash: string
): Promise<boolean> {
	const tokenHash = await hashPasswordResetToken(token);
	return tokenHash === storedHash;
}
