/**
 * API Endpoint: POST /api/reviews/public
 *
 * Отправка отзыва через публичную ссылку (без авторизации)
 *
 * Функциональность:
 * - Валидация токена публичной ссылки
 * - Проверка окна отзывов
 * - Создание отзыва со статусом pending
 *
 * НЕ требует авторизации
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { getDB, DB } from '$lib/server/db';
import { publicReviewCreateSchema } from '$lib/server/validation/schemas';

export async function POST({ request, platform }: RequestEvent) {
	try {
		const db = getDB(platform);

		// Шаг 1: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = publicReviewCreateSchema.safeParse(body);

		if (!validation.success) {
			return json(
				{
					error: 'Validation failed',
					details: validation.error.issues.map((issue) => ({
						field: issue.path.join('.'),
						message: issue.message,
					})),
				},
				{ status: 400 }
			);
		}

		const { token, rating, comment, is_anonymous, public_display_name } = validation.data;

		// Шаг 2: Создаем отзыв через публичную ссылку
		// Функция createPublicReview сама проверяет:
		// - валидность токена
		// - не истекла ли ссылка
		// - существует ли событие
		// - открыто ли окно отзывов
		const review = await DB.reviews.createPublicReview(
			db,
			token,
			rating,
			comment,
			is_anonymous,
			public_display_name ?? undefined
		);

		return json(
			{
				success: true,
				reviewId: review.id,
			},
			{ status: 201 }
		);
	} catch (error: any) {
		console.error('[POST /api/reviews/public] Error:', error);

		// Обработка известных ошибок
		const knownErrors = [
			'Invalid or expired public link',
			'Event not found',
			'Cannot review a cancelled event',
			'Event has no end date',
			'Review window is from',
		];

		const isKnownError = knownErrors.some((msg) => error.message?.includes(msg));

		if (isKnownError) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
