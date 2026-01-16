/**
 * API Endpoint: POST /api/admin/events/set-listed
 *
 * Управление флагом is_listed для мероприятия
 * Флаг влияет только на отображение на странице /events
 *
 * @returns 200 OK с результатом обновления
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { getDB } from '$lib/server/db';
import { logActivity } from '$lib/server/db/activityLog';

/**
 * Zod схема для валидации запроса
 */
const setListedSchema = z.object({
	event_id: z.number().int().positive('Event ID must be a positive integer'),
	is_listed: z.boolean(),
});

/**
 * POST /api/admin/events/set-listed
 * Изменение флага is_listed для мероприятия
 */
export async function POST({ request, platform }: RequestEvent) {
	try {
		const DB = getDB(platform);

		if (!platform?.env?.JWT_SECRET) {
			throw errors.internal('JWT secret not configured');
		}

		const JWT_SECRET = platform.env.JWT_SECRET;

		// Проверка аутентификации и прав администратора
		const admin = await requireAdmin(request, DB, JWT_SECRET);

		// Парсинг и валидация запроса
		let requestData: unknown;
		try {
			requestData = await request.json();
		} catch {
			throw errors.badRequest('Invalid JSON in request body');
		}

		const validationResult = setListedSchema.safeParse(requestData);

		if (!validationResult.success) {
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const { event_id, is_listed } = validationResult.data;

		// Обновление is_listed в БД
		const result = await DB.prepare(
			`UPDATE events SET is_listed = ?, updated_at = datetime('now') WHERE id = ?`
		)
			.bind(is_listed ? 1 : 0, event_id)
			.run();

		if (!result.meta.changes || result.meta.changes === 0) {
			throw errors.notFound('Event not found');
		}

		// Логирование действия
		const ip = getClientIP(request) ?? undefined;
		await logActivity(
			DB,
			admin.id,
			'event_update',
			JSON.stringify({ event_id, updated_fields: ['is_listed'], is_listed }),
			ip
		);

		return json({
			success: true,
			event_id,
			is_listed,
		});
	} catch (error) {
		return handleApiError(error);
	}
}
