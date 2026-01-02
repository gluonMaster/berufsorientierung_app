/**
 * Server-side загрузка данных для страницы отзывов
 *
 * Загружает одобренные отзывы с пагинацией
 */

import { getApprovedReviews } from '$lib/server/db/reviews';
import type { PublicReview } from '$lib/types/review';

const REVIEWS_PER_PAGE = 12;

export interface ReviewsPageData {
	reviews: PublicReview[];
	total: number;
	page: number;
	totalPages: number;
	hasMore: boolean;
}

export const load = async ({
	platform,
	url,
}: {
	platform: any;
	url: URL;
}): Promise<ReviewsPageData> => {
	try {
		// Получаем D1 базу данных из platform
		const db = platform?.env?.DB;

		if (!db) {
			throw new Error('Database not available');
		}

		// Получаем номер страницы из query params
		const pageParam = url.searchParams.get('page');
		const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
		const offset = (page - 1) * REVIEWS_PER_PAGE;

		// Загружаем отзывы
		const { items, total } = await getApprovedReviews(db, {
			limit: REVIEWS_PER_PAGE,
			offset,
		});

		const totalPages = Math.ceil(total / REVIEWS_PER_PAGE);

		return {
			reviews: items,
			total,
			page,
			totalPages,
			hasMore: page < totalPages,
		};
	} catch (error) {
		console.error('Error loading reviews page:', error);

		return {
			reviews: [],
			total: 0,
			page: 1,
			totalPages: 0,
			hasMore: false,
		};
	}
};
