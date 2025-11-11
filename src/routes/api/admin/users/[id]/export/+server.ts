/**
 * API Endpoint: Export User Data
 * Экспорт всех данных пользователя в JSON формате (GDPR compliance)
 */

import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { isAdmin } from '$lib/server/db/admin';
import { getUserById } from '$lib/server/db/users';
import { logActivity } from '$lib/server/db/activityLog';

export async function GET({
	params,
	locals,
	platform,
	getClientAddress,
}: {
	params: { id: string };
	locals: App.Locals;
	platform: App.Platform | undefined;
	getClientAddress: () => string;
}) {
	// Проверка аутентификации
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}

	const db = getDB(platform);

	// Проверка прав администратора
	const currentUserIsAdmin = await isAdmin(db, locals.user.id);
	if (!currentUserIsAdmin) {
		throw error(403, 'Доступ запрещён');
	}

	try {
		// Получаем ID пользователя из URL
		const userId = parseInt(params.id);
		if (isNaN(userId)) {
			throw error(400, 'Некорректный ID пользователя');
		}

		// Получаем данные пользователя
		const user = await getUserById(db, userId);
		if (!user) {
			throw error(404, 'Пользователь не найден');
		}

		// Получаем все регистрации пользователя
		const registrationsResult = await db
			.prepare(
				`
				SELECT 
					r.id,
					r.event_id,
					r.registered_at,
					r.cancelled_at,
					r.cancellation_reason,
					r.additional_data,
					e.title_de as event_title,
					e.date as event_date,
					e.location_de as event_location
				FROM registrations r
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.user_id = ?
				ORDER BY r.registered_at DESC
			`
			)
			.bind(userId)
			.all();

		// Получаем историю активности пользователя
		const activityResult = await db
			.prepare(
				`
				SELECT 
					id,
					action_type,
					details,
					ip_address,
					timestamp
				FROM activity_log
				WHERE user_id = ?
				ORDER BY timestamp DESC
				LIMIT 100
			`
			)
			.bind(userId)
			.all();

		// Проверяем, есть ли запланированное удаление
		const pendingDeletionResult = await db
			.prepare('SELECT deletion_date, created_at FROM pending_deletions WHERE user_id = ?')
			.bind(userId)
			.first();

		// Формируем объект экспорта (без password_hash для безопасности)
		const exportData = {
			user: {
				id: user.id,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				birth_date: user.birth_date,
				address_street: user.address_street,
				address_number: user.address_number,
				address_zip: user.address_zip,
				address_city: user.address_city,
				phone: user.phone,
				whatsapp: user.whatsapp,
				telegram: user.telegram,
				photo_video_consent: user.photo_video_consent,
				preferred_language: user.preferred_language,
				parental_consent: user.parental_consent,
				is_blocked: user.is_blocked,
				created_at: user.created_at,
				updated_at: user.updated_at,
			},
			registrations: registrationsResult.results || [],
			activity_log: activityResult.results || [],
			pending_deletion: pendingDeletionResult || null,
			exported_at: new Date().toISOString(),
			exported_by: locals.user.email,
		};

		// Логируем экспорт данных
		await logActivity(
			db,
			locals.user.id,
			'admin_export_user_data',
			JSON.stringify({
				targetUserId: userId,
				targetUserEmail: user.email,
			}),
			getClientAddress()
		);

		// Формируем имя файла
		const filename = `user_${userId}_${user.email.replace('@', '_at_')}_${new Date().toISOString().split('T')[0]}.json`;

		// Возвращаем JSON как downloadable файл
		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	} catch (err: any) {
		console.error('[export-user-data] Error:', err);

		// Если это уже HTTP ошибка, пробросить её
		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Не удалось экспортировать данные пользователя');
	}
}
