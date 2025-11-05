/**
 * Database utilities for Users
 * Функции для работы с таблицей users в D1 базе данных
 *
 * ВАЖНО: Все функции используют prepared statements для защиты от SQL injection
 * Все даты в ISO формате (YYYY-MM-DD или YYYY-MM-DDTHH:MM:SS)
 */

import type { User, UserRegistrationData, UserUpdateData, UserListItem } from '$lib/types/user';

// Тип D1Database доступен глобально через @cloudflare/workers-types
// Но для локальной разработки создаём alias
type D1Database = import('@cloudflare/workers-types').D1Database;

/**
 * Интерфейс для строки из таблицы users в БД
 * SQLite возвращает INTEGER как number, TEXT как string
 */
interface DBUserRow {
	id: number;
	email: string;
	password_hash: string;
	first_name: string;
	last_name: string;
	birth_date: string;
	address_street: string;
	address_number: string;
	address_zip: string;
	address_city: string;
	phone: string;
	whatsapp: string | null;
	telegram: string | null;
	photo_video_consent: number; // SQLite boolean как 0/1
	preferred_language: string; // 'de' | 'en' | 'ru' | 'uk'
	parental_consent: number; // SQLite boolean как 0/1
	is_blocked: number; // SQLite boolean как 0/1
	created_at: string;
	updated_at: string;
}

/**
 * Type guard для проверки что объект из БД является DBUserRow
 */
function isDBUserRow(obj: unknown): obj is DBUserRow {
	if (!obj || typeof obj !== 'object') return false;
	const row = obj as Record<string, unknown>;
	return (
		typeof row.id === 'number' &&
		typeof row.email === 'string' &&
		typeof row.first_name === 'string' &&
		typeof row.last_name === 'string'
	);
}

/**
 * Утилита: возвращает текущее время в формате YYYY-MM-DDTHH:MM:SS (без миллисекунд и часового пояса)
 * Используется для записи timestamps в БД
 */
function nowSql(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	const day = String(now.getUTCDate()).padStart(2, '0');
	const hours = String(now.getUTCHours()).padStart(2, '0');
	const minutes = String(now.getUTCMinutes()).padStart(2, '0');
	const seconds = String(now.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Утилита: нормализует timestamp из БД в формат YYYY-MM-DDTHH:MM:SS
 * SQLite CURRENT_TIMESTAMP возвращает формат "YYYY-MM-DD HH:MM:SS" (с пробелом)
 * Конвертируем пробел в T и обрезаем миллисекунды если есть
 */
function normalizeTimestamp(timestamp: string): string {
	if (!timestamp) return timestamp;

	// Заменяем пробел на T
	let normalized = timestamp.replace(' ', 'T');

	// Обрезаем миллисекунды и часовой пояс если есть
	// Формат может быть: YYYY-MM-DDTHH:MM:SS.sssZ или YYYY-MM-DDTHH:MM:SS.sss
	const dotIndex = normalized.indexOf('.');
	if (dotIndex !== -1) {
		normalized = normalized.substring(0, dotIndex);
	}

	// Убираем Z в конце если есть
	if (normalized.endsWith('Z')) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

/**
 * Преобразует строку из БД в User объект
 * SQLite возвращает INTEGER как number, но для boolean полей нужна конвертация
 */
function rowToUser(row: DBUserRow): User {
	return {
		id: row.id,
		email: row.email,
		password_hash: row.password_hash,
		first_name: row.first_name,
		last_name: row.last_name,
		birth_date: row.birth_date,
		address_street: row.address_street,
		address_number: row.address_number,
		address_zip: row.address_zip,
		address_city: row.address_city,
		phone: row.phone,
		whatsapp: row.whatsapp,
		telegram: row.telegram,
		photo_video_consent: Boolean(row.photo_video_consent),
		preferred_language: row.preferred_language as 'de' | 'en' | 'ru' | 'uk',
		parental_consent: Boolean(row.parental_consent),
		is_blocked: Boolean(row.is_blocked),
		created_at: normalizeTimestamp(row.created_at),
		updated_at: normalizeTimestamp(row.updated_at),
	};
}

/**
 * Создаёт нового пользователя в базе данных
 *
 * @param db - D1 Database инстанс
 * @param data - Данные для регистрации (без password_hash, он должен быть уже хеширован)
 * @returns Созданный пользователь
 * @throws Error если email уже существует или произошла ошибка БД
 *
 * @example
 * const user = await createUser(db, {
 *   email: 'user@example.com',
 *   password_hash: await bcrypt.hash('password123', 10),
 *   first_name: 'John',
 *   last_name: 'Doe',
 *   // ... остальные поля
 * });
 */
export async function createUser(
	db: D1Database,
	data: Omit<UserRegistrationData, 'password' | 'password_confirm' | 'gdpr_consent'> & {
		password_hash: string;
	}
): Promise<User> {
	try {
		const now = nowSql();

		// Вставка пользователя с использованием prepared statement
		const result = await db
			.prepare(
				`INSERT INTO users (
					email, password_hash, first_name, last_name, birth_date,
					address_street, address_number, address_zip, address_city,
					phone, whatsapp, telegram,
					photo_video_consent, parental_consent, preferred_language,
					is_blocked, created_at, updated_at
				) VALUES (
					?, ?, ?, ?, ?,
					?, ?, ?, ?,
					?, ?, ?,
					?, ?, ?,
					?, ?, ?
				)`
			)
			.bind(
				data.email,
				data.password_hash,
				data.first_name,
				data.last_name,
				data.birth_date,
				data.address_street,
				data.address_number,
				data.address_zip,
				data.address_city,
				data.phone,
				data.whatsapp || null,
				data.telegram || null,
				data.photo_video_consent ? 1 : 0,
				data.parental_consent ? 1 : 0,
				data.preferred_language,
				0, // is_blocked по умолчанию false
				now,
				now
			)
			.run();

		if (!result.success) {
			throw new Error('Failed to create user in database');
		}

		// Получаем ID созданного пользователя
		const userId = result.meta.last_row_id;

		if (!userId) {
			throw new Error('Failed to get created user ID');
		}

		// Получаем созданного пользователя
		const user = await getUserById(db, userId);

		if (!user) {
			throw new Error('Failed to retrieve created user');
		}

		return user;
	} catch (error: any) {
		// Проверка на дубликат email (UNIQUE constraint)
		if (error.message && error.message.includes('UNIQUE constraint failed')) {
			throw new Error('User with this email already exists');
		}
		throw error;
	}
}

/**
 * Находит пользователя по email адресу
 *
 * @param db - D1 Database инстанс
 * @param email - Email адрес для поиска
 * @returns Пользователь или null если не найден
 *
 * @example
 * const user = await getUserByEmail(db, 'user@example.com');
 * if (user) {
 *   console.log(`Found user: ${user.first_name} ${user.last_name}`);
 * }
 */
export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
	const result = await db
		.prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first<DBUserRow>();

	if (!result) {
		return null;
	}

	return rowToUser(result);
}

/**
 * Находит пользователя по ID
 *
 * @param db - D1 Database инстанс
 * @param id - ID пользователя
 * @returns Пользователь или null если не найден
 *
 * @example
 * const user = await getUserById(db, 123);
 */
export async function getUserById(db: D1Database, id: number): Promise<User | null> {
	const result = await db
		.prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
		.bind(id)
		.first<DBUserRow>();

	if (!result) {
		return null;
	}

	return rowToUser(result);
}

/**
 * Обновляет данные пользователя
 *
 * @param db - D1 Database инстанс
 * @param id - ID пользователя
 * @param data - Объект с полями для обновления (только переданные поля будут обновлены)
 * @returns Обновлённый пользователь
 * @throws Error если пользователь не найден
 *
 * @example
 * const updated = await updateUser(db, 123, {
 *   phone: '+49123456789',
 *   preferred_language: 'en'
 * });
 */
export async function updateUser(
	db: D1Database,
	id: number,
	data: Partial<UserUpdateData>
): Promise<User> {
	// Проверяем существование пользователя
	const existingUser = await getUserById(db, id);
	if (!existingUser) {
		throw new Error('User not found');
	}

	// Создаём динамический SQL запрос только для переданных полей
	const updates: string[] = [];
	const values: (string | number | null)[] = [];

	// Маппинг полей (некоторые поля из UserUpdateData не сохраняются напрямую)
	// ВАЖНО: is_blocked и parental_consent должны быть здесь для blockUser()
	// email и password_hash для обновления аутентификационных данных
	const fieldMapping: Record<string, string> = {
		email: 'email',
		password_hash: 'password_hash',
		first_name: 'first_name',
		last_name: 'last_name',
		birth_date: 'birth_date',
		address_street: 'address_street',
		address_number: 'address_number',
		address_zip: 'address_zip',
		address_city: 'address_city',
		phone: 'phone',
		whatsapp: 'whatsapp',
		telegram: 'telegram',
		photo_video_consent: 'photo_video_consent',
		preferred_language: 'preferred_language',
		is_blocked: 'is_blocked',
		parental_consent: 'parental_consent',
	};

	// Формируем SET часть запроса
	for (const [key, dbField] of Object.entries(fieldMapping)) {
		if (key in data) {
			updates.push(`${dbField} = ?`);

			const value = data[key as keyof UserUpdateData];

			// Специальная обработка для boolean полей
			if (
				key === 'photo_video_consent' ||
				key === 'is_blocked' ||
				key === 'parental_consent'
			) {
				values.push(value ? 1 : 0);
			} else {
				values.push(value as string | number | null);
			}
		}
	}

	// Если нет полей для обновления, возвращаем текущего пользователя
	if (updates.length === 0) {
		return existingUser;
	}

	// Добавляем updated_at
	updates.push('updated_at = ?');
	values.push(nowSql());

	// Добавляем ID в конец для WHERE clause
	values.push(id);

	// Выполняем обновление
	const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
	const result = await db
		.prepare(sql)
		.bind(...values)
		.run();

	if (!result.success) {
		throw new Error('Failed to update user');
	}

	// Получаем обновлённого пользователя
	const updatedUser = await getUserById(db, id);
	if (!updatedUser) {
		throw new Error('Failed to retrieve updated user');
	}

	return updatedUser;
}

/**
 * Архивирует данные пользователя перед удалением (GDPR compliance)
 * Сохраняет минимальную информацию в таблицу deleted_users_archive
 *
 * ВНИМАНИЕ: Эта функция устарела. Используйте archiveUserGDPR из gdpr.ts для полной GDPR-совместимости.
 * Оставлена для обратной совместимости с deleteUser().
 *
 * @param db - D1 Database инстанс
 * @param id - ID пользователя для архивирования
 * @throws Error если пользователь не найден или архивирование не удалось
 * @deprecated Используйте archiveUserGDPR из модуля gdpr.ts
 *
 * @example
 * await archiveUser(db, 123);
 */
export async function archiveUser(db: D1Database, id: number): Promise<void> {
	// Получаем данные пользователя
	const user = await getUserById(db, id);
	if (!user) {
		throw new Error('User not found');
	}

	// Получаем список мероприятий, в которых УЧАСТВОВАЛ пользователь (только завершенные)
	const eventsResult = await db
		.prepare(
			`
			SELECT 
				e.id as eventId,
				e.title_de as title,
				e.date
			FROM events e
			INNER JOIN registrations r ON e.id = r.event_id
			WHERE r.user_id = ?
			  AND r.cancelled_at IS NULL
			  AND e.date <= datetime('now')
			ORDER BY e.date DESC
		`
		)
		.bind(id)
		.all<{ eventId: number; title: string; date: string }>();

	const eventsParticipated = eventsResult.results || [];

	// Вставляем в архив в JSON формате (GDPR-совместимый)
	const result = await db
		.prepare(
			`INSERT INTO deleted_users_archive (
				first_name, last_name, registered_at, deleted_at, events_participated
			) VALUES (?, ?, ?, ?, ?)`
		)
		.bind(
			user.first_name,
			user.last_name,
			user.created_at,
			nowSql(),
			eventsParticipated.length > 0 ? JSON.stringify(eventsParticipated) : null
		)
		.run();

	if (!result.success) {
		throw new Error('Failed to archive user data');
	}
}

/**
 * Удаляет пользователя из базы данных
 *
 * ВАЖНО: Эта функция автоматически архивирует данные перед удалением.
 * Проверьте, что прошло 28 дней с последнего мероприятия (GDPR) перед вызовом.
 *
 * РЕКОМЕНДАЦИЯ: Для полного GDPR-совместимого удаления используйте
 * deleteUserCompletely() из модуля gdpr.ts, которая удаляет все зависимости.
 *
 * @param db - D1 Database инстанс
 * @param id - ID пользователя для удаления
 * @throws Error если пользователь не найден или удаление не удалось
 *
 * @example
 * // Функция автоматически архивирует данные
 * await deleteUser(db, 123);
 */
export async function deleteUser(db: D1Database, id: number): Promise<void> {
	// Проверяем существование пользователя
	const user = await getUserById(db, id);
	if (!user) {
		throw new Error('User not found');
	}

	// Сначала архивируем данные (GDPR compliance)
	await archiveUser(db, id);

	// Удаляем пользователя
	const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

	if (!result.success) {
		throw new Error('Failed to delete user');
	}
}

/**
 * Получает список всех пользователей с пагинацией
 *
 * @param db - D1 Database инстанс
 * @param options - Опции пагинации (limit по умолчанию 50, offset по умолчанию 0)
 * @returns Объект с массивом пользователей и общим количеством
 *
 * @example
 * const { users, total } = await getAllUsers(db, { limit: 20, offset: 0 });
 * console.log(`Showing ${users.length} of ${total} users`);
 */
export async function getAllUsers(
	db: D1Database,
	options?: { limit?: number; offset?: number }
): Promise<{ users: User[]; total: number }> {
	const limit = options?.limit ?? 50;
	const offset = options?.offset ?? 0;

	// Получаем общее количество пользователей
	const countResult = await db.prepare('SELECT COUNT(*) as count FROM users').first<{
		count: number;
	}>();
	const total = countResult?.count ?? 0;

	// Получаем пользователей с пагинацией
	const result = await db
		.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?')
		.bind(limit, offset)
		.all<DBUserRow>();

	const users = result.results.map(rowToUser);

	return { users, total };
}

/**
 * Поиск пользователей по имени или email
 *
 * @param db - D1 Database инстанс
 * @param query - Строка поиска (ищет в first_name, last_name, email)
 * @returns Массив найденных пользователей
 *
 * @example
 * const results = await searchUsers(db, 'john');
 * // Найдёт пользователей с именем/фамилией/email содержащим "john"
 */
export async function searchUsers(db: D1Database, query: string): Promise<User[]> {
	// Если запрос пустой, возвращаем пустой массив
	if (!query || query.trim().length === 0) {
		return [];
	}

	// Подготавливаем строку поиска (добавляем % для LIKE)
	const searchTerm = `%${query.trim()}%`;

	// Ищем по имени, фамилии или email
	const result = await db
		.prepare(
			`SELECT * FROM users 
			WHERE first_name LIKE ? 
			   OR last_name LIKE ? 
			   OR email LIKE ?
			ORDER BY created_at DESC
			LIMIT 100`
		)
		.bind(searchTerm, searchTerm, searchTerm)
		.all<DBUserRow>();

	return result.results.map(rowToUser);
}

/**
 * Получает упрощённый список пользователей (для админ-панели)
 * Возвращает только основную информацию без конфиденциальных данных
 *
 * @param db - D1 Database инстанс
 * @param options - Опции пагинации
 * @returns Объект с массивом упрощённых данных пользователей и общим количеством
 *
 * @example
 * const { users, total } = await getUsersList(db, { limit: 50, offset: 0 });
 */
export async function getUsersList(
	db: D1Database,
	options?: { limit?: number; offset?: number }
): Promise<{ users: UserListItem[]; total: number }> {
	const limit = options?.limit ?? 50;
	const offset = options?.offset ?? 0;

	// Получаем общее количество
	const countResult = await db.prepare('SELECT COUNT(*) as count FROM users').first<{
		count: number;
	}>();
	const total = countResult?.count ?? 0;

	// Интерфейс для упрощённого результата
	interface DBUserListRow {
		id: number;
		email: string;
		first_name: string;
		last_name: string;
		created_at: string;
		is_blocked: number;
	}

	// Получаем только необходимые поля
	const result = await db
		.prepare(
			`SELECT id, email, first_name, last_name, created_at, is_blocked 
			FROM users 
			ORDER BY created_at DESC 
			LIMIT ? OFFSET ?`
		)
		.bind(limit, offset)
		.all<DBUserListRow>();

	const users: UserListItem[] = result.results.map((row) => ({
		id: row.id,
		email: row.email,
		first_name: row.first_name,
		last_name: row.last_name,
		created_at: normalizeTimestamp(row.created_at),
		is_blocked: Boolean(row.is_blocked),
	}));

	return { users, total };
}

/**
 * Блокирует или разблокирует пользователя
 * Используется при запланированном удалении аккаунта
 *
 * @param db - D1 Database инстанс
 * @param id - ID пользователя
 * @param blocked - true для блокировки, false для разблокировки
 * @returns Обновлённый пользователь
 *
 * @example
 * await blockUser(db, 123, true); // Блокируем пользователя
 */
export async function blockUser(db: D1Database, id: number, blocked: boolean): Promise<User> {
	// is_blocked теперь в fieldMapping updateUser, поэтому as any не нужен
	return updateUser(db, id, { is_blocked: blocked } as UserUpdateData);
}

/**
 * Проверяет, существует ли пользователь с данным email
 * Полезно для валидации при регистрации
 *
 * @param db - D1 Database инстанс
 * @param email - Email для проверки
 * @returns true если email уже занят
 *
 * @example
 * const exists = await emailExists(db, 'test@example.com');
 * if (exists) {
 *   throw new Error('Email already registered');
 * }
 */
export async function emailExists(db: D1Database, email: string): Promise<boolean> {
	const result = await db
		.prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1')
		.bind(email)
		.first();

	return result !== null;
}
