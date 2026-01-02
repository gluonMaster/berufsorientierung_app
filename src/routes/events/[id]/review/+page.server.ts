/**
 * Review page - Server-side logic
 * Загрузка данных для формы отзыва
 */

import { error, redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { DB } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Load функция - загружает данные для формы отзыва
 *
 * Требует аутентификации
 * Проверяет:
 * - Мероприятие существует
 * - Пользователь зарегистрирован на мероприятие
 * - Окно отзывов открыто
 * - Нет существующего отзыва
 */
export const load = async ({ request, platform, params }: RequestEvent) => {
	if (!platform?.env?.DB || !platform?.env?.JWT_SECRET) {
		throw error(500, 'Server configuration error');
	}

	// Проверяем аутентификацию
	const user = await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);

	const eventId = parseInt(params.id || '', 10);

	if (isNaN(eventId) || eventId <= 0) {
		throw redirect(303, '/profile?error=invalid_event');
	}

	try {
		// 1. Загружаем событие
		const event = await DB.events.getEventById(platform.env.DB, eventId);

		if (!event) {
			throw redirect(303, '/profile?error=event_not_found');
		}

		// 2. Проверяем что событие не отменено
		if (event.status === 'cancelled') {
			throw redirect(303, '/profile?error=event_cancelled');
		}

		// 3. Проверяем наличие end_date
		if (!event.end_date) {
			throw redirect(303, '/profile?error=no_end_date');
		}

		// 4. Проверяем регистрацию пользователя
		const isRegistered = await DB.registrations.isUserRegistered(
			platform.env.DB,
			user.id,
			eventId
		);

		if (!isRegistered) {
			throw redirect(303, '/profile?error=not_registered');
		}

		// 5. Проверяем окно отзывов
		const now = new Date();
		const reviewWindow = DB.reviews.getReviewWindow(event.end_date);
		const isWithinWindow = DB.reviews.isNowWithinWindow(now, event.end_date);

		if (!isWithinWindow) {
			throw redirect(303, '/profile?error=review_window_closed');
		}

		// 6. Проверяем существующий отзыв
		const existingReview = await DB.reviews.getUserReviewForEvent(
			platform.env.DB,
			user.id,
			eventId
		);

		// Получаем название события на нужном языке
		const preferredLang = user.preferred_language || 'de';

		return {
			user,
			event: {
				id: event.id,
				title_de: event.title_de,
				title_en: event.title_en,
				title_ru: event.title_ru,
				title_uk: event.title_uk,
				date: event.date,
				end_date: event.end_date,
				location_de: event.location_de,
				location_en: event.location_en,
				location_ru: event.location_ru,
				location_uk: event.location_uk,
			},
			reviewWindow: {
				start: reviewWindow.start.toISOString(),
				end: reviewWindow.end.toISOString(),
			},
			existingReview: existingReview
				? {
						id: existingReview.id,
						rating: existingReview.rating,
						comment: existingReview.comment,
						status: existingReview.status,
						created_at: existingReview.created_at,
					}
				: null,
			preferredLang,
		};
	} catch (err) {
		console.error('Error loading review page:', err);

		// Если это redirect, пробрасываем
		if (err && typeof err === 'object' && 'status' in err && (err as any).status === 303) {
			throw err;
		}

		// Если это error от SvelteKit, пробрасываем
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to load review page');
	}
};
