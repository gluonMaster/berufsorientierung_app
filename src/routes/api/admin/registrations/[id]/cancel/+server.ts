import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/admin';
import { getDB } from '$lib/server/db';
import { z } from 'zod';
import { sendEmail } from '$lib/server/email';
import { logActivity } from '$lib/server/db/activityLog';

// Схема валидации
const cancelSchema = z.object({
	reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	// Проверка прав администратора
	const adminCheck = await requireAdmin(platform, locals);
	if (!adminCheck.success) {
		throw error(403, adminCheck.error || 'Access denied');
	}

	const registrationId = parseInt(params.id!, 10);
	if (isNaN(registrationId)) {
		throw error(400, 'Invalid registration ID');
	}

	const db = getDB(platform);

	try {
		// Парсинг и валидация данных
		const body = await request.json();
		const validation = cancelSchema.safeParse(body);

		if (!validation.success) {
			return json(
				{ success: false, message: validation.error.issues[0].message },
				{ status: 400 }
			);
		}

		const { reason } = validation.data;

		// Получение информации о регистрации
		const registration = await db
			.prepare(
				`
				SELECT 
					r.*,
					u.first_name, u.last_name, u.email, u.preferred_language,
					e.title_de, e.title_en, e.title_ru, e.title_uk,
					e.date as event_date
				FROM registrations r
				INNER JOIN users u ON r.user_id = u.id
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.id = ?
			`
			)
			.bind(registrationId)
			.first<any>();

		if (!registration) {
			return json({ success: false, message: 'Registration not found' }, { status: 404 });
		}

		// Проверка: уже отменена?
		if (registration.cancelled_at) {
			return json(
				{ success: false, message: 'Registration is already cancelled' },
				{ status: 400 }
			);
		}

		// Отмена регистрации
		await db
			.prepare(
				`
				UPDATE registrations
				SET cancelled_at = datetime('now'),
				    cancellation_reason = ?
				WHERE id = ?
			`
			)
			.bind(reason, registrationId)
			.run();

		// Логирование действия
		await logActivity(
			platform!.env.DB,
			adminCheck.userId!,
			'registration_cancel',
			JSON.stringify({
				registrationId,
				userId: registration.user_id,
				eventId: registration.event_id,
				reason,
				cancelled_by: 'admin',
			})
		);

		// Отправка email пользователю
		const userLang = registration.preferred_language || 'de';
		const eventTitle = registration[`title_${userLang}`] || registration.title_de || 'Event';

		const emailSubjects: Record<string, string> = {
			de: `Ihre Anmeldung wurde storniert - ${eventTitle}`,
			en: `Your Registration Has Been Cancelled - ${eventTitle}`,
			ru: `Ваша регистрация отменена - ${eventTitle}`,
			uk: `Вашу реєстрацію скасовано - ${eventTitle}`,
		};

		const emailBodies: Record<string, string> = {
			de: `Hallo ${registration.first_name} ${registration.last_name},

Ihre Anmeldung für die Veranstaltung "${eventTitle}" am ${new Date(registration.event_date).toLocaleDateString('de-DE')} wurde vom Administrator storniert.

Grund: ${reason}

Bei Fragen wenden Sie sich bitte an: Berufsorientierung@kolibri-dresden.de

Mit freundlichen Grüßen,
Ihr Kolibri Dresden Team`,

			en: `Hello ${registration.first_name} ${registration.last_name},

Your registration for the event "${eventTitle}" on ${new Date(registration.event_date).toLocaleDateString('en-US')} has been cancelled by the administrator.

Reason: ${reason}

If you have any questions, please contact: Berufsorientierung@kolibri-dresden.de

Best regards,
Kolibri Dresden Team`,

			ru: `Здравствуйте, ${registration.first_name} ${registration.last_name},

Ваша регистрация на мероприятие "${eventTitle}" ${new Date(registration.event_date).toLocaleDateString('ru-RU')} была отменена администратором.

Причина: ${reason}

Если у вас есть вопросы, свяжитесь с нами: Berufsorientierung@kolibri-dresden.de

С уважением,
Команда Kolibri Dresden`,

			uk: `Вітаємо, ${registration.first_name} ${registration.last_name},

Вашу реєстрацію на захід "${eventTitle}" ${new Date(registration.event_date).toLocaleDateString('uk-UA')} було скасовано адміністратором.

Причина: ${reason}

Якщо у вас є запитання, зв'яжіться з нами: Berufsorientierung@kolibri-dresden.de

З повагою,
Команда Kolibri Dresden`,
		};

		await sendEmail(
			registration.email,
			emailSubjects[userLang],
			emailBodies[userLang],
			platform!.env
		);

		return json({ success: true, message: 'Registration cancelled successfully' });
	} catch (err) {
		console.error('Error cancelling registration:', err);
		return json({ success: false, message: 'Failed to cancel registration' }, { status: 500 });
	}
};
