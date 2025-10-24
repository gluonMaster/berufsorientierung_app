/**
 * Email Module Usage Examples
 *
 * Примеры использования функций sendEmail и sendBulkEmails
 * с готовыми шаблонами из templates.ts
 *
 * ВАЖНО: Эти примеры для демонстрации. В реальном приложении
 * email отправка будет интегрирована в бизнес-логику (регистрация,
 * события, массовые рассылки и т.д.)
 */

import { sendEmail, sendBulkEmails } from '$lib/server/email';
import {
	getWelcomeEmail,
	getEventRegistrationEmail,
	getEventCancellationEmail,
	getEventCancelledByAdminEmail,
} from '$lib/server/email/templates';
import type { User } from '$lib/types/user';
import type { Event } from '$lib/types/event';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Пример 1: Отправка Welcome email при регистрации
 * Использует готовый мультиязычный шаблон из templates.ts
 */
export async function sendWelcomeEmail(user: User, platform: RequestEvent['platform']) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	// Получаем мультиязычный шаблон
	const { subject, text } = getWelcomeEmail(user, user.preferred_language);

	await sendEmail(user.email, subject, text, platform.env);

	console.log(`[Email] Welcome email sent to ${user.email} (${user.preferred_language})`);
}

/**
 * Пример 2: Отправка подтверждения записи на мероприятие
 * Использует готовый мультиязычный шаблон из templates.ts
 */
export async function sendEventRegistrationConfirmation(
	user: User,
	event: Event,
	platform: RequestEvent['platform']
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	// Получаем мультиязычный шаблон с деталями мероприятия
	const { subject, text } = getEventRegistrationEmail(
		user,
		event,
		user.preferred_language,
		event.telegram_link || undefined,
		event.whatsapp_link || undefined
	);

	await sendEmail(user.email, subject, text, platform.env);

	console.log(
		`[Email] Event registration confirmation sent to ${user.email} for event ${event.id}`
	);
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
 * Пример 3: Отправка подтверждения отмены записи пользователем
 * Использует готовый мультиязычный шаблон из templates.ts
 */
export async function sendUserCancellationConfirmation(
	user: User,
	event: Event,
	platform: RequestEvent['platform']
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	// Получаем мультиязычный шаблон подтверждения отмены
	const { subject, text } = getEventCancellationEmail(user, event, user.preferred_language);

	await sendEmail(user.email, subject, text, platform.env);

	console.log(
		`[Email] User cancellation confirmation sent to ${user.email} for event ${event.id}`
	);
}

/**
 * Пример 4: Уведомление об отмене мероприятия администратором
 * Использует готовый мультиязычный шаблон из templates.ts
 */
export async function sendEventCancellationNotice(
	user: User,
	event: Event,
	cancellationReason: string,
	platform: RequestEvent['platform'],
	eventsUrl?: string
) {
	if (!platform) {
		throw new Error('Platform is required');
	}

	// Получаем мультиязычный шаблон уведомления об отмене
	// eventsUrl опционален, по умолчанию "/events"
	const { subject, text } = getEventCancelledByAdminEmail(
		user,
		event,
		cancellationReason,
		user.preferred_language,
		eventsUrl
	);

	await sendEmail(user.email, subject, text, platform.env);

	console.log(`[Email] Event cancellation notice sent to ${user.email} for event ${event.id}`);
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
