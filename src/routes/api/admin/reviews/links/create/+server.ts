/**
 * API Endpoint: POST /api/admin/reviews/links/create
 *
 * Создание публичной ссылки для отзывов на мероприятие (только для администраторов)
 *
 * Функциональность:
 * - Генерация уникального токена (base64url, 32 bytes)
 * - Хранение hash токена в БД
 * - Ограничение срока действия ссылки
 * - Логирование действия
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { getDB, DB } from '$lib/server/db';
import { logActivity } from '$lib/server/db/activityLog';
import { reviewPublicLinkCreateSchema } from '$lib/server/validation/schemas';

export async function POST({ request, platform }: RequestEvent) {
	try {
		const db = getDB(platform);

		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, db, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = reviewPublicLinkCreateSchema.safeParse(body);

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

		const { event_id, expires_at } = validation.data;

		// Шаг 3: Проверяем существование события
		const event = await DB.events.getEventById(db, event_id);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		if (!event.end_date) {
			return json(
				{ error: 'Event end date is required for review links' },
				{ status: 400 }
			);
		}

		// Шаг 4: Проверяем, что expires_at не позже end_date + 30 дней (анти-"вечные ссылки")
		const endDate = new Date(event.end_date);
		const maxExpiry = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);
		const expiryDate = new Date(expires_at);

		if (expiryDate > maxExpiry) {
			return json(
				{
					error: 'Expiration date cannot be more than 30 days after event end date',
				},
				{ status: 400 }
			);
		}

		// Шаг 5: Создаем публичную ссылку
		const result = await DB.reviews.createReviewPublicLink(db, event_id, admin.id, expires_at);

		// Шаг 6: Логируем действие
		await logActivity(
			db,
			admin.id,
			'review_public_link_create',
			`Created public review link for event ${event_id}, expires at ${expires_at}`,
			getClientIP(request) ?? undefined
		);

		return json(
			{
				success: true,
				token: result.token,
				expires_at: result.expires_at,
				event_id,
			},
			{ status: 201 }
		);
	} catch (error: any) {
		console.error('[POST /api/admin/reviews/links/create] Error:', error);

		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message || 'Unauthorized' }, { status: error.status });
		}

		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
