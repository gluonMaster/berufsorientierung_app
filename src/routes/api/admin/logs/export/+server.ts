/**
 * Admin Activity Logs Export API
 * Экспорт всех логов активности с учетом фильтров
 */

import { getDB } from '$lib/server/db';
import { requireAdmin } from '$lib/server/middleware/admin';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { ActivityLogActionType } from '$lib/types';

/**
 * GET /api/admin/logs/export
 * Экспортирует все логи активности, соответствующие фильтрам, в формате CSV
 */
export const GET: RequestHandler = async ({ platform, url, locals }) => {
	// Проверка прав администратора
	const adminCheck = await requireAdmin(platform, locals);
	if (!adminCheck.success) {
		throw error(403, adminCheck.error || 'Access denied');
	}

	const db = getDB(platform);

	try {
		// Получаем параметры фильтров из URL
		const userIdParam = url.searchParams.get('userId');
		const actionType = url.searchParams.get('actionType') as ActivityLogActionType | null;
		const dateFrom = url.searchParams.get('dateFrom');
		const dateTo = url.searchParams.get('dateTo');

		// Парсим параметры
		const userId = userIdParam ? parseInt(userIdParam, 10) : undefined;

		// Нормализуем диапазон дат (как в +page.server.ts)
		let normalizedDateFrom = dateFrom;
		let normalizedDateTo = dateTo;

		if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
			normalizedDateFrom = `${dateFrom} 00:00:00`;
		}

		if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
			normalizedDateTo = `${dateTo} 23:59:59`;
		}

		// Формируем SQL запрос с фильтрами (без лимита и offset)
		let query = `
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
			WHERE 1=1
		`;

		const params: any[] = [];

		if (userId && !isNaN(userId)) {
			query += ` AND al.user_id = ?`;
			params.push(userId);
		}

		if (actionType) {
			query += ` AND al.action_type = ?`;
			params.push(actionType);
		}

		if (normalizedDateFrom) {
			query += ` AND al.timestamp >= ?`;
			params.push(normalizedDateFrom);
		}

		if (normalizedDateTo) {
			query += ` AND al.timestamp <= ?`;
			params.push(normalizedDateTo);
		}

		query += ` ORDER BY al.timestamp DESC`;

		// Выполняем запрос
		const result = await db
			.prepare(query)
			.bind(...params)
			.all<any>();
		const logs = result.results || [];

		// Формируем CSV
		const headers = [
			'Timestamp',
			'User ID',
			'User Email',
			'User Name',
			'Action',
			'Details',
			'IP Address',
		];

		const rows = logs.map((log) => [
			log.timestamp || '',
			log.user_id?.toString() || '',
			log.user_email || '',
			log.user_full_name || '',
			log.action_type || '',
			log.details || '',
			log.ip_address || '',
		]);

		// Объединяем в CSV строку
		const csvContent = [
			headers.join(','),
			...rows.map((row) =>
				row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
			),
		].join('\n');

		// Возвращаем CSV файл
		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `activity_logs_full_${timestamp}.csv`;

		return new Response(csvContent, {
			status: 200,
			headers: {
				'Content-Type': 'text/csv;charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		console.error('Error exporting activity logs:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
