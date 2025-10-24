/**
 * API Endpoint: POST /api/events/register
 *
 * Запись пользователя на мероприятие
 *
 * Процесс записи:
 * 1. Аутентификация пользователя (обязательно)
 * 2. Валидация event_id и дополнительных полей
 * 3. Проверка существования мероприятия и его статуса (active)
 * 4. Проверка дедлайна регистрации
 * 5. Проверка наличия мест (max_participants)
 * 6. Проверка отсутствия дубликата записи
 * 7. Создание записи в БД
 * 8. Логирование действия
 * 9. Отправка confirmation email с QR-кодами (не блокирует запись при ошибке)
 *
 * @returns 201 Created с данными регистрации
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { getDB } from '$lib/server/db';
import { getEventById } from '$lib/server/db/events';
import {
	registerUserForEvent,
	isUserRegistered,
	getRegistrationCount,
} from '$lib/server/db/registrations';
import { logActivity } from '$lib/server/db/activityLog';
import { sendEmailSafely, sendEmail } from '$lib/server/email';
import { getEventRegistrationEmail } from '$lib/server/email/templates';
import type { LanguageCode } from '$lib/types';

/**
 * Zod схема для валидации запроса на регистрацию
 */
const eventRegistrationSchema = z.object({
	event_id: z.number().int().positive('Event ID must be a positive integer'),
	additional_data: z.record(z.string(), z.unknown()).optional(), // JSON объект с дополнительными полями
});

/**
 * POST /api/events/register
 * Запись на мероприятие
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

		const validationResult = eventRegistrationSchema.safeParse(requestData);

		if (!validationResult.success) {
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const data = validationResult.data;

		// Шаг 3: Получение мероприятия
		const event = await getEventById(DB, data.event_id);

		if (!event) {
			throw errors.notFound('Event not found');
		}

		// Проверка статуса мероприятия
		if (event.status !== 'active') {
			throw errors.badRequest(
				`Event is not available for registration (status: ${event.status})`
			);
		}

		// Шаг 4: Проверка дедлайна регистрации
		const now = new Date();
		const registrationDeadline = new Date(event.registration_deadline);

		if (now > registrationDeadline) {
			throw errors.badRequest('Registration deadline has passed', {
				deadline: event.registration_deadline,
			});
		}

		// Шаг 5: Проверка наличия мест
		if (event.max_participants) {
			const currentCount = await getRegistrationCount(DB, data.event_id);

			if (currentCount >= event.max_participants) {
				throw errors.badRequest('Event is full (no available spots)', {
					max_participants: event.max_participants,
					current_count: currentCount,
				});
			}
		}

		// Шаг 6: Проверка отсутствия дубликата записи
		const isAlreadyRegistered = await isUserRegistered(DB, user.id, data.event_id);

		if (isAlreadyRegistered) {
			throw errors.conflict('User is already registered for this event');
		}

		// Шаг 7: Создание записи
		const registration = await registerUserForEvent(
			DB,
			user.id,
			data.event_id,
			data.additional_data || undefined
		);

		// Шаг 8: Логирование
		const clientIP = getClientIP(request);
		try {
			const logDetails = JSON.stringify({
				event_id: data.event_id,
				event_title: event.title_de,
				registration_id: registration.id,
			});

			await logActivity(
				DB,
				user.id,
				'registration_create',
				logDetails,
				clientIP || undefined
			);
		} catch (error) {
			console.error('[Event Register] Activity logging failed:', error);
		}

		// Шаг 9: Отправка confirmation email (не блокирует запись при ошибке)
		const userLanguage = (user.preferred_language || 'de') as LanguageCode;

		await sendEmailSafely(async () => {
			const emailData = getEventRegistrationEmail(
				user,
				event,
				userLanguage,
				event.telegram_link || undefined,
				event.whatsapp_link || undefined
			);

			await sendEmail(user.email, emailData.subject, emailData.text, platform!.env);
		}, `Event registration confirmation email to ${user.email} for event ${event.title_de}`);

		// Шаг 10: Возврат успешного ответа
		return json(
			{
				registration: {
					id: registration.id,
					event_id: registration.event_id,
					registered_at: registration.registered_at,
					additional_data:
						typeof registration.additional_data === 'string'
							? JSON.parse(registration.additional_data)
							: registration.additional_data,
				},
				event: {
					id: event.id,
					title: {
						de: event.title_de,
						en: event.title_en,
						ru: event.title_ru,
						uk: event.title_uk,
					},
					date: event.date,
					location: {
						de: event.location_de,
						en: event.location_en,
						ru: event.location_ru,
						uk: event.location_uk,
					},
				},
				message: 'Successfully registered for the event',
			},
			{
				status: 201,
			}
		);
	} catch (error) {
		return handleApiError(error);
	}
}
