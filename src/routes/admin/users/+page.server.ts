/**
 * Admin Users Management - Server Load
 * Загрузка данных пользователей для админ-панели
 */

import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/db/admin';
import { getDB } from '$lib/server/db';

/**
 * Интерфейс расширенных данных пользователя для админ-панели
 */
interface UserWithStats {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
	created_at: string;
	is_blocked: boolean;
	is_admin: boolean;
	is_superadmin: boolean;
	registrations_count: number;
	has_pending_deletion: boolean;
	pending_deletion_date: string | null;
}

/**
 * Load функция для страницы управления пользователями
 *
 * Загружает:
 * - Список всех пользователей с пагинацией
 * - Для каждого пользователя: статус админа, количество регистраций, запланированное удаление
 * - Поддерживает поиск и фильтрацию через URL параметры
 */
export const load = async ({
	locals,
	platform,
	url,
}: {
	locals: App.Locals;
	platform: App.Platform | undefined;
	url: URL;
}) => {
	// Проверка аутентификации
	if (!locals.user) {
		throw error(401, 'Требуется авторизация');
	}

	// Проверка прав администратора
	const db = getDB(platform);

	const userIsAdmin = await isAdmin(db, locals.user.id);
	if (!userIsAdmin) {
		throw error(403, 'Доступ запрещён');
	}

	// Получаем параметры из URL
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 50; // Фиксированный размер страницы
	const search = url.searchParams.get('search') || '';
	const filter = url.searchParams.get('filter') || 'all'; // all | admins | users | pending_deletion

	const offset = (page - 1) * pageSize;

	try {
		// Формируем базовый SQL запрос с учётом фильтров
		let whereConditions: string[] = [];
		let searchParams: (string | number)[] = [];

		// Поиск по имени или email
		if (search.trim()) {
			whereConditions.push(`(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`);
			const searchTerm = `%${search.trim()}%`;
			searchParams.push(searchTerm, searchTerm, searchTerm);
		}

		// Фильтр по роли/статусу
		if (filter === 'admins') {
			whereConditions.push('a.id IS NOT NULL');
		} else if (filter === 'users') {
			whereConditions.push('a.id IS NULL');
		} else if (filter === 'pending_deletion') {
			whereConditions.push('pd.id IS NOT NULL');
		}

		const whereClause =
			whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

		// Подсчитываем общее количество пользователей с учётом фильтров
		const countQuery = `
			SELECT COUNT(DISTINCT u.id) as count
			FROM users u
			LEFT JOIN admins a ON u.id = a.user_id
			LEFT JOIN pending_deletions pd ON u.id = pd.user_id
			${whereClause}
		`;

		const countResult = await db
			.prepare(countQuery)
			.bind(...searchParams)
			.first();

		const total = (countResult as any)?.count || 0;

		// Получаем пользователей с расширенной информацией
		const usersQuery = `
			SELECT 
				u.id,
				u.email,
				u.first_name,
				u.last_name,
				u.created_at,
				u.is_blocked,
				a.id as admin_id,
				a.created_by as admin_created_by,
				pd.id as pending_deletion_id,
				pd.deletion_date as pending_deletion_date,
				(SELECT COUNT(*) FROM registrations r WHERE r.user_id = u.id AND r.cancelled_at IS NULL) as registrations_count
			FROM users u
			LEFT JOIN admins a ON u.id = a.user_id
			LEFT JOIN pending_deletions pd ON u.id = pd.user_id
			${whereClause}
			ORDER BY u.created_at DESC
			LIMIT ? OFFSET ?
		`;

		interface DBUserRow {
			id: number;
			email: string;
			first_name: string;
			last_name: string;
			created_at: string;
			is_blocked: number;
			admin_id: number | null;
			admin_created_by: number | null;
			pending_deletion_id: number | null;
			pending_deletion_date: string | null;
			registrations_count: number;
		}

		const usersResult = await db
			.prepare(usersQuery)
			.bind(...searchParams, pageSize, offset)
			.all();

		// Преобразуем результаты в нужный формат
		const users: UserWithStats[] = (usersResult.results as unknown as DBUserRow[]).map(
			(row: DBUserRow) => ({
				id: row.id,
				email: row.email,
				first_name: row.first_name,
				last_name: row.last_name,
				created_at: row.created_at,
				is_blocked: Boolean(row.is_blocked),
				is_admin: row.admin_id !== null,
				is_superadmin: row.admin_id !== null && row.admin_created_by === null,
				registrations_count: row.registrations_count,
				has_pending_deletion: row.pending_deletion_id !== null,
				pending_deletion_date: row.pending_deletion_date,
			})
		);

		return {
			users,
			total,
			page,
			pageSize,
			search,
			filter,
			currentUser: locals.user,
		};
	} catch (err) {
		console.error('[Admin Users Load] Ошибка при загрузке пользователей:', err);
		throw error(500, 'Не удалось загрузить список пользователей');
	}
};
