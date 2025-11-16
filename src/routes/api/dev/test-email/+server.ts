/**
 * API Endpoint: POST /api/dev/test-email
 *
 * Тестовая отправка email для проверки DNS настроек (SPF/DKIM/DMARC)
 *
 * ⚠️ ВАЖНО: Endpoint защищён SETUP_TOKEN!
 * Используется только для тестирования перед production запуском.
 *
 * Процесс:
 * 1. Проверка SETUP_TOKEN (обязательно)
 * 2. Валидация входных данных (to, subject, text)
 * 3. Отправка тестового email через sendEmail
 * 4. Возврат детального результата (успех/ошибка + провайдер)
 *
 * @requires Header: X-Setup-Token (должен совпадать с env.SETUP_TOKEN)
 * @requires Body: { to: string, subject: string, text: string }
 * @returns 200 OK с деталями отправки
 * @returns 401 Unauthorized если SETUP_TOKEN неверный
 * @returns 400 Bad Request если невалидные данные
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { sendEmail } from '$lib/server/email';
import { handleApiError } from '$lib/server/middleware/errorHandler';

/**
 * POST /api/dev/test-email
 * Тестовая отправка email
 */
export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка SETUP_TOKEN
		const setupToken = request.headers.get('X-Setup-Token');
		const expectedToken = platform?.env?.SETUP_TOKEN;

		if (!expectedToken || setupToken !== expectedToken) {
			return json(
				{
					success: false,
					error: 'Unauthorized: invalid or missing SETUP_TOKEN',
				},
				{ status: 401 }
			);
		}

		// Шаг 2: Парсинг и валидация входных данных
		let body: { to?: string; subject?: string; text?: string };

		try {
			body = await request.json();
		} catch (error) {
			return json(
				{
					success: false,
					error: 'Invalid JSON body',
				},
				{ status: 400 }
			);
		}

		const { to, subject, text } = body;

		// Валидация обязательных полей
		if (!to || typeof to !== 'string') {
			return json(
				{
					success: false,
					error: 'Missing or invalid "to" field (must be a valid email address)',
				},
				{ status: 400 }
			);
		}

		if (!subject || typeof subject !== 'string') {
			return json(
				{
					success: false,
					error: 'Missing or invalid "subject" field',
				},
				{ status: 400 }
			);
		}

		if (!text || typeof text !== 'string') {
			return json(
				{
					success: false,
					error: 'Missing or invalid "text" field',
				},
				{ status: 400 }
			);
		}

		// Базовая валидация email формата
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(to)) {
			return json(
				{
					success: false,
					error: 'Invalid email format for "to" field',
				},
				{ status: 400 }
			);
		}

		// Шаг 3: Отправка email
		// Определяем текущий email-провайдер из настроек окружения
		const provider = (platform?.env?.EMAIL_PROVIDER || 'mailchannels').toLowerCase();

		console.log('[Test Email] Sending test email:', {
			to,
			subject,
			provider, // Текущий email-провайдер (mailchannels/resend)
		});

		await sendEmail(to, subject, text, platform!.env);

		// Шаг 4: Успешный ответ
		return json(
			{
				success: true,
				message: 'Test email sent successfully',
				provider, // Текущий email-провайдер
				to,
				subject,
			},
			{ status: 200 }
		);
	} catch (error) {
		// Централизованная обработка ошибок
		console.error('[Test Email] Failed to send test email:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				details: 'Check server logs for more information',
			},
			{ status: 500 }
		);
	}
}
