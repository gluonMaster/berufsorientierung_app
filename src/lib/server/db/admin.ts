/**
 * Database utilities for Admin operations
 * Утилиты для работы с администраторами
 */

import type { Admin, AdminWithUser } from '$lib/types';

// Тип D1Database доступен глобально через @cloudflare/workers-types
type D1Database = import('@cloudflare/workers-types').D1Database;

/**
 * Проверяет, является ли пользователь администратором
 * @param db - База данных D1
 * @param userId - ID пользователя для проверки
 * @returns true если пользователь является администратором
 */
export async function isAdmin(db: D1Database, userId: number): Promise<boolean> {
	try {
		const result = await db
			.prepare('SELECT id FROM admins WHERE user_id = ?')
			.bind(userId)
			.first<{ id: number }>();

		return result !== null;
	} catch (error) {
		console.error('[isAdmin] Ошибка при проверке прав администратора:', error);
		throw new Error('Не удалось проверить права администратора');
	}
}

/**
 * Добавляет пользователя в администраторы
 * @param db - База данных D1
 * @param userId - ID пользователя, которому выдаются права
 * @param createdBy - ID администратора, который выдаёт права
 * @returns Созданная запись администратора
 * @throws Ошибка если пользователь не существует или уже является администратором
 */
export async function addAdmin(db: D1Database, userId: number, createdBy: number): Promise<Admin> {
	try {
		// Проверяем, существует ли пользователь
		const user = await db
			.prepare('SELECT id FROM users WHERE id = ?')
			.bind(userId)
			.first<{ id: number }>();

		if (!user) {
			throw new Error('Пользователь не найден');
		}

		// Проверяем, не является ли пользователь уже администратором
		const existingAdmin = await db
			.prepare('SELECT id FROM admins WHERE user_id = ?')
			.bind(userId)
			.first<{ id: number }>();

		if (existingAdmin) {
			throw new Error('Пользователь уже является администратором');
		}

		// Добавляем пользователя в администраторы
		const result = await db
			.prepare(
				`INSERT INTO admins (user_id, created_by, created_at)
				VALUES (?, ?, datetime('now'))
				RETURNING id, user_id, created_by, created_at`
			)
			.bind(userId, createdBy)
			.first<Admin>();

		if (!result) {
			throw new Error('Не удалось добавить администратора');
		}

		return result;
	} catch (error) {
		console.error('[addAdmin] Ошибка при добавлении администратора:', error);
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Не удалось добавить администратора');
	}
}

/**
 * Убирает права администратора у пользователя
 * @param db - База данных D1
 * @param userId - ID пользователя, у которого отзываются права
 * @throws Ошибка если пользователь не является администратором или это superadmin
 */
export async function removeAdmin(db: D1Database, userId: number): Promise<void> {
	try {
		// Проверяем, является ли пользователь администратором
		const admin = await db
			.prepare('SELECT id, created_by FROM admins WHERE user_id = ?')
			.bind(userId)
			.first<{ id: number; created_by: number | null }>();

		if (!admin) {
			throw new Error('Пользователь не является администратором');
		}

		// Нельзя убрать права у superadmin (created_by IS NULL)
		if (admin.created_by === null) {
			throw new Error('Нельзя убрать права у superadmin');
		}

		// Удаляем запись администратора
		const result = await db.prepare('DELETE FROM admins WHERE user_id = ?').bind(userId).run();

		if (!result.success) {
			throw new Error('Не удалось удалить администратора');
		}
	} catch (error) {
		console.error('[removeAdmin] Ошибка при удалении администратора:', error);
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Не удалось удалить администратора');
	}
}

/**
 * Возвращает список всех администраторов с информацией о пользователях
 * @param db - База данных D1
 * @returns Массив администраторов с данными пользователей
 */
export async function getAllAdmins(db: D1Database): Promise<AdminWithUser[]> {
	try {
		const result = await db
			.prepare(
				`SELECT 
					a.id,
					a.user_id,
					a.created_by,
					a.created_at,
					u.email as user_email,
					u.first_name as user_first_name,
					u.last_name as user_last_name,
					creator.email as created_by_email
				FROM admins a
				INNER JOIN users u ON a.user_id = u.id
				LEFT JOIN users creator ON a.created_by = creator.id
				ORDER BY a.created_at ASC`
			)
			.all<AdminWithUser>();

		return result.results || [];
	} catch (error) {
		console.error('[getAllAdmins] Ошибка при получении списка администраторов:', error);
		throw new Error('Не удалось получить список администраторов');
	}
}

/**
 * Получает информацию об администраторе по ID пользователя
 * @param db - База данных D1
 * @param userId - ID пользователя
 * @returns Информация об администраторе или null если не найден
 */
export async function getAdminByUserId(
	db: D1Database,
	userId: number
): Promise<AdminWithUser | null> {
	try {
		const result = await db
			.prepare(
				`SELECT 
					a.id,
					a.user_id,
					a.created_by,
					a.created_at,
					u.email as user_email,
					u.first_name as user_first_name,
					u.last_name as user_last_name,
					creator.email as created_by_email
				FROM admins a
				INNER JOIN users u ON a.user_id = u.id
				LEFT JOIN users creator ON a.created_by = creator.id
				WHERE a.user_id = ?`
			)
			.bind(userId)
			.first<AdminWithUser>();

		return result || null;
	} catch (error) {
		console.error('[getAdminByUserId] Ошибка при получении администратора:', error);
		throw new Error('Не удалось получить информацию об администраторе');
	}
}
