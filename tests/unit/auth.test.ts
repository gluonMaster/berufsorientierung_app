/**
 * Unit тесты для модуля аутентификации
 *
 * Тестируются:
 * - Хеширование и проверка паролей
 * - Генерация и проверка JWT токенов
 * - Работа с cookies
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { decodeJwt } from 'jose';
import {
	hashPassword,
	verifyPassword,
	generateToken,
	verifyToken,
	extractTokenFromRequest,
	setAuthCookie,
	clearAuthCookie,
} from '../../src/lib/server/auth';

// Тестовые данные
const TEST_PASSWORD = 'SecurePassword123!';
const TEST_USER_ID = 42;
const TEST_EMAIL = 'test@example.com';
const TEST_SECRET = 'test-jwt-secret-key-minimum-32-chars';

describe('Auth Utils - Password Hashing', () => {
	it('должен хешировать пароль', async () => {
		const hash = await hashPassword(TEST_PASSWORD);

		expect(hash).toBeDefined();
		expect(typeof hash).toBe('string');
		expect(hash.length).toBeGreaterThan(0);
		expect(hash).not.toBe(TEST_PASSWORD); // Хеш не должен совпадать с паролем
	});

	it('должен создавать разные хеши для одного пароля (salt)', async () => {
		const hash1 = await hashPassword(TEST_PASSWORD);
		const hash2 = await hashPassword(TEST_PASSWORD);

		expect(hash1).not.toBe(hash2); // Разные хеши из-за разных salt
	});

	it('должен проверять правильный пароль', async () => {
		const hash = await hashPassword(TEST_PASSWORD);
		const isValid = await verifyPassword(TEST_PASSWORD, hash);

		expect(isValid).toBe(true);
	});

	it('должен отклонять неправильный пароль', async () => {
		const hash = await hashPassword(TEST_PASSWORD);
		const isValid = await verifyPassword('WrongPassword123', hash);

		expect(isValid).toBe(false);
	});

	it('должен обрабатывать пустые пароли', async () => {
		const hash = await hashPassword('');
		const isValid = await verifyPassword('', hash);

		expect(isValid).toBe(true);
	});

	it('должен возвращать false при невалидном хеше', async () => {
		const isValid = await verifyPassword(TEST_PASSWORD, 'invalid-hash');

		expect(isValid).toBe(false);
	});
});

describe('Auth Utils - JWT Tokens', () => {
	it('должен генерировать JWT токен', async () => {
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);

		expect(token).toBeDefined();
		expect(typeof token).toBe('string');
		expect(token.split('.').length).toBe(3); // JWT формат: header.payload.signature
	});

	it('должен проверять валидный токен', async () => {
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);
		const payload = await verifyToken(token, TEST_SECRET);

		expect(payload).not.toBeNull();
		expect(payload?.userId).toBe(TEST_USER_ID);
		expect(payload?.email).toBe(TEST_EMAIL);
	});

	it('должен возвращать null для невалидного токена', async () => {
		const payload = await verifyToken('invalid.token.here', TEST_SECRET);

		expect(payload).toBeNull();
	});

	it('должен возвращать null для токена с неправильным секретом', async () => {
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);
		const payload = await verifyToken(token, 'wrong-secret-key-minimum-32-chars');

		expect(payload).toBeNull();
	});

	it('должен генерировать идентичные токены при одинаковых данных в одну секунду', async () => {
		// JWT использует iat с точностью до секунды, поэтому токены в рамках одной секунды будут идентичными
		const token1 = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);
		const token2 = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);

		// Токены идентичны, так как созданы в одну секунду с одинаковыми данными
		expect(token1).toBe(token2);
	});

	it('должен генерировать разные токены для разных пользователей', async () => {
		const token1 = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);
		const token2 = await generateToken(999, 'other@example.com', TEST_SECRET);

		expect(token1).not.toBe(token2);
	});

	it('должен включать iat и exp в токен', async () => {
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);

		// Декодируем payload без проверки подписи используя jose
		const payload = decodeJwt(token);

		expect(payload.iat).toBeDefined();
		expect(payload.exp).toBeDefined();
		expect(payload.exp).toBeGreaterThan(payload.iat!);
	});

	it('должен использовать алгоритм HS256', async () => {
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);

		// Декодируем заголовок токена
		const [headerBase64] = token.split('.');
		const header = JSON.parse(atob(headerBase64));

		// jose использует алгоритм HS256
		expect(header.alg).toBe('HS256');
		// Поле typ опционально в jose и может отсутствовать
	});

	it('должен устанавливать exp на 7 дней вперёд', async () => {
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);
		const payload = decodeJwt(token);

		const expectedExpiry = payload.iat! + 7 * 24 * 60 * 60; // 7 дней в секундах
		expect(payload.exp).toBe(expectedExpiry);
	});

	it('должен отклонять истёкший токен', async () => {
		// Создаём токен с истёкшим сроком (exp в прошлом)
		// Для этого нужно создать токен вручную с устаревшим exp
		const { SignJWT } = await import('jose');

		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(TEST_SECRET),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		const now = Math.floor(Date.now() / 1000);
		const expiredTime = now - 3600; // 1 час назад

		const expiredToken = await new SignJWT({ userId: TEST_USER_ID, email: TEST_EMAIL })
			.setProtectedHeader({ alg: 'HS256' })
			.setIssuedAt(expiredTime - 86400) // Выпущен 1 день назад
			.setExpirationTime(expiredTime) // Истёк 1 час назад
			.sign(key);

		// Пытаемся проверить истёкший токен
		const payload = await verifyToken(expiredToken, TEST_SECRET);

		expect(payload).toBeNull(); // Токен должен быть отклонён
	});
});

describe('Auth Utils - Cookie Management', () => {
	it('должен извлекать токен из cookie', () => {
		const testToken = 'test.jwt.token';
		const request = new Request('https://example.com', {
			headers: {
				Cookie: `auth_token=${testToken}`,
			},
		});

		const token = extractTokenFromRequest(request);

		expect(token).toBe(testToken);
	});

	it('должен возвращать null если cookie нет', () => {
		const request = new Request('https://example.com');

		const token = extractTokenFromRequest(request);

		expect(token).toBeNull();
	});

	it('должен извлекать токен из множественных cookies', () => {
		const testToken = 'test.jwt.token';
		const request = new Request('https://example.com', {
			headers: {
				Cookie: `other_cookie=value1; auth_token=${testToken}; another=value2`,
			},
		});

		const token = extractTokenFromRequest(request);

		expect(token).toBe(testToken);
	});

	it('должен возвращать null если auth_token отсутствует среди других cookies', () => {
		const request = new Request('https://example.com', {
			headers: {
				Cookie: `other_cookie=value1; another=value2`,
			},
		});

		const token = extractTokenFromRequest(request);

		expect(token).toBeNull();
	});

	it('должен генерировать Set-Cookie header для установки токена', () => {
		const testToken = 'test.jwt.token';
		const cookie = setAuthCookie(testToken);

		expect(cookie).toContain('auth_token=');
		expect(cookie).toContain(testToken);
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Strict');
		expect(cookie).toContain('Path=/');
		expect(cookie).toContain('Max-Age=');
		expect(cookie).toContain('Secure'); // По умолчанию secure=true
	});

	it('должен генерировать Set-Cookie header без Secure флага для dev', () => {
		const testToken = 'test.jwt.token';
		const cookie = setAuthCookie(testToken, false);

		expect(cookie).toContain('auth_token=');
		expect(cookie).toContain(testToken);
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Strict');
		expect(cookie).not.toContain('Secure'); // Secure отключен
	});

	it('должен генерировать Set-Cookie header для очистки токена', () => {
		const cookie = clearAuthCookie();

		expect(cookie).toContain('auth_token=');
		expect(cookie).toContain('Max-Age=0');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Strict');
		expect(cookie).toContain('Path=/');
		expect(cookie).toContain('Secure'); // По умолчанию secure=true
	});

	it('должен генерировать Set-Cookie header для очистки токена без Secure для dev', () => {
		const cookie = clearAuthCookie(false);

		expect(cookie).toContain('auth_token=');
		expect(cookie).toContain('Max-Age=0');
		expect(cookie).not.toContain('Secure'); // Secure отключен
	});
});

describe('Auth Utils - Integration Tests', () => {
	it('должен работать полный цикл: хеширование -> проверка -> генерация токена -> проверка токена', async () => {
		// 1. Хешируем пароль (как при регистрации)
		const hash = await hashPassword(TEST_PASSWORD);

		// 2. Проверяем пароль (как при логине)
		const isPasswordValid = await verifyPassword(TEST_PASSWORD, hash);
		expect(isPasswordValid).toBe(true);

		// 3. Генерируем токен после успешного логина
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);
		expect(token).toBeDefined();

		// 4. Создаём request с токеном в cookie
		const request = new Request('https://example.com', {
			headers: {
				Cookie: setAuthCookie(token),
			},
		});

		// 5. Извлекаем токен из request
		const extractedToken = extractTokenFromRequest(request);
		expect(extractedToken).toBe(token);

		// 6. Проверяем токен
		const payload = await verifyToken(extractedToken!, TEST_SECRET);
		expect(payload).not.toBeNull();
		expect(payload?.userId).toBe(TEST_USER_ID);
		expect(payload?.email).toBe(TEST_EMAIL);
	});

	it('должен работать полный цикл logout', async () => {
		// 1. Генерируем токен
		const token = await generateToken(TEST_USER_ID, TEST_EMAIL, TEST_SECRET);

		// 2. Устанавливаем cookie
		const setCookie = setAuthCookie(token);
		expect(setCookie).toContain(token);

		// 3. Очищаем cookie
		const clearCookie = clearAuthCookie();
		expect(clearCookie).toContain('Max-Age=0');
		expect(clearCookie).not.toContain(token);
	});
});
