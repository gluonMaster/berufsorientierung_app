/**
 * Admin Statistics Page - Server Side
 * Серверная часть страницы статистики для админки
 */

import { getDB } from '$lib/server/db';
import type { ServerLoad } from '@sveltejs/kit';

/**
 * Общая статистика для дашборда
 */
interface GeneralStats {
	/** Всего пользователей */
	totalUsers: number;
	/** Регистрации пользователей по месяцам (последние 12 месяцев) */
	usersByMonth: Array<{ month: string; count: number }>;
	/** Мероприятия по статусам */
	eventsByStatus: Array<{ status: string; count: number }>;
	/** Всего регистраций */
	totalRegistrations: number;
	/** Регистрации на мероприятия по месяцам */
	registrationsByMonth: Array<{ month: string; count: number }>;
	/** Регистрации, сгруппированные по статусу мероприятия */
	registrationsByStatus: Array<{ status: string; count: number }>;
	/** Средняя заполняемость мероприятий (%) */
	averageOccupancy: number;
	/** Топ-3 популярных мероприятий */
	topEvents: Array<{
		id: number;
		title_de: string;
		title_en: string | null;
		title_ru: string | null;
		title_uk: string | null;
		registrations: number;
		max_participants: number | null;
	}>;
}

/**
 * Детальная статистика по прошедшим мероприятиям
 */
interface EventStat {
	id: number;
	title_de: string;
	title_en: string | null;
	title_ru: string | null;
	title_uk: string | null;
	date: string;
	max_participants: number | null;
	registrations_count: number;
	occupancy_percent: number | null;
}

/**
 * Загрузка данных статистики
 */
export const load: ServerLoad = async ({ platform, locals }) => {
	const db = getDB(platform);

	try {
		// --- ОБЩАЯ СТАТИСТИКА ---

		// 1. Всего пользователей
		const totalUsersResult = await db
			.prepare('SELECT COUNT(*) as count FROM users WHERE is_blocked = 0')
			.first<{ count: number }>();
		const totalUsers = totalUsersResult?.count || 0;

		// 2. Регистрации пользователей по месяцам (последние 12 месяцев)
		const usersByMonthResult = await db
			.prepare(
				`SELECT 
					strftime('%Y-%m', created_at) as month,
					COUNT(*) as count
				FROM users
				WHERE is_blocked = 0
					AND created_at >= date('now', '-12 months')
				GROUP BY strftime('%Y-%m', created_at)
				ORDER BY month ASC`
			)
			.all<{ month: string; count: number }>();
		const usersByMonth = usersByMonthResult.results || [];

		// 3. Мероприятия по статусам
		const eventsByStatusResult = await db
			.prepare(
				`SELECT 
					status,
					COUNT(*) as count
				FROM events
				GROUP BY status
				ORDER BY count DESC`
			)
			.all<{ status: string; count: number }>();
		const eventsByStatus = eventsByStatusResult.results || [];

		// 4. Всего регистраций
		const totalRegistrationsResult = await db
			.prepare('SELECT COUNT(*) as count FROM registrations WHERE cancelled_at IS NULL')
			.first<{ count: number }>();
		const totalRegistrations = totalRegistrationsResult?.count || 0;

		// 5. Регистрации на мероприятия по месяцам (последние 12 месяцев)
		const registrationsByMonthResult = await db
			.prepare(
				`SELECT 
					strftime('%Y-%m', registered_at) as month,
					COUNT(*) as count
				FROM registrations
				WHERE cancelled_at IS NULL
					AND registered_at >= date('now', '-12 months')
				GROUP BY strftime('%Y-%m', registered_at)
				ORDER BY month ASC`
			)
			.all<{ month: string; count: number }>();
		const registrationsByMonth = registrationsByMonthResult.results || [];

		// 6. Регистрации, сгруппированные по статусу мероприятия (для pie chart)
		const registrationsByStatusResult = await db
			.prepare(
				`SELECT 
					e.status,
					COUNT(r.id) as count
				FROM registrations r
				JOIN events e ON r.event_id = e.id
				WHERE r.cancelled_at IS NULL
				GROUP BY e.status
				ORDER BY count DESC`
			)
			.all<{ status: string; count: number }>();
		const registrationsByStatus = registrationsByStatusResult.results || [];

		// 7. Средняя заполняемость мероприятий
		// Считаем только для мероприятий с лимитом участников (исключаем 0 и NULL)
		const averageOccupancyResult = await db
			.prepare(
				`SELECT 
					AVG(
						CAST(
							(SELECT COUNT(*) FROM registrations r 
							 WHERE r.event_id = e.id AND r.cancelled_at IS NULL) 
							AS REAL
						) * 100.0 / e.max_participants
					) as avg_occupancy
				FROM events e
				WHERE e.max_participants IS NOT NULL
					AND e.max_participants > 0
					AND e.status = 'active'
					AND e.date < datetime('now')`
			)
			.first<{ avg_occupancy: number | null }>();
		const averageOccupancy = Math.round(averageOccupancyResult?.avg_occupancy || 0);

		// 8. Топ-3 популярных мероприятия
		const topEventsResult = await db
			.prepare(
				`SELECT 
					e.id,
					e.title_de,
					e.title_en,
					e.title_ru,
					e.title_uk,
					e.max_participants,
					COUNT(r.id) as registrations
				FROM events e
				LEFT JOIN registrations r ON e.id = r.event_id AND r.cancelled_at IS NULL
				WHERE e.status IN ('active', 'cancelled')
				GROUP BY e.id
				ORDER BY registrations DESC
				LIMIT 3`
			)
			.all<{
				id: number;
				title_de: string;
				title_en: string | null;
				title_ru: string | null;
				title_uk: string | null;
				registrations: number;
				max_participants: number | null;
			}>();
		const topEvents = topEventsResult.results || [];

		// --- ДЕТАЛЬНАЯ СТАТИСТИКА ПО ПРОШЕДШИМ МЕРОПРИЯТИЯМ ---

		const eventStatsResult = await db
			.prepare(
				`SELECT 
					e.id,
					e.title_de,
					e.title_en,
					e.title_ru,
					e.title_uk,
					e.date,
					e.max_participants,
					COUNT(r.id) as registrations_count,
					CASE 
						WHEN e.max_participants IS NOT NULL THEN
							ROUND(
								CAST(COUNT(r.id) AS REAL) * 100.0 / e.max_participants,
								1
							)
						ELSE NULL
					END as occupancy_percent
				FROM events e
				LEFT JOIN registrations r ON e.id = r.event_id AND r.cancelled_at IS NULL
				WHERE e.date < datetime('now')
					AND e.status IN ('active', 'cancelled')
				GROUP BY e.id
				ORDER BY e.date DESC`
			)
			.all<EventStat>();
		const eventStats = eventStatsResult.results || [];

		// Формируем ответ
		const generalStats: GeneralStats = {
			totalUsers,
			usersByMonth,
			eventsByStatus,
			totalRegistrations,
			registrationsByMonth,
			registrationsByStatus,
			averageOccupancy,
			topEvents,
		};

		return {
			generalStats,
			eventStats,
		};
	} catch (error) {
		console.error('[Admin Stats] Ошибка при получении статистики:', error);
		throw new Error('Не удалось загрузить статистику');
	}
};
