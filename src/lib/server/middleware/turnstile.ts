/**
 * Cloudflare Turnstile Verification Middleware
 *
 * Защита форм от ботов через Cloudflare Turnstile.
 * Используется на критичных эндпоинтах: регистрация, логин, массовая рассылка.
 *
 * @see https://developers.cloudflare.com/turnstile/
 */

/**
 * Интерфейс ответа от Turnstile API
 */
interface TurnstileVerifyResponse {
	success: boolean;
	'error-codes'?: string[];
	challenge_ts?: string;
	hostname?: string;
}

/**
 * Карта кодов ошибок Turnstile для более понятных сообщений
 */
const TURNSTILE_ERROR_MESSAGES: Record<string, string> = {
	'missing-input-secret': 'Turnstile secret key не настроен',
	'invalid-input-secret': 'Turnstile secret key невалиден',
	'missing-input-response': 'Токен Turnstile не предоставлен',
	'invalid-input-response': 'Токен Turnstile невалиден или истёк',
	'bad-request': 'Некорректный запрос к Turnstile API',
	'timeout-or-duplicate': 'Токен Turnstile истёк или использован повторно',
	'internal-error': 'Внутренняя ошибка Turnstile API',
};

/**
 * Верифицирует токен Cloudflare Turnstile на стороне сервера
 *
 * @param env - Platform environment с переменными окружения (TURNSTILE_SECRET_KEY)
 * @param token - Токен от клиента (cf-turnstile-response)
 * @param ip - IP адрес клиента (опционально, для дополнительной проверки)
 * @throws Error с кодом 403 при неуспешной верификации
 *
 * @example
 * ```typescript
 * try {
 *   await verifyTurnstile(platform.env, turnstileToken, clientIP);
 *   // Верификация успешна, продолжаем обработку
 * } catch (error) {
 *   // Верификация провалена, возвращаем 403
 *   return json({ error: error.message }, { status: 403 });
 * }
 * ```
 */
export async function verifyTurnstile(
	env: App.Platform['env'],
	token: string,
	ip?: string
): Promise<void> {
	// Проверка наличия токена
	if (!token || token.trim() === '') {
		throw new Error('Токен Turnstile отсутствует');
	}

	// Проверка наличия секретного ключа в окружении
	if (!env.TURNSTILE_SECRET_KEY) {
		console.error('TURNSTILE_SECRET_KEY не установлен в переменных окружения');
		throw new Error('Turnstile не настроен на сервере');
	}

	// Подготовка данных для запроса к Turnstile API
	const formData = new URLSearchParams();
	formData.append('secret', env.TURNSTILE_SECRET_KEY);
	formData.append('response', token);

	// Добавляем IP если предоставлен (усиливает проверку)
	if (ip) {
		formData.append('remoteip', ip);
	}

	try {
		// Отправка запроса на верификацию к Cloudflare Turnstile API
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData.toString(),
		});

		// Проверка HTTP статуса ответа
		if (!response.ok) {
			console.error('Turnstile API вернул ошибку:', response.status, response.statusText);
			throw new Error('Ошибка связи с Turnstile API');
		}

		// Парсинг JSON ответа
		const data = (await response.json()) as TurnstileVerifyResponse;

		// Проверка успешности верификации
		if (!data.success) {
			const errorCodes = data['error-codes'] || [];
			const errorMessages = errorCodes.map(
				(code) => TURNSTILE_ERROR_MESSAGES[code] || `Неизвестная ошибка: ${code}`
			);

			console.error('Turnstile verification failed:', {
				errorCodes,
				errorMessages,
				challenge_ts: data.challenge_ts,
				hostname: data.hostname,
			});

			// Возвращаем понятное сообщение об ошибке
			const userMessage =
				errorMessages.length > 0
					? errorMessages.join('; ')
					: 'Верификация Turnstile не пройдена';

			throw new Error(userMessage);
		}

		// Верификация успешна
		console.log('Turnstile verification successful:', {
			challenge_ts: data.challenge_ts,
			hostname: data.hostname,
		});
	} catch (error) {
		// Если ошибка уже сформирована выше, пробрасываем её
		if (error instanceof Error) {
			throw error;
		}

		// Неожиданная ошибка при работе с API
		console.error('Unexpected error during Turnstile verification:', error);
		throw new Error('Ошибка верификации Turnstile');
	}
}

/**
 * Извлекает Turnstile токен из FormData или JSON body
 *
 * @param data - FormData или объект с данными
 * @returns Токен Turnstile или пустую строку
 *
 * @example
 * ```typescript
 * // Из FormData (для form actions)
 * const formData = await request.formData();
 * const token = extractTurnstileToken(formData);
 *
 * // Из JSON (для API endpoints)
 * const body = await request.json();
 * const token = extractTurnstileToken(body);
 * ```
 */
export function extractTurnstileToken(data: FormData | Record<string, unknown>): string {
	if (data instanceof FormData) {
		// Turnstile автоматически добавляет поле cf-turnstile-response в форму
		return data.get('cf-turnstile-response')?.toString() || '';
	}

	// Для JSON запросов проверяем оба возможных ключа
	const token =
		(data['cf-turnstile-response'] as string) || (data.turnstileToken as string) || '';

	return token;
}
