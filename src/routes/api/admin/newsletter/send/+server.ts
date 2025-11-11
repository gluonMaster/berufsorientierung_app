import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/admin';
import { getDB } from '$lib/server/db';
import { z } from 'zod';
import { sendEmail, sendBulkEmails } from '$lib/server/email';
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
			return json(
				{ success: false, message: validation.error.issues[0].message },
				{ status: 400 }
			);
		}

		const { recipientType, eventId, customEmails, language, subject, text } = validation.data;

		// Получение списка получателей
		let recipients: { email: string }[] = [];

		if (recipientType === 'all') {
			// Все пользователи (не заблокированные)
			const result = await db
				.prepare('SELECT email FROM users WHERE is_blocked = 0')
				.all<{ email: string }>();
			recipients = result.results || [];
		} else if (recipientType === 'event' && eventId) {
			// Пользователи, зарегистрированные на конкретное мероприятие
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
			// Пользователи с регистрациями на предстоящие мероприятия
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
			// Пользовательский список
			recipients = customEmails.map((email) => ({ email }));
		}

		if (recipients.length === 0) {
			return json({ success: false, message: 'No recipients found' }, { status: 400 });
		}

		// Отправка писем
		let sent = 0;
		let failed = 0;

		// Если получателей больше 150 - используем батчинг через sendBulkEmails
		// (батчинг настраивается через env: EMAIL_BULK_CHUNK и EMAIL_BULK_PAUSE_MS)
		if (recipients.length > 150) {
			const bulk = await sendBulkEmails(
				recipients.map((r) => r.email),
				subject,
				text,
				platform!.env
			);
			sent = bulk.success;
			failed = bulk.failed;
		} else {
			// Если получателей <= 150 - отправляем параллельно без батчинга
			const results = await Promise.allSettled(
				recipients.map((recipient) =>
					sendEmail(recipient.email, subject, text, platform!.env)
				)
			);

			results.forEach((result) => {
				if (result.status === 'fulfilled') {
					sent++;
				} else {
					failed++;
					console.error('Email send error:', result.reason);
				}
			});
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
				sent,
				failed,
			})
		);

		return json({
			success: true,
			sent,
			failed,
			total: recipients.length,
		});
	} catch (err) {
		console.error('Newsletter send error:', err);
		return json({ success: false, message: 'Failed to send newsletter' }, { status: 500 });
	}
};
