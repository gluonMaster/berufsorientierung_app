/**
 * API Endpoint: POST /api/events/cancel
 *
 * Отмена записи пользователя на мероприятие
 *
 * Бизнес-правило: Пользователь может отменить запись только если до мероприятия > 3 дней
 *
 * Процесс отмены:
 * 1. Аутентификация пользователя (обязательно)
 * 2. Валидация registration_id и причины отмены
 * 3. Проверка существования записи и принадлежности пользователю
 * 4. Проверка что запись не была отменена ранее
 * 5. Проверка срока отмены (> 3 дней до мероприятия)
 * 6. Отмена записи в БД
 * 7. Логирование действия
 * 8. Отправка confirmation email (не блокирует отмену при ошибке)
 *
 * @returns 200 OK с подтверждением отмены
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { getDB } from '$lib/server/db';
import { getEventById } from '$lib/server/db/events';
import { getRegistrationById, cancelRegistration } from '$lib/server/db/registrations';
import { logActivity } from '$lib/server/db/activityLog';
import { sendEmailSafely, sendEmail } from '$lib/server/email';
import { getEventCancellationEmail } from '$lib/server/email/templates';
import type { LanguageCode } from '$lib/types';

/**
 * Zod схема для валидации запроса на отмену
 */
const cancelRegistrationSchema = z.object({
	registration_id: z.number().int().positive('Registration ID must be a positive integer'),
	cancellation_reason: z
		.string()
		.min(5, 'Cancellation reason must be at least 5 characters')
		.max(500, 'Cancellation reason must not exceed 500 characters')
		.optional(),
});

/**
 * Константа: минимальное количество дней до мероприятия для отмены
 */
const MIN_DAYS_BEFORE_EVENT = 3;

/**
 * POST /api/events/cancel
 * Отмена записи на мероприятие
 */
export async function POST({ request, platform }: RequestEvent) {
	try {
		const DB = getDB(platform);

		if (!platform?.env?.JWT_SECRET) {
			throw errors.internal('JWT secret not configured');
		}

		const JWT_SECRET = platform.env.JWT_SECRET;

		// Шаг 1: Проверка аутентификации (обязательно)
		const user = await requireAuth(request, DB, JWT_SECRET);

		// Шаг 2: Парсинг и валидация запроса
		let requestData: unknown;
		try {
			requestData = await request.json();
		} catch (error) {
			throw errors.badRequest('Invalid JSON in request body');
		}

		const validationResult = cancelRegistrationSchema.safeParse(requestData);

		if (!validationResult.success) {
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const data = validationResult.data;

		// Шаг 3: Получение записи
		const registration = await getRegistrationById(DB, data.registration_id);

		if (!registration) {
			throw errors.notFound('Registration not found');
		}

		// Проверка принадлежности записи пользователю
		if (registration.user_id !== user.id) {
			throw errors.forbidden('You can only cancel your own registrations');
		}

		// Шаг 4: Проверка что запись не была отменена ранее
		if (registration.cancelled_at) {
			throw errors.badRequest('Registration is already cancelled', {
				cancelled_at: registration.cancelled_at,
			});
		}

		// Шаг 5: Получение мероприятия и проверка срока отмены
		const event = await getEventById(DB, registration.event_id);

		if (!event) {
			throw errors.notFound('Event not found');
		}

		const eventDate = new Date(event.date);
		const now = new Date();
		const daysUntilEvent = Math.ceil(
			(eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);

		if (daysUntilEvent <= MIN_DAYS_BEFORE_EVENT) {
			throw errors.badRequest(
				`Cannot cancel registration less than ${MIN_DAYS_BEFORE_EVENT} days before the event`,
				{
					event_date: event.date,
					days_until_event: daysUntilEvent,
					min_required_days: MIN_DAYS_BEFORE_EVENT,
				}
			);
		}

		// Шаг 6: Отмена записи
		await cancelRegistration(
			DB,
			user.id,
			registration.event_id,
			data.cancellation_reason || 'User cancelled'
		);

		// Шаг 7: Логирование
		const clientIP = getClientIP(request);
		try {
			const logDetails = JSON.stringify({
				registration_id: data.registration_id,
				event_id: event.id,
				event_title: event.title_de,
				cancellation_reason: data.cancellation_reason || 'Not specified',
			});

			await logActivity(
				DB,
				user.id,
				'registration_cancel',
				logDetails,
				clientIP || undefined
			);
		} catch (error) {
			console.error('[Event Cancel] Activity logging failed:', error);
		}

		// Шаг 8: Отправка confirmation email (не блокирует отмену при ошибке)
		const userLanguage = (user.preferred_language || 'de') as LanguageCode;

		await sendEmailSafely(async () => {
			const emailData = getEventCancellationEmail(user, event, userLanguage);

			await sendEmail(user.email, emailData.subject, emailData.text, platform!.env);
		}, `Event cancellation confirmation email to ${user.email} for event ${event.title_de}`);

		// Шаг 9: Возврат успешного ответа
		return json(
			{
				message: 'Registration cancelled successfully',
				registration_id: data.registration_id,
				event: {
					id: event.id,
					title: {
						de: event.title_de,
						en: event.title_en,
						ru: event.title_ru,
						uk: event.title_uk,
					},
					date: event.date,
				},
				cancelled_at: new Date().toISOString(),
			},
			{
				status: 200,
			}
		);
	} catch (error) {
		return handleApiError(error);
	}
}
