/**
 * Admin Reviews Moderation - Server Load
 * Загрузка отзывов для модерации в админ-панели
 */

import { error } from '@sveltejs/kit';
import { getDB, DB } from '$lib/server/db';
import type { ReviewAdminFilters } from '$lib/types/review';

/**
 * Load функция для страницы модерации отзывов
 *
 * Загружает:
 * - Список pending отзывов с пагинацией
 * - Список событий для генератора ссылок
 * - Поддерживает фильтрацию через URL параметры
 */
export const load = async ({
	locals,
	platform,
	url,
}: {
	locals: App.Locals;
	platform: App.Platform | undefined;
	url: URL;
}) => {
	// Проверка аутентификации (админ уже проверен в layout)
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}

	const db = getDB(platform);

	// Параметры пагинации из URL
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const limit = Math.min(50, Math.max(10, parseInt(url.searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;

	// Получаем статус фильтрации (по умолчанию pending)
	const status = (url.searchParams.get('status') || 'pending') as
		| 'pending'
		| 'approved'
		| 'rejected';

	// Фильтры для запроса
	const filters: ReviewAdminFilters = {
		status,
		limit,
		offset,
	};

	try {
		// Загружаем отзывы
		const result = await DB.reviews.listReviewsForAdmin(db, filters);

		// Вычисляем общее количество страниц
		const totalPages = Math.ceil(result.total / limit);

		// Загружаем события для генератора публичных ссылок
		const eventsResult = await DB.events.getAllEvents(db, { limit: 200, offset: 0 });

		return {
			reviews: result.items,
			total: result.total,
			page,
			limit,
			totalPages,
			status,
			events: eventsResult.events.map((e) => ({
				id: e.id,
				title_de: e.title_de,
				title_en: e.title_en,
				title_ru: e.title_ru,
				title_uk: e.title_uk,
				date: e.date,
				end_date: e.end_date,
				status: e.status,
			})),
		};
	} catch (err) {
		console.error('[Admin Reviews] Error loading reviews:', err);
		throw error(500, 'Ошибка при загрузке отзывов');
	}
};
