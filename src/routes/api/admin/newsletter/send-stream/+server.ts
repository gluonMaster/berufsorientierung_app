import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/admin';
import { getDB } from '$lib/server/db';
import { z } from 'zod';
import { sendEmail } from '$lib/server/email';
import { logActivity } from '$lib/server/db/activityLog';

// Схема валидации
const newsletterSchema = z.object({
	recipientType: z.enum(['all', 'event', 'upcoming', 'custom']),
	eventId: z.number().optional(),
	customEmails: z.array(z.string().email()).optional(),
	language: z.enum(['de', 'en', 'ru', 'uk']),
	subject: z.string().min(3, 'Subject must be at least 3 characters'),
	text: z.string().min(10, 'Text must be at least 10 characters'),
});

/**
 * SSE endpoint для отправки массовой рассылки с прогрессом в реальном времени
 *
 * Возвращает Server-Sent Events stream с обновлениями прогресса:
 * - event: progress, data: { batch, totalBatches, sent, failed, total }
 * - event: complete, data: { success, sent, failed, total }
 * - event: error, data: { message }
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	// Проверка прав администратора
	const adminCheck = await requireAdmin(platform, locals);
	if (!adminCheck.success) {
		throw error(403, adminCheck.error || 'Access denied');
	}

	const db = getDB(platform);

	try {
		// Парсинг и валидация данных
		const body = await request.json();
		const validation = newsletterSchema.safeParse(body);

		if (!validation.success) {
			throw error(400, validation.error.issues[0].message);
		}

		const { recipientType, eventId, customEmails, language, subject, text } = validation.data;

		// Получение списка получателей
		let recipients: { email: string }[] = [];

		if (recipientType === 'all') {
			const result = await db
				.prepare('SELECT email FROM users WHERE is_blocked = 0')
				.all<{ email: string }>();
			recipients = result.results || [];
		} else if (recipientType === 'event' && eventId) {
			const result = await db
				.prepare(
					`
					SELECT DISTINCT u.email
					FROM users u
					INNER JOIN registrations r ON u.id = r.user_id
					WHERE r.event_id = ? AND r.cancelled_at IS NULL AND u.is_blocked = 0
				`
				)
				.bind(eventId)
				.all<{ email: string }>();
			recipients = result.results || [];
		} else if (recipientType === 'upcoming') {
			const result = await db
				.prepare(
					`
					SELECT DISTINCT u.email
					FROM users u
					INNER JOIN registrations r ON u.id = r.user_id
					INNER JOIN events e ON r.event_id = e.id
					WHERE r.cancelled_at IS NULL 
					  AND e.date >= date('now')
					  AND u.is_blocked = 0
				`
				)
				.all<{ email: string }>();
			recipients = result.results || [];
		} else if (recipientType === 'custom' && customEmails) {
			recipients = customEmails.map((email) => ({ email }));
		}

		if (recipients.length === 0) {
			throw error(400, 'No recipients found');
		}

		// Создаём SSE stream
		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				// Функция для отправки SSE события
				const sendEvent = (event: string, data: any) => {
					const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(message));
				};

				try {
					// Параметры батчинга
					const chunkSize = parseInt(platform!.env.EMAIL_BULK_CHUNK || '50', 10);
					const pauseMs = parseInt(platform!.env.EMAIL_BULK_PAUSE_MS || '60000', 10);

					let totalSent = 0;
					let totalFailed = 0;
					const totalBatches = Math.ceil(recipients.length / chunkSize);

					console.log('[Newsletter SSE] Starting bulk send:', {
						totalRecipients: recipients.length,
						chunkSize,
						pauseMs,
						totalBatches,
					});

					// Обрабатываем каждый батч
					for (let i = 0; i < recipients.length; i += chunkSize) {
						const chunk = recipients.slice(i, i + chunkSize);
						const batchNumber = Math.floor(i / chunkSize) + 1;

						console.log(
							`[Newsletter SSE] Processing batch ${batchNumber}/${totalBatches}`
						);

						// Отправляем все письма в батче параллельно
						const results = await Promise.allSettled(
							chunk.map((recipient) =>
								sendEmail(recipient.email, subject, text, platform!.env)
							)
						);

						// Подсчитываем результаты
						let batchSent = 0;
						let batchFailed = 0;

						results.forEach((result) => {
							if (result.status === 'fulfilled') {
								batchSent++;
								totalSent++;
							} else {
								batchFailed++;
								totalFailed++;
								console.error('[Newsletter SSE] Email failed:', result.reason);
							}
						});

						// Отправляем прогресс
						sendEvent('progress', {
							batch: batchNumber,
							totalBatches,
							batchSent,
							batchFailed,
							sent: totalSent,
							failed: totalFailed,
							total: recipients.length,
						});

						// Пауза между батчами (кроме последнего)
						if (i + chunkSize < recipients.length) {
							console.log(`[Newsletter SSE] Pausing for ${pauseMs}ms...`);
							await new Promise((resolve) => setTimeout(resolve, pauseMs));
						}
					}

					// Логирование массовой рассылки
					await logActivity(
						platform!.env.DB,
						adminCheck.userId!,
						'bulk_email_sent',
						JSON.stringify({
							recipientType,
							eventId: eventId || null,
							language,
							subject,
							totalRecipients: recipients.length,
							sent: totalSent,
							failed: totalFailed,
						})
					);

					// Отправляем финальное событие
					sendEvent('complete', {
						success: true,
						sent: totalSent,
						failed: totalFailed,
						total: recipients.length,
					});

					console.log('[Newsletter SSE] Completed:', {
						sent: totalSent,
						failed: totalFailed,
						total: recipients.length,
					});

					controller.close();
				} catch (err) {
					console.error('[Newsletter SSE] Error:', err);
					sendEvent('error', {
						message: err instanceof Error ? err.message : 'Unknown error',
					});
					controller.close();
				}
			},
		});

		// Возвращаем SSE response
		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (err) {
		console.error('[Newsletter SSE] Setup error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to setup newsletter stream');
	}
};
