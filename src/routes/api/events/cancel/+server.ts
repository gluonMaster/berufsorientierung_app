/**
 * API Endpoint: POST /api/events/cancel
 * Отмена записи пользователя на мероприятие
 *
 * Требует авторизации
 *
 * Логика:
 * 1. Проверка авторизации (requireAuth)
 * 2. Получение и валидация eventId
 * 3. Поиск регистрации по userId + eventId
 * 4. Проверка что регистрация существует и не отменена
 * 5. Получение мероприятия
 * 6. Проверка что до мероприятия > 3 дней
 * 7. Отмена регистрации через cancelRegistration
 * 8. Логирование действия
 * 9. Отправка email подтверждения (не блокирует при ошибке)
 * 10. Возврат { success: true }
 *
 * Обработка ошибок:
 * - 403: нельзя отменить (< 3 дней до мероприятия)
 * - 404: регистрация не найдена
 * - 500: server error
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, createError } from '$lib/server/middleware/errorHandler';
import { getEventById } from '$lib/server/db/events';
import { cancelRegistration } from '$lib/server/db/registrations';
import { logActivity } from '$lib/server/db/activityLog';
import { sendEmail } from '$lib/server/email';
import { getEventCancellationEmail } from '$lib/server/email/templates';
import type { LanguageCode } from '$lib/types/common';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Zod схема для валидации запроса на отмену
 */
const cancelEventRegistrationSchema = z.object({
	event_id: z.number().int().positive('Event ID must be a positive integer'),
	cancellation_reason: z
		.string()
		.min(5, 'Cancellation reason must be at least 5 characters')
		.max(500, 'Cancellation reason must not exceed 500 characters')
		.optional(),
});

/**
 * Вспомогательная функция: получить активную регистрацию пользователя на мероприятие
 */
async function getActiveRegistration(
	db: D1Database,
	userId: number,
	eventId: number
): Promise<{ id: number; user_id: number; event_id: number; cancelled_at: string | null } | null> {
	const result = await db
		.prepare(
			`SELECT id, user_id, event_id, cancelled_at
			FROM registrations
			WHERE user_id = ? AND event_id = ?
			LIMIT 1`
		)
		.bind(userId, eventId)
		.first<{ id: number; user_id: number; event_id: number; cancelled_at: string | null }>();

	return result;
}

/**
 * POST /api/events/cancel
 * Отмена записи на мероприятие
 */
export async function POST({ request, platform }: RequestEvent) {
	// Проверка доступности platform.env
	if (!platform?.env) {
		return handleApiError(createError(500, 'Platform environment not available'));
	}

	const { DB, JWT_SECRET } = platform.env;

	try {
		// ============================================
		// 1. ПРОВЕРКА АВТОРИЗАЦИИ
		// ============================================
		const user = await requireAuth(request, DB, JWT_SECRET);

		// ============================================
		// 2. ПАРСИНГ И ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
		// ============================================
		let body;
		try {
			body = await request.json();
		} catch {
			throw createError(400, 'Invalid JSON body', 'INVALID_JSON');
		}

		// Валидация через Zod схему
		const validationResult = cancelEventRegistrationSchema.safeParse(body);

		if (!validationResult.success) {
			throw createError(
				400,
				'Validation failed',
				'VALIDATION_ERROR',
				validationResult.error.issues
			);
		}

		const { event_id, cancellation_reason } = validationResult.data;

		// ============================================
		// 3. ПОИСК РЕГИСТРАЦИИ ПО userId + eventId
		// ============================================
		const registration = await getActiveRegistration(DB, user.id, event_id);

		if (!registration) {
			throw createError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
		}

		// ============================================
		// 4. ПРОВЕРКА ЧТО РЕГИСТРАЦИЯ НЕ ОТМЕНЕНА
		// ============================================
		if (registration.cancelled_at) {
			throw createError(400, 'Registration is already cancelled', 'ALREADY_CANCELLED', {
				cancelled_at: registration.cancelled_at,
			});
		}

		// ============================================
		// 5. ПОЛУЧЕНИЕ МЕРОПРИЯТИЯ
		// ============================================
		const event = await getEventById(DB, event_id);

		if (!event) {
			throw createError(404, 'Event not found', 'EVENT_NOT_FOUND');
		}

		// ============================================
		// 6. ПРОВЕРКА ЧТО ДО МЕРОПРИЯТИЯ > 3 ДНЕЙ
		// ============================================
		const now = new Date();
		const eventDate = new Date(event.date);
		const daysUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		if (daysUntilEvent <= 3) {
			throw createError(
				403,
				'Cannot cancel registration less than 3 days before event',
				'CANCELLATION_TOO_LATE',
				{
					event_date: event.date,
					days_until_event: daysUntilEvent,
					min_required_days: 3,
				}
			);
		}

		// ============================================
		// 7. ОТМЕНА РЕГИСТРАЦИИ
		// ============================================
		await cancelRegistration(
			DB,
			user.id,
			event_id,
			cancellation_reason || 'User cancelled registration'
		);

		// ============================================
		// 8. ЛОГИРОВАНИЕ ДЕЙСТВИЯ
		// ============================================
		const clientIP = getClientIP(request);

		await logActivity(
			DB,
			user.id,
			'registration_cancel',
			JSON.stringify({
				event_id: event_id,
				event_title: event.title_de,
				cancellation_reason: cancellation_reason || 'Not specified',
			}),
			clientIP || undefined
		);

		// ============================================
		// 9. ОТПРАВКА EMAIL ПОДТВЕРЖДЕНИЯ
		// ============================================

		// Определяем язык пользователя (из профиля, default 'de')
		const userLanguage: LanguageCode = (user.preferred_language as LanguageCode) || 'de';

		// Генерируем email шаблон
		const { subject, text } = getEventCancellationEmail(user, event, userLanguage);

		// Отправляем email (не блокируем если failed)
		try {
			await sendEmail(user.email, subject, text, platform.env);

			console.log(`[Cancellation] Confirmation email sent to ${user.email}`);
		} catch (emailError) {
			// Логируем ошибку, но не прерываем процесс отмены
			console.error('[Cancellation] Failed to send confirmation email:', emailError);
		}

		// ============================================
		// 10. ВОЗВРАТ УСПЕШНОГО ОТВЕТА
		// ============================================

		return json(
			{
				success: true,
			},
			{
				status: 200,
			}
		);
	} catch (error) {
		// Все ошибки обрабатываются через централизованный обработчик
		return handleApiError(error);
	}
}
