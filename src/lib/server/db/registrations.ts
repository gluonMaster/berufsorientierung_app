/**
 * Database utilities - Registrations
 * Утилиты для работы с записями на мероприятия
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
	Registration,
	RegistrationWithUser,
	RegistrationWithEvent,
} from '$lib/types/registration';
import { getUserById } from './users';
import { getEventById } from './events';

/**
 * Интерфейс для строки из таблицы registrations в БД
 */
interface DBRegistrationRow {
	id: number;
	user_id: number;
	event_id: number;
	additional_data: string | null;
	registered_at: string;
	cancelled_at: string | null;
	cancellation_reason: string | null;
}

/**
 * Утилита: возвращает текущее время в формате YYYY-MM-DDTHH:MM:SS
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
 * Утилита: нормализует timestamp из БД
 */
function normalizeTimestamp(timestamp: string | null): string | null {
	if (!timestamp) return timestamp;

	let normalized = timestamp.replace(' ', 'T');

	const dotIndex = normalized.indexOf('.');
	if (dotIndex !== -1) {
		normalized = normalized.substring(0, dotIndex);
	}

	if (normalized.endsWith('Z')) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

/**
 * Преобразует строку из БД в Registration объект
 */
function rowToRegistration(row: DBRegistrationRow): Registration {
	return {
		id: row.id,
		user_id: row.user_id,
		event_id: row.event_id,
		additional_data: row.additional_data,
		registered_at: normalizeTimestamp(row.registered_at) || '',
		cancelled_at: normalizeTimestamp(row.cancelled_at),
		cancellation_reason: row.cancellation_reason,
	};
}

/**
 * Создаёт запись на мероприятие или реактивирует отменённую
 *
 * ВАЖНО: Если пользователь ранее отменил запись на это мероприятие,
 * вместо создания новой записи функция реактивирует существующую
 * (обходит UNIQUE constraint на user_id, event_id)
 *
 * Выполняет все необходимые проверки:
 * - Пользователь существует и не заблокирован
 * - Мероприятие существует и активно
 * - Есть свободные места
 * - Дедлайн регистрации не истёк
 * - Пользователь не имеет активной записи
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @param eventId - ID мероприятия
 * @param additionalData - Дополнительные данные (ответы на доп. поля)
 * @returns Созданная или реактивированная запись
 * @throws Error если какая-либо проверка не прошла
 *
 * @example
 * // Первая регистрация
 * const registration = await registerUserForEvent(db, 123, 456, {
 *   dietary_restrictions: 'vegetarian'
 * });
 *
 * // После отмены можно зарегистрироваться снова (реактивация)
 * await cancelRegistration(db, 123, 456, 'Changed plans');
 * const reactivated = await registerUserForEvent(db, 123, 456);
 */
export async function registerUserForEvent(
	db: D1Database,
	userId: number,
	eventId: number,
	additionalData?: Record<string, any>
): Promise<Registration> {
	try {
		// 1. Проверяем существование пользователя
		const user = await getUserById(db, userId);
		if (!user) {
			throw new Error('User not found');
		}

		// Проверяем что пользователь не заблокирован
		if (user.is_blocked) {
			throw new Error('User account is blocked');
		}

		// 2. Проверяем существование мероприятия
		const event = await getEventById(db, eventId);
		if (!event) {
			throw new Error('Event not found');
		}

		// 3. Проверяем что мероприятие активно
		if (event.status !== 'active') {
			throw new Error(`Event is not active (status: ${event.status})`);
		}

		// 4. Проверяем что дедлайн регистрации не истёк
		const now = new Date();
		const deadline = new Date(event.registration_deadline);
		if (now > deadline) {
			throw new Error('Registration deadline has passed');
		}

		// 5. Получаем текущее количество активных записей
		const currentParticipants = await getRegistrationCount(db, eventId);

		// 6. Проверяем наличие свободных мест
		if (currentParticipants >= event.max_participants) {
			throw new Error('Event is full, no available spots');
		}

		// 7. Проверяем активную запись
		const alreadyRegistered = await isUserRegistered(db, userId, eventId);
		if (alreadyRegistered) {
			throw new Error('User is already registered for this event');
		}

		// 8. Проверяем существование отменённой записи (для реактивации)
		const existingCancelledRegistration = await db
			.prepare(
				`SELECT * FROM registrations 
				WHERE user_id = ? AND event_id = ? AND cancelled_at IS NOT NULL
				LIMIT 1`
			)
			.bind(userId, eventId)
			.first<DBRegistrationRow>();

		const nowTimestamp = nowSql();
		const additionalDataJson = additionalData ? JSON.stringify(additionalData) : null;

		let registrationId: number;

		// 9. Если есть отменённая запись - реактивируем её
		if (existingCancelledRegistration) {
			const updateResult = await db
				.prepare(
					`UPDATE registrations 
					SET cancelled_at = NULL, 
						cancellation_reason = NULL,
						registered_at = ?,
						additional_data = ?
					WHERE id = ?`
				)
				.bind(nowTimestamp, additionalDataJson, existingCancelledRegistration.id)
				.run();

			if (!updateResult.success) {
				throw new Error('Failed to reactivate registration');
			}

			registrationId = existingCancelledRegistration.id;
		} else {
			// 10. Создаём новую запись
			const insertResult = await db
				.prepare(
					`INSERT INTO registrations (
						user_id, event_id, additional_data, registered_at
					) VALUES (?, ?, ?, ?)`
				)
				.bind(userId, eventId, additionalDataJson, nowTimestamp)
				.run();

			if (!insertResult.success) {
				throw new Error('Failed to create registration');
			}

			registrationId = insertResult.meta.last_row_id;
			if (!registrationId) {
				throw new Error('Failed to get registration ID');
			}
		}

		// 11. Получаем созданную/реактивированную запись
		const registration = await getRegistrationById(db, registrationId);
		if (!registration) {
			throw new Error('Registration created/reactivated but not found');
		}

		return registration;
	} catch (error) {
		console.error('Error registering user for event:', error);
		throw error;
	}
}

/**
 * Отменяет запись на мероприятие
 *
 * НЕ удаляет запись из БД, а устанавливает cancelled_at и cancellation_reason
 * Проверяет что до мероприятия больше 3 дней
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @param eventId - ID мероприятия
 * @param reason - Причина отмены
 * @returns Отменённая запись
 * @throws Error если запись не найдена или отмена невозможна
 *
 * @example
 * const cancelled = await cancelRegistration(db, 123, 456, 'Personal reasons');
 */
export async function cancelRegistration(
	db: D1Database,
	userId: number,
	eventId: number,
	reason: string
): Promise<Registration> {
	try {
		// 1. Проверяем существование активной записи
		const existingRegistration = await db
			.prepare(
				`SELECT * FROM registrations 
				WHERE user_id = ? AND event_id = ? AND cancelled_at IS NULL
				LIMIT 1`
			)
			.bind(userId, eventId)
			.first<DBRegistrationRow>();

		if (!existingRegistration) {
			throw new Error('Active registration not found');
		}

		// 2. Получаем информацию о мероприятии
		const event = await getEventById(db, eventId);
		if (!event) {
			throw new Error('Event not found');
		}

		// 3. Проверяем что до мероприятия больше 3 дней
		const now = new Date();
		const eventDate = new Date(event.date);
		const daysUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		if (daysUntilEvent <= 3) {
			throw new Error('Cannot cancel registration less than 3 days before the event');
		}

		// 4. Отменяем запись
		const nowTimestamp = nowSql();

		const result = await db
			.prepare(
				`UPDATE registrations 
				SET cancelled_at = ?, cancellation_reason = ?
				WHERE id = ?`
			)
			.bind(nowTimestamp, reason, existingRegistration.id)
			.run();

		if (!result.success) {
			throw new Error('Failed to cancel registration');
		}

		// 5. Возвращаем обновлённую запись
		const cancelledRegistration = await getRegistrationById(db, existingRegistration.id);
		if (!cancelledRegistration) {
			throw new Error('Registration cancelled but not found');
		}

		return cancelledRegistration;
	} catch (error) {
		console.error('Error cancelling registration:', error);
		throw error;
	}
}

/**
 * Получает все записи пользователя (включая отменённые)
 *
 * Выполняет JOIN с events для получения информации о мероприятиях
 * Сортировка: предстоящие первыми, потом прошедшие
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @returns Список записей с информацией о мероприятиях
 *
 * @example
 * const registrations = await getUserRegistrations(db, 123);
 * console.log(`User has ${registrations.length} registrations`);
 */
export async function getUserRegistrations(
	db: D1Database,
	userId: number
): Promise<RegistrationWithEvent[]> {
	try {
		interface DBRegistrationWithEventRow extends DBRegistrationRow {
			event_title_de: string;
			event_date: string;
			event_location_de: string;
			event_status: 'draft' | 'active' | 'cancelled';
		}

		const result = await db
			.prepare(
				`SELECT 
					r.*,
					e.title_de as event_title_de,
					e.date as event_date,
					e.location_de as event_location_de,
					e.status as event_status
				FROM registrations r
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.user_id = ?
				ORDER BY 
					CASE 
						WHEN e.date >= datetime('now') THEN 0 
						ELSE 1 
					END,
					e.date ASC`
			)
			.bind(userId)
			.all<DBRegistrationWithEventRow>();

		return (result.results || []).map((row) => ({
			...rowToRegistration(row),
			event_title_de: row.event_title_de,
			event_date: normalizeTimestamp(row.event_date) || '',
			event_location_de: row.event_location_de,
			event_status: row.event_status,
		}));
	} catch (error) {
		console.error('Error getting user registrations:', error);
		throw new Error(
			`Failed to get user registrations: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает все записи на мероприятие (только активные)
 *
 * Выполняет JOIN с users для получения данных участников
 * НЕ возвращает password_hash пользователей
 *
 * @param db - D1 Database instance
 * @param eventId - ID мероприятия
 * @returns Список записей с информацией о пользователях
 *
 * @example
 * const participants = await getEventRegistrations(db, 456);
 * console.log(`Event has ${participants.length} participants`);
 */
export async function getEventRegistrations(
	db: D1Database,
	eventId: number
): Promise<RegistrationWithUser[]> {
	try {
		interface DBRegistrationWithUserRow extends DBRegistrationRow {
			user_first_name: string;
			user_last_name: string;
			user_email: string;
			user_phone: string;
			user_whatsapp: string | null;
			user_telegram: string | null;
		}

		const result = await db
			.prepare(
				`SELECT 
					r.*,
					u.first_name as user_first_name,
					u.last_name as user_last_name,
					u.email as user_email,
					u.phone as user_phone,
					u.whatsapp as user_whatsapp,
					u.telegram as user_telegram
				FROM registrations r
				INNER JOIN users u ON r.user_id = u.id
				WHERE r.event_id = ? AND r.cancelled_at IS NULL
				ORDER BY r.registered_at ASC`
			)
			.bind(eventId)
			.all<DBRegistrationWithUserRow>();

		return (result.results || []).map((row) => ({
			...rowToRegistration(row),
			user_first_name: row.user_first_name,
			user_last_name: row.user_last_name,
			user_email: row.user_email,
			user_phone: row.user_phone,
			user_whatsapp: row.user_whatsapp,
			user_telegram: row.user_telegram,
		}));
	} catch (error) {
		console.error('Error getting event registrations:', error);
		throw new Error(
			`Failed to get event registrations: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает количество активных записей на мероприятие
 *
 * Считает только записи где cancelled_at IS NULL
 *
 * @param db - D1 Database instance
 * @param eventId - ID мероприятия
 * @returns Количество активных участников
 *
 * @example
 * const count = await getRegistrationCount(db, 456);
 * console.log(`Event has ${count} active participants`);
 */
export async function getRegistrationCount(db: D1Database, eventId: number): Promise<number> {
	try {
		const result = await db
			.prepare(
				`SELECT COUNT(*) as count 
				FROM registrations 
				WHERE event_id = ? AND cancelled_at IS NULL`
			)
			.bind(eventId)
			.first<{ count: number }>();

		return result?.count || 0;
	} catch (error) {
		console.error('Error getting registration count:', error);
		throw new Error(
			`Failed to get registration count: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Проверяет, записан ли пользователь на мероприятие
 *
 * Проверяет только активные записи (cancelled_at IS NULL)
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @param eventId - ID мероприятия
 * @returns true если есть активная запись
 *
 * @example
 * const isRegistered = await isUserRegistered(db, 123, 456);
 * if (isRegistered) {
 *   console.log('User is already registered');
 * }
 */
export async function isUserRegistered(
	db: D1Database,
	userId: number,
	eventId: number
): Promise<boolean> {
	try {
		const result = await db
			.prepare(
				`SELECT 1 
				FROM registrations 
				WHERE user_id = ? AND event_id = ? AND cancelled_at IS NULL
				LIMIT 1`
			)
			.bind(userId, eventId)
			.first();

		return result !== null;
	} catch (error) {
		console.error('Error checking if user is registered:', error);
		throw new Error(
			`Failed to check registration: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает запись по ID
 *
 * @param db - D1 Database instance
 * @param id - ID записи
 * @returns Запись или null если не найдена
 *
 * @example
 * const registration = await getRegistrationById(db, 789);
 */
export async function getRegistrationById(
	db: D1Database,
	id: number
): Promise<Registration | null> {
	try {
		const result = await db
			.prepare('SELECT * FROM registrations WHERE id = ? LIMIT 1')
			.bind(id)
			.first<DBRegistrationRow>();

		if (!result) {
			return null;
		}

		return rowToRegistration(result);
	} catch (error) {
		console.error('Error getting registration by id:', error);
		throw new Error(
			`Failed to get registration: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Парсит дополнительные данные регистрации из JSON строки
 *
 * Безопасно парсит JSON с обработкой ошибок
 *
 * @param additionalData - JSON строка с дополнительными данными
 * @returns Распарсенный объект или null
 *
 * @example
 * const registration = await getRegistrationById(db, 123);
 * const data = parseAdditionalData(registration.additional_data);
 * console.log(data?.dietary_restrictions);
 */
export function parseAdditionalData(additionalData: string | null): Record<string, unknown> | null {
	if (!additionalData) {
		return null;
	}

	try {
		const parsed = JSON.parse(additionalData);
		// Проверяем что это объект, а не массив или примитив
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch (error) {
		console.error('Error parsing additional_data:', error);
		return null;
	}
}
