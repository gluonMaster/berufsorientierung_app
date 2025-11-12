/**
 * Admin Activity Logs Page - Server Side
 * Серверная часть страницы логов активности
 */

import { DB, getDB } from '$lib/server/db';
import type { ServerLoad } from '@sveltejs/kit';
import type { ActivityLogActionType } from '$lib/types';

/**
 * Загрузка логов активности с фильтрами и пагинацией
 */
export const load: ServerLoad = async ({ platform, url }) => {
	const db = getDB(platform);

	try {
		// Получаем параметры из URL
		const userIdParam = url.searchParams.get('userId');
		const actionType = url.searchParams.get('actionType') as ActivityLogActionType | null;
		const dateFrom = url.searchParams.get('dateFrom');
		const dateTo = url.searchParams.get('dateTo');
		const pageParam = url.searchParams.get('page');

		// Парсим параметры
		const userId = userIdParam ? parseInt(userIdParam, 10) : undefined;
		const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
		const limit = 50;
		const offset = (page - 1) * limit;

		// Нормализуем диапазон дат
		// Если dateFrom = YYYY-MM-DD, добавляем 00:00:00
		// Если dateTo = YYYY-MM-DD, добавляем 23:59:59 (чтобы включить весь день)
		let normalizedDateFrom = dateFrom;
		let normalizedDateTo = dateTo;

		if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
			normalizedDateFrom = `${dateFrom} 00:00:00`;
		}

		if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
			normalizedDateTo = `${dateTo} 23:59:59`;
		}

		// Формируем фильтры для запроса
		const filters = {
			userId: userId && !isNaN(userId) ? userId : undefined,
			actionType: actionType || undefined,
			dateFrom: normalizedDateFrom || undefined,
			dateTo: normalizedDateTo || undefined,
			limit,
			offset,
		};

		// Получаем логи из БД
		const { logs, total } = await DB.activityLog.getActivityLog(db, filters);

		// Вычисляем пагинацию
		const totalPages = Math.ceil(total / limit);

		return {
			logs,
			total,
			currentPage: page,
			totalPages,
			filters: {
				userId: userId || null,
				actionType: actionType || null,
				dateFrom: dateFrom || null,
				dateTo: dateTo || null,
			},
		};
	} catch (error) {
		console.error('[Admin Logs] Ошибка при получении логов:', error);
		throw new Error('Не удалось загрузить логи активности');
	}
};
