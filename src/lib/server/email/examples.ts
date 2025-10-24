/**
 * Email Module Usage Examples
 *
 * Примеры использования функций sendEmail и sendBulkEmails
 *
 * ВАЖНО: Эти примеры для демонстрации. В реальном приложении
 * email отправка будет интегрирована в бизнес-логику (регистрация,
 * события, массовые рассылки и т.д.)
 */

import { sendEmail, sendBulkEmails } from '$lib/server/email';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Пример 1: Отправка Welcome email при регистрации
 */
export async function sendWelcomeEmail(
	userEmail: string,
	userName: string,
	platform: RequestEvent['platform']
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	const subject = 'Willkommen bei Berufsorientierung!';
	const text = `
Hallo ${userName},

vielen Dank für Ihre Registrierung bei Berufsorientierung!

Wir freuen uns, Sie in unserem Programm begrüßen zu dürfen.

Sie können sich jetzt für Veranstaltungen anmelden und Ihre Karrieremöglichkeiten erkunden.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr Berufsorientierung Team

---
Kolibri Dresden
Berufsorientierung@kolibri-dresden.de
	`.trim();

	await sendEmail(userEmail, subject, text, platform.env);
}

/**
 * Пример 2: Отправка подтверждения записи на мероприятие
 */
export async function sendEventRegistrationConfirmation(
	userEmail: string,
	userName: string,
	eventTitle: string,
	eventDate: string,
	eventLocation: string,
	telegramLink: string,
	whatsappLink: string,
	platform: RequestEvent['platform']
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	const subject = `Anmeldebestätigung: ${eventTitle}`;
	const text = `
Hallo ${userName},

Ihre Anmeldung für die Veranstaltung wurde erfolgreich bestätigt!

Veranstaltungsdetails:
- Titel: ${eventTitle}
- Datum: ${eventDate}
- Ort: ${eventLocation}

Treten Sie unseren Gruppen bei:
- Telegram: ${telegramLink}
- WhatsApp: ${whatsappLink}

Wir freuen uns auf Ihre Teilnahme!

Bei Fragen oder Änderungen können Sie sich jederzeit an uns wenden.

Mit freundlichen Grüßen
Ihr Berufsorientierung Team

---
Kolibri Dresden
Berufsorientierung@kolibri-dresden.de
	`.trim();

	await sendEmail(userEmail, subject, text, platform.env);
}

/**
 * Пример 3: Массовая рассылка newsletter
 */
export async function sendNewsletterToAll(
	recipients: string[],
	subject: string,
	message: string,
	platform: RequestEvent['platform']
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	console.log(`[Newsletter] Starting bulk send to ${recipients.length} recipients`);

	const result = await sendBulkEmails(recipients, subject, message, platform.env);

	console.log('[Newsletter] Bulk send completed:', {
		total: recipients.length,
		success: result.success,
		failed: result.failed,
		successRate: ((result.success / recipients.length) * 100).toFixed(2) + '%',
	});

	// Если были ошибки, логируем их
	if (result.failed > 0) {
		console.error('[Newsletter] Failed emails:', result.errors);
	}

	return result;
}

/**
 * Пример 4: Уведомление об отмене мероприятия
 */
export async function sendEventCancellationNotice(
	userEmail: string,
	userName: string,
	eventTitle: string,
	cancellationReason: string,
	platform: RequestEvent['platform']
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	const subject = `Veranstaltung abgesagt: ${eventTitle}`;
	const text = `
Hallo ${userName},

leider müssen wir Ihnen mitteilen, dass die folgende Veranstaltung abgesagt wurde:

Veranstaltung: ${eventTitle}

Grund der Absage:
${cancellationReason}

Wir entschuldigen uns für die Unannehmlichkeiten.

Sie können sich gerne für andere Veranstaltungen auf unserer Plattform anmelden.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr Berufsorientierung Team

---
Kolibri Dresden
Berufsorientierung@kolibri-dresden.de
	`.trim();

	await sendEmail(userEmail, subject, text, platform.env);
}

/**
 * Пример 5: Отправка с обработкой ошибок
 */
export async function sendEmailSafely(
	to: string,
	subject: string,
	text: string,
	platform: RequestEvent['platform']
): Promise<{ success: boolean; error?: string }> {
	if (!platform) {
		return { success: false, error: 'Platform is required' };
	}

	try {
		await sendEmail(to, subject, text, platform.env);
		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[Email] Failed to send email:', errorMessage);
		return { success: false, error: errorMessage };
	}
}
