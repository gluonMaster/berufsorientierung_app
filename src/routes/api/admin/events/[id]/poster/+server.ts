/**
 * API Endpoints: POST/DELETE /api/admin/events/[id]/poster
 *
 * Управление постером мероприятия (только для администраторов)
 *
 * POST: Загрузка/замена постера
 * - Поддерживаемые форматы: JPEG, PNG, GIF
 * - Максимальный размер: 5MB
 * - Файл сохраняется в R2, URL сохраняется в events.poster_url
 *
 * DELETE: Удаление постера
 * - Удаляет файл из R2 и очищает events.poster_url
 *
 * Требует: Admin права
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { getEventById } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';
import { getR2Bucket, uploadFile, deleteFileByUrl, getPublicUrl } from '$lib/server/storage/r2';

/** Максимальный размер файла в байтах (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Разрешённые MIME-типы */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

/** Расширения файлов для MIME-типов */
const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
};

/**
 * POST - Загрузка/замена постера мероприятия
 */
export async function POST({ params, request, platform }: RequestEvent) {
	const eventId = parseInt(params.id || '0');

	// Валидация ID
	if (isNaN(eventId) || eventId <= 0) {
		return json({ error: 'Invalid event ID' }, { status: 400 });
	}

	try {
		const db = platform?.env?.DB;
		const jwtSecret = platform?.env?.JWT_SECRET;
		const r2Bucket = platform?.env?.R2_BUCKET;
		const r2PublicUrl = platform?.env?.R2_PUBLIC_URL;

		if (!db || !jwtSecret) {
			return json({ error: 'Database or JWT secret not configured' }, { status: 500 });
		}

		if (!r2Bucket || !r2PublicUrl) {
			return json({ error: 'R2 storage not configured' }, { status: 500 });
		}

		// Проверка прав администратора
		const admin = await requireAdmin(request, db, jwtSecret);

		// Получение события
		const event = await getEventById(db, eventId);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		// Парсинг formData
		let formData: FormData;
		try {
			formData = await request.formData();
		} catch {
			return json({ error: 'Invalid form data' }, { status: 400 });
		}

		const file = formData.get('file');

		// Валидация файла
		if (!file || !(file instanceof File)) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (file.size === 0) {
			return json({ error: 'Empty file provided' }, { status: 400 });
		}

		if (file.size > MAX_FILE_SIZE) {
			return json(
				{
					error: 'File too large',
					message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
					max_size_bytes: MAX_FILE_SIZE,
				},
				{ status: 400 }
			);
		}

		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return json(
				{
					error: 'Invalid file type',
					message: 'Only JPEG, PNG, and GIF images are allowed',
					allowed_types: ALLOWED_MIME_TYPES,
				},
				{ status: 400 }
			);
		}

		// Сохранение старого URL для последующего удаления
		const oldPosterUrl = event.poster_url;

		// Генерация ключа с версионированием для cache-busting
		const ext = MIME_TO_EXT[file.type] || 'jpg';
		const key = `event-posters/event-${eventId}-${Date.now()}.${ext}`;

		// Загрузка файла в R2
		const bucket = getR2Bucket(platform);
		const fileData = new Uint8Array(await file.arrayBuffer());
		await uploadFile(bucket, key, fileData, file.type);

		// Формирование публичного URL
		const posterUrl = getPublicUrl(key, r2PublicUrl);

		// Обновление URL в БД
		await db
			.prepare(`UPDATE events SET poster_url = ?, updated_at = datetime('now') WHERE id = ?`)
			.bind(posterUrl, eventId)
			.run();

		// Удаление старого постера из R2 (best-effort)
		if (oldPosterUrl) {
			try {
				await deleteFileByUrl(bucket, oldPosterUrl);
			} catch (deleteError) {
				console.warn(
					`[POST /api/admin/events/${eventId}/poster] Failed to delete old poster:`,
					deleteError
				);
				// Не прерываем успешную загрузку из-за ошибки удаления старого файла
			}
		}

		// Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: eventId,
			event_title: event.title_de,
			poster_url: posterUrl,
			file_size: file.size,
			file_type: file.type,
			replaced_old: !!oldPosterUrl,
			ip,
		});
		await logActivity(db, admin.id, 'event_poster_upload', logDetails, ip || undefined);

		return json({
			success: true,
			poster_url: posterUrl,
		});
	} catch (error: any) {
		console.error(`[POST /api/admin/events/${eventId}/poster] Error:`, error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		return json(
			{
				error: 'Failed to upload poster',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

/**
 * DELETE - Удаление постера мероприятия
 */
export async function DELETE({ params, request, platform }: RequestEvent) {
	const eventId = parseInt(params.id || '0');

	// Валидация ID
	if (isNaN(eventId) || eventId <= 0) {
		return json({ error: 'Invalid event ID' }, { status: 400 });
	}

	try {
		const db = platform?.env?.DB;
		const jwtSecret = platform?.env?.JWT_SECRET;
		const r2Bucket = platform?.env?.R2_BUCKET;

		if (!db || !jwtSecret) {
			return json({ error: 'Database or JWT secret not configured' }, { status: 500 });
		}

		// Проверка прав администратора
		const admin = await requireAdmin(request, db, jwtSecret);

		// Получение события
		const event = await getEventById(db, eventId);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		const oldPosterUrl = event.poster_url;

		// Если постера нет — идемпотентный успех
		if (!oldPosterUrl) {
			return json({ success: true, message: 'No poster to delete' });
		}

		// Очистка URL в БД
		await db
			.prepare(
				`UPDATE events SET poster_url = NULL, updated_at = datetime('now') WHERE id = ?`
			)
			.bind(eventId)
			.run();

		// Удаление файла из R2 (best-effort)
		if (r2Bucket) {
			try {
				const bucket = getR2Bucket(platform);
				await deleteFileByUrl(bucket, oldPosterUrl);
			} catch (deleteError) {
				console.warn(
					`[DELETE /api/admin/events/${eventId}/poster] Failed to delete poster from R2:`,
					deleteError
				);
				// Не прерываем успешное удаление из-за ошибки R2
			}
		}

		// Логирование действия
		const ip = getClientIP(request);
		const logDetails = JSON.stringify({
			event_id: eventId,
			event_title: event.title_de,
			deleted_poster_url: oldPosterUrl,
			ip,
		});
		await logActivity(db, admin.id, 'event_poster_delete', logDetails, ip || undefined);

		return json({ success: true });
	} catch (error: any) {
		console.error(`[DELETE /api/admin/events/${eventId}/poster] Error:`, error);

		// Обработка ошибок авторизации
		if (error.status === 401 || error.status === 403) {
			return json({ error: error.message }, { status: error.status });
		}

		return json(
			{
				error: 'Failed to delete poster',
				message: error.message || 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
