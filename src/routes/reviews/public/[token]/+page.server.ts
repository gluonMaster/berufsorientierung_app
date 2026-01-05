/**
 * Public Review Form - Server Load
 * Загрузка формы отзыва по публичной ссылке (без авторизации)
 */

import { getDB, DB } from '$lib/server/db';

/**
 * Load функция для публичной страницы отзыва
 *
 * Проверяет:
 * - Валидность токена
 * - Срок действия ссылки
 * - Окно отзывов
 */
export const load = async ({
	params,
	platform,
}: {
	params: { token: string };
	platform: App.Platform | undefined;
}) => {
	const db = getDB(platform);
	const { token } = params;

	// Получаем публичную ссылку по токену
	const link = await DB.reviews.getPublicLinkByToken(db, token);

	if (!link) {
		// Ссылка не найдена, истекла или отозвана
		return {
			error: 'invalid_link',
			event: null,
			canReview: false,
		};
	}

	// Получаем событие
	const event = await DB.events.getEventById(db, link.event_id);

	if (!event) {
		return {
			error: 'event_not_found',
			event: null,
			canReview: false,
		};
	}

	// Проверяем окно отзывов
	// Public links are controlled by expires_at, not by the event review window.
	if (event.status === 'cancelled') {
		return {
			error: 'not_available',
			event: {
				id: event.id,
				title_de: event.title_de,
				title_en: event.title_en,
				title_ru: event.title_ru,
				title_uk: event.title_uk,
				date: event.date,
				end_date: event.end_date,
			},
			canReview: false,
		};
	}

	// Всё ОК — можно оставить отзыв
	return {
		error: null,
		event: {
			id: event.id,
			title_de: event.title_de,
			title_en: event.title_en,
			title_ru: event.title_ru,
			title_uk: event.title_uk,
			date: event.date,
			end_date: event.end_date,
		},
		canReview: true,
		token,
	};
};
