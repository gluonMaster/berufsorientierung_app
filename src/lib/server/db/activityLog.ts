/**
 * Database utilities for Activity Logging
 * Утилиты для логирования активности пользователей
 */

import type { ActivityLog, ActivityLogWithUser, ActivityLogActionType } from '$lib/types';

// Тип D1Database доступен глобально через @cloudflare/workers-types
type D1Database = import('@cloudflare/workers-types').D1Database;

/**
 * Фильтры для получения логов активности
 */
export interface ActivityLogFilters {
	/** Фильтр по ID пользователя */
	userId?: number;

	/** Фильтр по типу действия */
	actionType?: ActivityLogActionType;

	/** Фильтр: дата начала периода (ISO формат) */
	dateFrom?: string;

	/** Фильтр: дата окончания периода (ISO формат) */
	dateTo?: string;

	/** Максимальное количество записей (по умолчанию 50) */
	limit?: number;

	/** Смещение для пагинации (по умолчанию 0) */
	offset?: number;
}

/**
 * Результат получения логов с пагинацией
 */
export interface ActivityLogResult {
	/** Массив логов активности */
	logs: ActivityLogWithUser[];

	/** Общее количество записей (для пагинации) */
	total: number;
}

/**
 * Записывает действие пользователя в лог
 * @param db - База данных D1
 * @param userId - ID пользователя (null для анонимных/системных действий)
 * @param actionType - Тип действия
 * @param details - Дополнительные детали действия (опционально)
 * @param ipAddress - IP адрес пользователя (опционально)
 */
export async function logActivity(
	db: D1Database,
	userId: number | null,
	actionType: ActivityLogActionType,
	details?: string,
	ipAddress?: string
): Promise<void> {
	try {
		await db
			.prepare(
				`INSERT INTO activity_log (user_id, action_type, details, ip_address, timestamp)
				VALUES (?, ?, ?, ?, datetime('now'))`
			)
			.bind(userId, actionType, details || null, ipAddress || null)
			.run();
	} catch (error) {
		console.error('[logActivity] Ошибка при записи лога:', error);
		// Не выбрасываем ошибку, чтобы не прерывать основной поток выполнения
		// Логирование не должно ломать функциональность приложения
	}
}

/**
 * Получает логи активности с фильтрами и пагинацией
 * @param db - База данных D1
 * @param filters - Фильтры для выборки логов
 * @returns Объект с массивом логов и общим количеством записей
 */
export async function getActivityLog(
	db: D1Database,
	filters: ActivityLogFilters = {}
): Promise<ActivityLogResult> {
	try {
		const { userId, actionType, dateFrom, dateTo, limit = 50, offset = 0 } = filters;

		// Строим WHERE условия
		const conditions: string[] = [];
		const bindings: (string | number)[] = [];

		if (userId !== undefined) {
			conditions.push('al.user_id = ?');
			bindings.push(userId);
		}

		if (actionType) {
			conditions.push('al.action_type = ?');
			bindings.push(actionType);
		}

		if (dateFrom) {
			conditions.push('al.timestamp >= ?');
			bindings.push(dateFrom);
		}

		if (dateTo) {
			conditions.push('al.timestamp <= ?');
			bindings.push(dateTo);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		// Получаем общее количество записей для пагинации
		const countQuery = `
			SELECT COUNT(*) as total
			FROM activity_log al
			${whereClause}
		`;

		const countResult = await db
			.prepare(countQuery)
			.bind(...bindings)
			.first<{ total: number }>();

		const total = countResult?.total || 0;

		// Получаем логи с JOIN к таблице users
		const logsQuery = `
			SELECT 
				al.id,
				al.user_id,
				al.action_type,
				al.details,
				al.ip_address,
				al.timestamp,
				u.email as user_email,
				(u.first_name || ' ' || u.last_name) as user_full_name
			FROM activity_log al
			LEFT JOIN users u ON al.user_id = u.id
			${whereClause}
			ORDER BY al.timestamp DESC
			LIMIT ? OFFSET ?
		`;

		const logsResult = await db
			.prepare(logsQuery)
			.bind(...bindings, limit, offset)
			.all<ActivityLogWithUser>();

		return {
			logs: logsResult.results || [],
			total,
		};
	} catch (error) {
		console.error('[getActivityLog] Ошибка при получении логов:', error);
		throw new Error('Не удалось получить логи активности');
	}
}

/**
 * Получает последние N действий в системе
 * @param db - База данных D1
 * @param limit - Количество записей (по умолчанию 20)
 * @returns Массив последних логов активности
 */
export async function getRecentActivity(
	db: D1Database,
	limit: number = 20
): Promise<ActivityLogWithUser[]> {
	try {
		const result = await db
			.prepare(
				`SELECT 
					al.id,
					al.user_id,
					al.action_type,
					al.details,
					al.ip_address,
					al.timestamp,
					u.email as user_email,
					(u.first_name || ' ' || u.last_name) as user_full_name
				FROM activity_log al
				LEFT JOIN users u ON al.user_id = u.id
				ORDER BY al.timestamp DESC
				LIMIT ?`
			)
			.bind(limit)
			.all<ActivityLogWithUser>();

		return result.results || [];
	} catch (error) {
		console.error('[getRecentActivity] Ошибка при получении последней активности:', error);
		throw new Error('Не удалось получить последнюю активность');
	}
}

/**
 * Получает логи активности для конкретного пользователя
 * @param db - База данных D1
 * @param userId - ID пользователя
 * @param limit - Максимальное количество записей (по умолчанию 50)
 * @returns Массив логов активности пользователя
 */
export async function getUserActivityLog(
	db: D1Database,
	userId: number,
	limit: number = 50
): Promise<ActivityLogWithUser[]> {
	try {
		const result = await db
			.prepare(
				`SELECT 
					al.id,
					al.user_id,
					al.action_type,
					al.details,
					al.ip_address,
					al.timestamp,
					u.email as user_email,
					(u.first_name || ' ' || u.last_name) as user_full_name
				FROM activity_log al
				LEFT JOIN users u ON al.user_id = u.id
				WHERE al.user_id = ?
				ORDER BY al.timestamp DESC
				LIMIT ?`
			)
			.bind(userId, limit)
			.all<ActivityLogWithUser>();

		return result.results || [];
	} catch (error) {
		console.error('[getUserActivityLog] Ошибка при получении логов пользователя:', error);
		throw new Error('Не удалось получить логи активности пользователя');
	}
}

/**
 * Получает статистику действий по типам за указанный период
 * @param db - База данных D1
 * @param dateFrom - Дата начала периода (опционально)
 * @param dateTo - Дата окончания периода (опционально)
 * @returns Массив объектов со статистикой по типам действий
 */
export async function getActivityStats(
	db: D1Database,
	dateFrom?: string,
	dateTo?: string
): Promise<Array<{ action_type: string; count: number }>> {
	try {
		const conditions: string[] = [];
		const bindings: string[] = [];

		if (dateFrom) {
			conditions.push('timestamp >= ?');
			bindings.push(dateFrom);
		}

		if (dateTo) {
			conditions.push('timestamp <= ?');
			bindings.push(dateTo);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const result = await db
			.prepare(
				`SELECT 
					action_type,
					COUNT(*) as count
				FROM activity_log
				${whereClause}
				GROUP BY action_type
				ORDER BY count DESC`
			)
			.bind(...bindings)
			.all<{ action_type: string; count: number }>();

		return result.results || [];
	} catch (error) {
		console.error('[getActivityStats] Ошибка при получении статистики:', error);
		throw new Error('Не удалось получить статистику активности');
	}
}

/**
 * Удаляет старые логи (старше указанного количества дней)
 * Используется для очистки базы и соблюдения GDPR
 * @param db - База данных D1
 * @param daysToKeep - Количество дней для хранения логов (по умолчанию 365)
 * @returns Количество удаленных записей
 */
export async function cleanOldLogs(db: D1Database, daysToKeep: number = 365): Promise<number> {
	try {
		const result = await db
			.prepare(
				`DELETE FROM activity_log
				WHERE timestamp < datetime('now', '-' || ? || ' days')`
			)
			.bind(daysToKeep)
			.run();

		return result.meta.changes || 0;
	} catch (error) {
		console.error('[cleanOldLogs] Ошибка при очистке старых логов:', error);
		throw new Error('Не удалось очистить старые логи');
	}
}
