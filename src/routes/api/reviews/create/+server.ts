/**
 * API Endpoint: POST /api/reviews/create
 * Создание отзыва авторизованным пользователем
 *
 * Требует авторизации
 *
 * Логика:
 * 1. Проверка авторизации (requireAuth)
 * 2. Валидация входных данных через reviewCreateSchema
 * 3. Проверки бизнес-правил:
 *    - Мероприятие существует и не отменено
 *    - У пользователя есть активная регистрация на это мероприятие
 *    - Сейчас внутри окна отзывов (по events.end_date)
 *    - У пользователя ещё нет отзыва на это мероприятие
 * 4. Создание отзыва через DB.reviews.createUserReview
 * 5. Логирование действия
 * 6. Возврат ID созданного отзыва
 *
 * Обработка ошибок:
 * - 400: валидация failed
 * - 401: не авторизован
 * - 403: регистрация отменена / окно закрыто
 * - 404: мероприятие не найдено
 * - 409: отзыв уже существует
 * - 500: server error
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, createError } from '$lib/server/middleware/errorHandler';
import { reviewCreateSchema } from '$lib/server/validation/schemas';
import { DB as dbUtils } from '$lib/server/db';

/**
 * POST /api/reviews/create
 * Создание отзыва авторизованным пользователем
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

		// Валидация через Zod схему reviewCreateSchema
		const validationResult = reviewCreateSchema.safeParse(body);

		if (!validationResult.success) {
			throw createError(
				400,
				'Validation failed',
				'VALIDATION_ERROR',
				validationResult.error.issues
			);
		}

		const { event_id, rating, comment, is_anonymous } = validationResult.data;

		// ============================================
		// 3. ПРОВЕРКА БИЗНЕС-ПРАВИЛ
		// ============================================

		// 3.1. Получаем мероприятие
		const event = await dbUtils.events.getEventById(DB, event_id);

		if (!event) {
			throw createError(404, 'Event not found', 'EVENT_NOT_FOUND');
		}

		// 3.2. Проверяем что мероприятие не отменено
		if (event.status === 'cancelled') {
			throw createError(403, 'Cannot review a cancelled event', 'EVENT_CANCELLED');
		}

		// 3.3. Проверяем наличие end_date
		if (!event.end_date) {
			throw createError(
				403,
				'Event has no end date, cannot accept reviews',
				'EVENT_NO_END_DATE'
			);
		}

		// 3.4. Проверяем активную регистрацию пользователя
		const isRegistered = await dbUtils.registrations.isUserRegistered(DB, user.id, event_id);

		if (!isRegistered) {
			throw createError(403, 'User is not registered for this event', 'NOT_REGISTERED');
		}

		// 3.5. Проверяем окно отзывов
		const now = new Date();
		if (!dbUtils.reviews.isNowWithinWindow(now, event.end_date)) {
			const window = dbUtils.reviews.getReviewWindow(event.end_date);
			throw createError(
				403,
				`Review window is from ${window.start.toISOString()} to ${window.end.toISOString()}`,
				'REVIEW_WINDOW_CLOSED',
				{
					window_start: window.start.toISOString(),
					window_end: window.end.toISOString(),
				}
			);
		}

		// ============================================
		// 4. СОЗДАНИЕ ОТЗЫВА
		// ============================================
		// createUserReview также проверяет бизнес-правила и выбрасывает ошибку,
		// если отзыв уже существует
		let review;
		try {
			review = await dbUtils.reviews.createUserReview(
				DB,
				user.id,
				event_id,
				rating,
				comment,
				is_anonymous
			);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';

			// Обработка специфических ошибок из createUserReview
			if (errorMessage.includes('already submitted')) {
				throw createError(
					409,
					'User has already submitted a review for this event',
					'REVIEW_EXISTS'
				);
			}
			if (errorMessage.includes('not registered')) {
				throw createError(403, 'User is not registered for this event', 'NOT_REGISTERED');
			}
			if (errorMessage.includes('Review window')) {
				throw createError(403, errorMessage, 'REVIEW_WINDOW_CLOSED');
			}
			if (errorMessage.includes('cancelled event')) {
				throw createError(403, 'Cannot review a cancelled event', 'EVENT_CANCELLED');
			}
			if (errorMessage.includes('no end date')) {
				throw createError(403, 'Event has no end date', 'EVENT_NO_END_DATE');
			}

			throw err;
		}

		// ============================================
		// 5. ЛОГИРОВАНИЕ
		// ============================================
		try {
			const clientIP = getClientIP(request);
			await dbUtils.activityLog.logActivity(
				DB,
				user.id,
				'review_create',
				JSON.stringify({
					event_id,
					review_id: review.id,
					rating,
					is_anonymous,
				}),
				clientIP || 'unknown'
			);
		} catch (logError) {
			// Ошибка логирования не должна влиять на основной результат
			console.error('Error logging review creation:', logError);
		}

		// ============================================
		// 6. УСПЕШНЫЙ ОТВЕТ
		// ============================================
		return json(
			{
				success: true,
				reviewId: review.id,
			},
			{ status: 201 }
		);
	} catch (error) {
		return handleApiError(error);
	}
}
