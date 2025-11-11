import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/admin';
import { getDB } from '$lib/server/db';

export const load: ServerLoad = async ({ platform, locals }) => {
	// Проверка прав администратора
	const adminCheck = await requireAdmin(platform, locals);
	if (!adminCheck.success) {
		throw error(403, adminCheck.error || 'Access denied');
	}

	const db = getDB(platform);

	// Получение списка мероприятий для фильтра
	const eventsQuery = `
		SELECT 
			id, 
			title_de, 
			title_en, 
			title_ru, 
			title_uk, 
			date,
			status
		FROM events
		WHERE status IN ('active', 'draft')
		ORDER BY date DESC
	`;

	const events = await db.prepare(eventsQuery).all<{
		id: number;
		title_de: string;
		title_en: string | null;
		title_ru: string | null;
		title_uk: string | null;
		date: string;
		status: string;
	}>();

	// Получение статистики пользователей
	const statsQuery = `
		SELECT
			(SELECT COUNT(*) FROM users WHERE is_blocked = 0) as total_users,
			(SELECT COUNT(DISTINCT user_id) FROM registrations WHERE cancelled_at IS NULL) as users_with_registrations,
			(SELECT COUNT(DISTINCT user_id) FROM registrations r 
			 INNER JOIN events e ON r.event_id = e.id 
			 WHERE r.cancelled_at IS NULL AND e.date >= date('now')) as users_with_upcoming_events
	`;

	const stats = await db.prepare(statsQuery).first<{
		total_users: number;
		users_with_registrations: number;
		users_with_upcoming_events: number;
	}>();

	// Получение количества зарегистрированных пользователей по каждому мероприятию
	const countsByEventQuery = `
		SELECT 
			e.id, 
			COUNT(DISTINCT r.user_id) as count
		FROM events e
		LEFT JOIN registrations r ON e.id = r.event_id AND r.cancelled_at IS NULL
		WHERE e.status IN ('active', 'draft')
		GROUP BY e.id
	`;

	const countsByEventResult = await db.prepare(countsByEventQuery).all<{
		id: number;
		count: number;
	}>();

	// Преобразуем массив в объект Record<number, number>
	const countsByEvent: Record<number, number> = {};
	if (countsByEventResult.results) {
		for (const row of countsByEventResult.results) {
			countsByEvent[row.id] = row.count;
		}
	}

	return {
		events: events.results || [],
		stats: stats || {
			total_users: 0,
			users_with_registrations: 0,
			users_with_upcoming_events: 0,
		},
		countsByEvent,
	};
};
