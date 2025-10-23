import { dev } from '$app/environment';

/**
 * Middleware для унифицированной обработки ошибок
 *
 * Предоставляет:
 * - Типизированные ошибки приложения (AppError)
 * - Создание ошибок с кодами и деталями
 * - Централизованную обработку ошибок для API
 * - Логирование для Cloudflare Workers
 */

/**
 * Расширенный интерфейс ошибки приложения
 * Включает HTTP статус, код ошибки и дополнительные детали
 */
export interface AppError extends Error {
	/** HTTP статус код (400, 401, 404, 500 и т.д.) */
	status?: number;
	/** Код ошибки для клиента (например, 'USER_NOT_FOUND', 'VALIDATION_ERROR') */
	code?: string;
	/** Дополнительные данные об ошибке (валидационные ошибки, метаданные) */
	details?: unknown;
}

/**
 * Создаёт типизированную ошибку приложения
 *
 * @param status - HTTP статус код
 * @param message - Сообщение об ошибке (будет отправлено клиенту)
 * @param code - Опциональный код ошибки для программной обработки на клиенте
 * @param details - Опциональные дополнительные данные (например, поля валидации)
 * @returns Объект AppError с заполненными полями
 *
 * @example
 * ```typescript
 * throw createError(404, 'User not found', 'USER_NOT_FOUND', { userId: 123 });
 * throw createError(400, 'Invalid email', 'VALIDATION_ERROR', { field: 'email' });
 * ```
 */
export function createError(
	status: number,
	message: string,
	code?: string,
	details?: unknown
): AppError {
	const error = new Error(message) as AppError;
	error.status = status;
	error.code = code;
	error.details = details;

	// Устанавливаем правильное имя для ошибки
	error.name = code || 'AppError';

	return error;
}

/**
 * Type guard для проверки является ли ошибка AppError
 *
 * @param error - Любой объект ошибки
 * @returns true если это AppError с полем status
 *
 * @example
 * ```typescript
 * try {
 *   // some code
 * } catch (error) {
 *   if (isAppError(error)) {
 *     console.log(error.status, error.code);
 *   }
 * }
 * ```
 */
export function isAppError(error: unknown): error is AppError {
	return (
		error instanceof Error &&
		'status' in error &&
		typeof (error as AppError).status === 'number'
	);
}

/**
 * Централизованная обработка ошибок для API endpoints
 *
 * Преобразует любую ошибку в JSON Response с правильным статусом.
 * Логирует ошибки в Cloudflare Workers console.
 *
 * @param error - Любой тип ошибки (AppError, Error, unknown)
 * @returns JSON Response с ошибкой
 *
 * Формат ответа:
 * ```json
 * {
 *   "error": "Error message",
 *   "code": "ERROR_CODE",      // опционально
 *   "details": {...}            // опционально
 * }
 * ```
 *
 * Логика обработки:
 * - AppError → использует status, code, details из ошибки
 * - Error → 500 статус, сообщение ошибки
 * - Unknown → 500 статус, generic сообщение
 *
 * В production стек-трейс не отправляется клиенту (только логируется).
 *
 * @example
 * ```typescript
 * export async function POST({ request }) {
 *   try {
 *     // API logic
 *   } catch (error) {
 *     return handleApiError(error);
 *   }
 * }
 * ```
 */
export function handleApiError(error: unknown): Response {
	// Определяем, production ли окружение (для SvelteKit на Cloudflare)
	const isProduction = !dev;

	let status = 500;
	let message = 'Internal Server Error';
	let code: string | undefined;
	let details: unknown | undefined;

	// Обрабатываем типизированные ошибки приложения
	if (isAppError(error)) {
		status = error.status || 500;
		message = error.message;
		code = error.code;
		details = error.details;

		// Логируем с полной информацией
		console.error('[AppError]', {
			status,
			code,
			message,
			details,
			stack: error.stack,
		});
	}
	// Обрабатываем стандартные JavaScript ошибки
	else if (error instanceof Error) {
		message = error.message;

		// Логируем с stack trace
		console.error('[Error]', {
			message: error.message,
			stack: error.stack,
			name: error.name,
		});
	}
	// Обрабатываем неизвестные типы ошибок
	else {
		// В production не показываем детали неизвестных ошибок
		if (!isProduction) {
			message = String(error);
		}

		console.error('[Unknown Error]', error);
	}

	// Формируем тело ответа
	const responseBody: {
		error: string;
		code?: string;
		details?: unknown;
		stack?: string;
	} = {
		error: message,
	};

	// Добавляем опциональные поля если они есть
	if (code) {
		responseBody.code = code;
	}

	if (details) {
		responseBody.details = details;
	}

	// В development режиме добавляем stack trace для отладки
	if (!isProduction && error instanceof Error && error.stack) {
		responseBody.stack = error.stack;
	}

	// Возвращаем JSON Response с правильным статусом
	return new Response(JSON.stringify(responseBody), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

/**
 * Предопределённые фабрики для часто используемых ошибок
 */
export const errors = {
	/** 400 Bad Request */
	badRequest: (message: string, details?: unknown) =>
		createError(400, message, 'BAD_REQUEST', details),

	/** 401 Unauthorized */
	unauthorized: (message: string = 'Unauthorized') => createError(401, message, 'UNAUTHORIZED'),

	/** 403 Forbidden */
	forbidden: (message: string = 'Forbidden') => createError(403, message, 'FORBIDDEN'),

	/** 404 Not Found */
	notFound: (resource: string = 'Resource') =>
		createError(404, `${resource} not found`, 'NOT_FOUND'),

	/** 409 Conflict */
	conflict: (message: string, details?: unknown) =>
		createError(409, message, 'CONFLICT', details),

	/** 422 Unprocessable Entity (валидация) */
	validation: (message: string, details?: unknown) =>
		createError(422, message, 'VALIDATION_ERROR', details),

	/** 429 Too Many Requests */
	tooManyRequests: (message: string = 'Too many requests') =>
		createError(429, message, 'TOO_MANY_REQUESTS'),

	/** 500 Internal Server Error */
	internal: (message: string = 'Internal server error', details?: unknown) =>
		createError(500, message, 'INTERNAL_ERROR', details),
};
