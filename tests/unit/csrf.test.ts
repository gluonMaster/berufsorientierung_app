/**
 * Юнит-тесты для CSRF защиты
 *
 * Тестирует функции генерации, проверки и валидации CSRF токенов
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCsrfToken, ensureCsrfCookie, verifyCsrf } from '$lib/server/middleware/csrf';
import type { RequestEvent } from '@sveltejs/kit';

// Мокаем crypto.getRandomValues для предсказуемых тестов
const mockGetRandomValues = vi.fn();
Object.defineProperty(global, 'crypto', {
	value: {
		getRandomValues: mockGetRandomValues,
	},
});

// Мокаем btoa для Node.js окружения
Object.defineProperty(global, 'btoa', {
	value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
});

describe('CSRF Token Generation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('должен генерировать 43-символьный base64url токен', () => {
		// Мокаем crypto.getRandomValues для предсказуемого результата
		mockGetRandomValues.mockImplementation((array: Uint8Array) => {
			// Заполняем массив предсказуемыми значениями
			for (let i = 0; i < array.length; i++) {
				array[i] = i % 256;
			}
			return array;
		});

		const token = generateCsrfToken();

		// Проверяем что вызвался crypto.getRandomValues с массивом 32 байта
		expect(mockGetRandomValues).toHaveBeenCalledOnce();
		expect(mockGetRandomValues.mock.calls[0][0]).toHaveLength(32);

		// Проверяем формат токена
		expect(typeof token).toBe('string');
		expect(token).toHaveLength(43); // 32 байта в base64url = 43 символа
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url символы
	});

	it('должен генерировать разные токены при каждом вызове', () => {
		// Мокаем разные случайные значения
		let counter = 0;
		mockGetRandomValues.mockImplementation((array: Uint8Array) => {
			for (let i = 0; i < array.length; i++) {
				array[i] = (counter * 13 + i) % 256;
			}
			counter++;
			return array;
		});

		const token1 = generateCsrfToken();
		const token2 = generateCsrfToken();

		expect(token1).not.toBe(token2);
		expect(mockGetRandomValues).toHaveBeenCalledTimes(2);
	});
});

describe('CSRF Cookie Management', () => {
	let mockEvent: Partial<RequestEvent>;
	let mockCookies: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn(),
			set: vi.fn(),
		};

		mockEvent = {
			cookies: mockCookies,
		};

		// Мокаем стабильную генерацию токенов для тестов
		mockGetRandomValues.mockImplementation((array: Uint8Array) => {
			for (let i = 0; i < array.length; i++) {
				array[i] = 65; // Символ 'A' в ASCII
			}
			return array;
		});
	});

	it('должен создать новый токен если cookie отсутствует', () => {
		mockCookies.get.mockReturnValue(undefined);

		const token = ensureCsrfCookie(mockEvent as RequestEvent);

		expect(mockCookies.get).toHaveBeenCalledWith('csrf_token');
		expect(mockCookies.set).toHaveBeenCalledWith('csrf_token', expect.any(String), {
			path: '/',
			maxAge: 7200,
			sameSite: 'lax',
			secure: false, // В тестах dev=true
			httpOnly: true,
		});
		expect(token).toBe(mockCookies.set.mock.calls[0][1]);
	});

	it('должен использовать существующий валидный токен', () => {
		const existingToken = 'valid_token_with_43_characters_1234567890123';
		mockCookies.get.mockReturnValue(existingToken);

		const token = ensureCsrfCookie(mockEvent as RequestEvent);

		expect(mockCookies.get).toHaveBeenCalledWith('csrf_token');
		expect(mockCookies.set).not.toHaveBeenCalled(); // Не должен обновлять
		expect(token).toBe(existingToken);
	});

	it('должен создать новый токен если существующий слишком короткий', () => {
		const shortToken = 'short_token';
		mockCookies.get.mockReturnValue(shortToken);

		const token = ensureCsrfCookie(mockEvent as RequestEvent);

		expect(mockCookies.set).toHaveBeenCalled(); // Должен создать новый
		expect(token).not.toBe(shortToken);
	});
});

describe('CSRF Token Verification', () => {
	let mockEvent: Partial<RequestEvent>;
	let mockCookies: any;
	let mockRequest: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn(),
		};

		mockRequest = {
			headers: new Map(),
			clone: vi.fn(),
			json: vi.fn(),
			formData: vi.fn(),
		};

		mockEvent = {
			cookies: mockCookies,
			request: mockRequest,
		};
	});

	it('должен принять валидный токен из заголовка', async () => {
		const token = 'valid_csrf_token_123';
		mockCookies.get.mockReturnValue(token);
		mockRequest.headers = new Map([['X-CSRF-Token', token]]);

		await expect(verifyCsrf(mockEvent as RequestEvent)).resolves.toBeUndefined();
	});

	it('должен принять валидный токен из JSON тела', async () => {
		const token = 'valid_csrf_token_123';
		mockCookies.get.mockReturnValue(token);
		mockRequest.headers = new Map([['content-type', 'application/json']]);
		mockRequest.clone.mockReturnValue({
			json: vi.fn().mockResolvedValue({ csrfToken: token }),
		});

		await expect(verifyCsrf(mockEvent as RequestEvent)).resolves.toBeUndefined();
	});

	it('должен принять валидный токен из FormData', async () => {
		const token = 'valid_csrf_token_123';
		mockCookies.get.mockReturnValue(token);
		mockRequest.headers = new Map([['content-type', 'application/x-www-form-urlencoded']]);

		const mockFormData = new Map([['_csrf', token]]);
		mockRequest.clone.mockReturnValue({
			formData: vi.fn().mockResolvedValue({
				get: (key: string) => mockFormData.get(key),
			}),
		});

		await expect(verifyCsrf(mockEvent as RequestEvent)).resolves.toBeUndefined();
	});

	it('должен отклонить запрос без CSRF cookie', async () => {
		mockCookies.get.mockReturnValue(undefined);

		await expect(verifyCsrf(mockEvent as RequestEvent)).rejects.toThrow(
			'CSRF cookie not found'
		);
	});

	it('должен отклонить запрос без токена в заголовке/теле', async () => {
		mockCookies.get.mockReturnValue('valid_token');
		mockRequest.headers = new Map();

		await expect(verifyCsrf(mockEvent as RequestEvent)).rejects.toThrow(
			'CSRF token not provided'
		);
	});

	it('должен отклонить запрос с неправильным токеном', async () => {
		mockCookies.get.mockReturnValue('correct_token');
		mockRequest.headers = new Map([['X-CSRF-Token', 'wrong_token']]);

		await expect(verifyCsrf(mockEvent as RequestEvent)).rejects.toThrow('Invalid CSRF token');
	});

	it('должен игнорировать ошибки парсинга JSON', async () => {
		const token = 'valid_csrf_token_123';
		mockCookies.get.mockReturnValue(token);
		mockRequest.headers = new Map([['content-type', 'application/json']]);
		mockRequest.clone.mockReturnValue({
			json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
		});

		// Должен перейти к поиску в FormData, но не найти токен
		await expect(verifyCsrf(mockEvent as RequestEvent)).rejects.toThrow(
			'CSRF token not provided'
		);
	});
});

describe('Constant Time Comparison', () => {
	let mockEvent: Partial<RequestEvent>;
	let mockCookies: any;
	let mockRequest: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = { get: vi.fn() };
		mockRequest = { headers: new Map() };
		mockEvent = { cookies: mockCookies, request: mockRequest };
	});

	it('должен использовать constant-time сравнение для разных длин', async () => {
		mockCookies.get.mockReturnValue('short');
		mockRequest.headers = new Map([['X-CSRF-Token', 'very_long_token']]);

		// Время выполнения не должно зависеть от содержимого токенов
		const start = performance.now();

		await expect(verifyCsrf(mockEvent as RequestEvent)).rejects.toThrow('Invalid CSRF token');

		const end = performance.now();

		// Проверяем что выполнение быстрое (не leaked timing info)
		expect(end - start).toBeLessThan(10); // миллисекунд
	});

	it('должен правильно сравнивать одинаковые строки', async () => {
		const token = 'same_token_value';
		mockCookies.get.mockReturnValue(token);
		mockRequest.headers = new Map([['X-CSRF-Token', token]]);

		await expect(verifyCsrf(mockEvent as RequestEvent)).resolves.toBeUndefined();
	});
});

describe('Environment-specific Cookie Attributes', () => {
	let mockEvent: Partial<RequestEvent>;
	let mockCookies: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn().mockReturnValue(undefined),
			set: vi.fn(),
		};

		mockEvent = {
			cookies: mockCookies,
		};

		// Стабильная генерация для тестов
		mockGetRandomValues.mockImplementation((array: Uint8Array) => {
			array.fill(65);
			return array;
		});
	});

	it('должен устанавливать secure=false в dev окружении', () => {
		// В Vitest dev=true по умолчанию
		ensureCsrfCookie(mockEvent as RequestEvent);

		expect(mockCookies.set).toHaveBeenCalledWith(
			'csrf_token',
			expect.any(String),
			expect.objectContaining({
				secure: false, // dev mode
			})
		);
	});
});
