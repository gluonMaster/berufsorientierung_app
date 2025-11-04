import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * Генерирует криптографически безопасный CSRF токен
 * @returns base64url строка длиной 32 байта
 */
export function generateCsrfToken(): string {
	// Генерируем 32 случайных байта
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	// Конвертируем в base64url (безопасно для URL и форм)
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

/**
 * Обеспечивает наличие CSRF cookie и возвращает токен
 * Создает новый токен если cookie отсутствует или истек
 * @param event RequestEvent из SvelteKit
 * @returns CSRF токен
 */
export function ensureCsrfCookie(event: RequestEvent): string {
	const existingToken = event.cookies.get('csrf_token');

	// Если токен есть и он валидный (32+ символов base64url), используем его
	if (existingToken && existingToken.length >= 43) {
		return existingToken;
	}

	// Генерируем новый токен
	const newToken = generateCsrfToken();

	// Устанавливаем cookie с безопасными флагами
	event.cookies.set('csrf_token', newToken, {
		path: '/',
		maxAge: 7200, // 2 часа
		sameSite: 'lax',
		secure: !dev, // HTTPS в продакшене, HTTP в разработке
		httpOnly: true, // Защита от XSS
	});

	return newToken;
}

/**
 * Проверяет CSRF токен из запроса против cookie
 * Поддерживает токен из:
 * 1. Заголовка X-CSRF-Token
 * 2. JSON поля csrfToken
 * 3. Form поля _csrf
 * @param event RequestEvent из SvelteKit
 * @throws Error с кодом 403 при невалидном токене
 */
export async function verifyCsrf(event: RequestEvent): Promise<void> {
	const cookieToken = event.cookies.get('csrf_token');

	// Проверяем наличие токена в cookie
	if (!cookieToken) {
		throw new Error('CSRF cookie not found', { cause: { status: 403 } });
	}

	let requestToken: string | undefined;

	// 1. Проверяем заголовок X-CSRF-Token (для fetch запросов)
	requestToken = event.request.headers.get('X-CSRF-Token') || undefined;

	// 2. Если заголовка нет, проверяем тело запроса
	if (!requestToken) {
		const contentType = event.request.headers.get('content-type') || '';

		if (contentType.includes('application/json')) {
			// JSON запрос - ищем поле csrfToken
			try {
				const body = await event.request.clone().json();
				requestToken = body?.csrfToken;
			} catch {
				// Игнорируем ошибки парсинга JSON
			}
		} else if (
			contentType.includes('application/x-www-form-urlencoded') ||
			contentType.includes('multipart/form-data')
		) {
			// Form запрос - ищем поле _csrf
			try {
				const formData = await event.request.clone().formData();
				requestToken = formData.get('_csrf')?.toString();
			} catch {
				// Игнорируем ошибки парсинга FormData
			}
		}
	}

	// Проверяем наличие токена в запросе
	if (!requestToken) {
		throw new Error('CSRF token not provided', { cause: { status: 403 } });
	}

	// Сравниваем токены (constant-time для защиты от timing attacks)
	if (!constantTimeEqual(cookieToken, requestToken)) {
		throw new Error('Invalid CSRF token', { cause: { status: 403 } });
	}
}

/**
 * Безопасное сравнение строк в постоянном времени
 * Защищает от timing attacks при проверке токенов
 * @param a Первая строка
 * @param b Вторая строка
 * @returns true если строки идентичны
 */
function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}
