/**
 * API Endpoint: POST /api/admin/reviews/reject
 *
 * Отклонение отзывов (только для администраторов)
 *
 * Функциональность:
 * - Отклонение отдельных отзывов по ID
 * - Массовое отклонение всех pending отзывов
 * - Логирование действия
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { moderateReviews } from '$lib/server/db/reviews';
import { logActivity } from '$lib/server/db/activityLog';
import { z } from 'zod';

// Схема валидации для reject
const rejectSchema = z
	.object({
		review_ids: z.array(z.number().int().positive()).optional(),
		all_pending: z.boolean().optional(),
	})
	.refine(
		(data) => {
			return (data.review_ids && data.review_ids.length > 0) || data.all_pending === true;
		},
		{
			message: 'Either specify review_ids or set all_pending to true',
			path: ['review_ids'],
		}
	);

export async function POST({ request, platform }: RequestEvent) {
	try {
		// Шаг 1: Проверка прав администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Парсинг и валидация входных данных
		const body = await request.json();
		const validation = rejectSchema.safeParse(body);

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

		const { review_ids, all_pending } = validation.data;

		// Шаг 3: Модерация отзывов
		const updated = await moderateReviews(platform!.env.DB, admin.id, {
			reviewIds: review_ids,
			allPending: all_pending,
			status: 'rejected',
		});

		// Шаг 4: Логирование действия
		const details = all_pending
			? `Rejected all pending reviews (${updated} total)`
			: `Rejected reviews: [${review_ids?.join(', ')}] (${updated} updated)`;

		await logActivity(
			platform!.env.DB,
			admin.id,
			'review_reject',
			details,
			getClientIP(request) ?? undefined
		);

		return json({
			success: true,
			updated,
		});
	} catch (error: any) {
		console.error('[POST /api/admin/reviews/reject] Error:', error);

		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message || 'Unauthorized' }, { status: error.status });
		}

		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
}
