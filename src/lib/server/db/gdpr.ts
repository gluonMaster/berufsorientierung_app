/**
 * GDPR Compliance утилиты
 * Функции для управления удалением пользователей в соответствии с GDPR
 *
 * Основные правила:
 * - Пользователь может быть удален только через 28 дней после последнего мероприятия
 * - Если условие не выполнено, удаление планируется, аккаунт блокируется
 * - Автоматическое удаление запланированных аккаунтов через Cron trigger
 * - Минимальные данные архивируются для отчетности
 */

import type { PendingDeletion, PendingDeletionWithUser } from '$lib/types/admin';

// Тип D1Database доступен глобально через @cloudflare/workers-types
type D1Database = import('@cloudflare/workers-types').D1Database;

/**
 * Результат проверки возможности удаления пользователя
 */
export interface CanDeleteUserResult {
	/** Можно ли удалить пользователя прямо сейчас */
	canDelete: boolean;

	/** Причина, почему нельзя удалить (если canDelete = false) */
	reason?: string;

	/** Дата, когда пользователь может быть удален (ISO string) */
	deleteDate?: string;
}

/**
 * Информация об участии в мероприятии для архива
 */
interface ArchivedEvent {
	eventId: number;
	title: string;
	date: string;
}

/**
 * Константа: минимальное количество дней после последнего мероприятия для удаления
 */
const GDPR_RETENTION_DAYS = 28;

/**
 * Проверяет, можно ли удалить пользователя прямо сейчас
 *
 * Логика:
 * 1. Получить все активные регистрации (cancelled_at IS NULL)
 * 2. Найти последнее предстоящее мероприятие
 * 3. Если есть предстоящие: нельзя удалить до последнего + 28 дней
 * 4. Если нет предстоящих:
 *    - Найти последнее прошедшее мероприятие
 *    - Если прошло >= 28 дней: можно удалить
 *    - Иначе: нельзя удалить до даты + 28 дней
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @returns Результат проверки с флагом canDelete, причиной и датой возможного удаления
 *
 * @example
 * ```ts
 * const result = await canDeleteUser(db, 123);
 * if (result.canDelete) {
 *   await deleteUserCompletely(db, 123);
 * } else {
 *   console.log(`Cannot delete: ${result.reason}. Can delete after ${result.deleteDate}`);
 * }
 * ```
 */
export async function canDeleteUser(db: D1Database, userId: number): Promise<CanDeleteUserResult> {
	try {
		const now = new Date();

		// Получаем все активные регистрации пользователя с датами мероприятий
		const registrationsResult = await db
			.prepare(
				`
				SELECT e.date
				FROM registrations r
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.user_id = ?
				  AND r.cancelled_at IS NULL
				ORDER BY e.date DESC
			`
			)
			.bind(userId)
			.all<{ date: string }>();

		if (!registrationsResult.success) {
			throw new Error('Failed to fetch user registrations');
		}

		const registrations = registrationsResult.results || [];

		// Если нет активных регистраций, можно удалить
		if (registrations.length === 0) {
			return {
				canDelete: true,
			};
		}

		// Находим последнее мероприятие (первое в списке из-за DESC сортировки)
		const lastEventDate = new Date(registrations[0].date);

		// Проверяем, есть ли предстоящие мероприятия
		const hasUpcomingEvents = registrations.some(
			(reg: { date: string }) => new Date(reg.date) > now
		);

		if (hasUpcomingEvents) {
			// Если есть предстоящие мероприятия, находим самое позднее
			const latestUpcomingDate = new Date(
				Math.max(
					...registrations
						.filter((reg: { date: string }) => new Date(reg.date) > now)
						.map((reg: { date: string }) => new Date(reg.date).getTime())
				)
			);

			const deleteDate = new Date(latestUpcomingDate);
			deleteDate.setDate(deleteDate.getDate() + GDPR_RETENTION_DAYS);

			return {
				canDelete: false,
				reason: 'User has upcoming events',
				deleteDate: deleteDate.toISOString(),
			};
		}

		// Все мероприятия в прошлом, проверяем последнее
		const daysSinceLastEvent = Math.floor(
			(now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		if (daysSinceLastEvent >= GDPR_RETENTION_DAYS) {
			return {
				canDelete: true,
			};
		}

		// Прошло меньше 28 дней
		const deleteDate = new Date(lastEventDate);
		deleteDate.setDate(deleteDate.getDate() + GDPR_RETENTION_DAYS);

		return {
			canDelete: false,
			reason: `Only ${daysSinceLastEvent} days passed since last event (required: ${GDPR_RETENTION_DAYS})`,
			deleteDate: deleteDate.toISOString(),
		};
	} catch (error) {
		console.error('Error in canDeleteUser:', error);
		throw new Error(
			`Failed to check if user can be deleted: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Планирует удаление пользователя и блокирует доступ
 *
 * Создает запись в таблице pending_deletions с вычисленной датой удаления
 * И НЕМЕДЛЕННО БЛОКИРУЕТ аккаунт (is_blocked = 1).
 * Обе операции выполняются атомарно через db.batch().
 * Дата вычисляется с использованием логики из canDeleteUser.
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @returns Дата планируемого удаления (ISO string)
 * @throws Error если пользователь уже может быть удален или запись уже существует
 *
 * @example
 * ```ts
 * const deleteDate = await scheduleUserDeletion(db, 123);
 * // Аккаунт заблокирован, запланировано удаление
 * console.log(`User will be deleted on ${deleteDate}`);
 * ```
 */
export async function scheduleUserDeletion(db: D1Database, userId: number): Promise<string> {
	try {
		// Проверяем, можно ли удалить пользователя
		const canDelete = await canDeleteUser(db, userId);

		if (canDelete.canDelete) {
			throw new Error('User can be deleted immediately, no need to schedule');
		}

		if (!canDelete.deleteDate) {
			throw new Error('Delete date not calculated');
		}

		// Проверяем, нет ли уже запланированного удаления
		const existingResult = await db
			.prepare('SELECT id FROM pending_deletions WHERE user_id = ?')
			.bind(userId)
			.first<{ id: number }>();

		if (existingResult) {
			throw new Error('User deletion is already scheduled');
		}

		// Создаем запись о запланированном удалении И блокируем пользователя атомарно
		const statements = [
			// 1. Вставляем запись о запланированном удалении
			db
				.prepare(
					`
				INSERT INTO pending_deletions (user_id, deletion_date, created_at)
				VALUES (?, ?, datetime('now'))
			`
				)
				.bind(userId, canDelete.deleteDate),

			// 2. Блокируем доступ к аккаунту
			db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').bind(userId),
		];

		const results = await db.batch(statements);

		// Проверяем успешность всех операций
		const allSuccess = results.every((result: { success: boolean }) => result.success);

		if (!allSuccess) {
			throw new Error('Failed to schedule user deletion or block user');
		}

		return canDelete.deleteDate;
	} catch (error) {
		console.error('Error in scheduleUserDeletion:', error);
		throw new Error(
			`Failed to schedule user deletion: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Архивирует минимальные данные пользователя перед удалением
 *
 * Сохраняет в deleted_users_archive:
 * - Имя и фамилию
 * - Дату регистрации
 * - Дату удаления
 * - Список мероприятий, в которых УЧАСТВОВАЛ пользователь
 *   (только завершенные: cancelled_at IS NULL AND date <= NOW)
 *   JSON формат: [{ eventId, title, date }]
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @throws Error при ошибке архивации
 *
 * @example
 * ```ts
 * await archiveUser(db, 123);
 * // Данные пользователя сохранены в deleted_users_archive
 * ```
 */
export async function archiveUser(db: D1Database, userId: number): Promise<void> {
	try {
		// Получаем данные пользователя
		const userResult = await db
			.prepare(
				`
				SELECT first_name, last_name, created_at
				FROM users
				WHERE id = ?
			`
			)
			.bind(userId)
			.first<{ first_name: string; last_name: string; created_at: string }>();

		if (!userResult) {
			throw new Error('User not found');
		}

		// Получаем список мероприятий, в которых УЧАСТВОВАЛ пользователь
		// (только завершенные, не отмененные регистрации)
		const eventsResult = await db
			.prepare(
				`
				SELECT 
					e.id as eventId,
					e.title_de as title,
					e.date
				FROM registrations r
				INNER JOIN events e ON r.event_id = e.id
				WHERE r.user_id = ?
				  AND r.cancelled_at IS NULL
				  AND e.date <= datetime('now')
				ORDER BY e.date DESC
			`
			)
			.bind(userId)
			.all<ArchivedEvent>();

		if (!eventsResult.success) {
			throw new Error('Failed to fetch user events');
		}

		const eventsParticipated = eventsResult.results || [];

		// Сохраняем в архив
		const result = await db
			.prepare(
				`
				INSERT INTO deleted_users_archive (
					first_name,
					last_name,
					registered_at,
					deleted_at,
					events_participated
				)
				VALUES (?, ?, ?, datetime('now'), ?)
			`
			)
			.bind(
				userResult.first_name,
				userResult.last_name,
				userResult.created_at,
				eventsParticipated.length > 0 ? JSON.stringify(eventsParticipated) : null
			)
			.run();

		if (!result.success) {
			throw new Error('Failed to archive user data');
		}
	} catch (error) {
		console.error('Error in archiveUser:', error);
		throw new Error(
			`Failed to archive user: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Полное удаление пользователя из системы
 *
 * Выполняет в транзакции:
 * 1. Архивирование минимальных данных
 * 2. Удаление из admins (если есть)
 * 3. Удаление из registrations
 * 4. Удаление из pending_deletions (если есть)
 * 5. Обнуление user_id в activity_log (для сохранения истории)
 * 6. Удаление из users
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @throws Error при ошибке удаления (транзакция откатывается)
 *
 * @example
 * ```ts
 * await deleteUserCompletely(db, 123);
 * // Пользователь полностью удален, минимальные данные архивированы
 * ```
 */
export async function deleteUserCompletely(db: D1Database, userId: number): Promise<void> {
	try {
		// D1 не поддерживает транзакции напрямую через BEGIN/COMMIT,
		// но мы можем использовать batch для атомарного выполнения
		const statements = [
			// 1. Архивируем данные (через prepared statement с подзапросом)
			// Только завершенные мероприятия (не отмененные регистрации, прошедшие даты)
			db
				.prepare(
					`
				INSERT INTO deleted_users_archive (
					first_name,
					last_name,
					registered_at,
					deleted_at,
					events_participated
				)
				SELECT 
					u.first_name,
					u.last_name,
					u.created_at,
					datetime('now'),
					(
						SELECT json_group_array(
							json_object(
								'eventId', e.id,
								'title', e.title_de,
								'date', e.date
							)
						)
						FROM registrations r
						INNER JOIN events e ON r.event_id = e.id
						WHERE r.user_id = ?
						  AND r.cancelled_at IS NULL
						  AND e.date <= datetime('now')
					)
				FROM users u
				WHERE u.id = ?
			`
				)
				.bind(userId, userId),

			// 2. Удаляем из admins (если есть)
			db.prepare('DELETE FROM admins WHERE user_id = ?').bind(userId),

			// 3. Удаляем из registrations
			db.prepare('DELETE FROM registrations WHERE user_id = ?').bind(userId),

			// 4. Удаляем из pending_deletions (если есть)
			db.prepare('DELETE FROM pending_deletions WHERE user_id = ?').bind(userId),

			// 5. Удаляем отзывы пользователя (FK ON DELETE CASCADE также сработает, но явно для консистентности)
			db.prepare('DELETE FROM reviews WHERE user_id = ?').bind(userId),

			// 6. Обнуляем user_id в activity_log (сохраняем историю, но убираем связь)
			db.prepare('UPDATE activity_log SET user_id = NULL WHERE user_id = ?').bind(userId),

			// 7. Удаляем пользователя
			db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
		];

		// Выполняем все операции атомарно
		const results = await db.batch(statements);

		// Проверяем успешность всех операций
		const allSuccess = results.every((result: { success: boolean }) => result.success);

		if (!allSuccess) {
			throw new Error('One or more deletion operations failed');
		}
	} catch (error) {
		console.error('Error in deleteUserCompletely:', error);
		throw new Error(
			`Failed to delete user completely: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Обрабатывает все запланированные удаления, срок которых истек
 *
 * Эта функция вызывается автоматически через Cloudflare Cron Trigger
 * (например, каждый день в 02:00).
 *
 * Для каждого пользователя с deletion_date <= now:
 * - Вызывает deleteUserCompletely
 * - Логирует результат
 *
 * @param db - D1 Database instance
 * @returns Количество удаленных пользователей
 *
 * @example
 * ```ts
 * // В Cloudflare Worker scheduled handler:
 * export default {
 *   async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
 *     const deletedCount = await processScheduledDeletions(env.DB);
 *     console.log(`Processed ${deletedCount} scheduled deletions`);
 *   }
 * };
 * ```
 */
export async function processScheduledDeletions(db: D1Database): Promise<number> {
	try {
		// Получаем все запланированные удаления, срок которых истек
		const pendingResult = await db
			.prepare(
				`
				SELECT id, user_id, deletion_date
				FROM pending_deletions
				WHERE deletion_date <= datetime('now')
				ORDER BY deletion_date ASC
			`
			)
			.all<PendingDeletion>();

		if (!pendingResult.success) {
			throw new Error('Failed to fetch pending deletions');
		}

		const pendingDeletions = pendingResult.results || [];

		if (pendingDeletions.length === 0) {
			return 0;
		}

		let deletedCount = 0;
		const errors: Array<{ userId: number; error: string }> = [];

		// Обрабатываем каждое удаление отдельно
		for (const deletion of pendingDeletions) {
			try {
				await deleteUserCompletely(db, deletion.user_id);
				deletedCount++;

				console.log(
					`Successfully deleted user ${deletion.user_id} (scheduled for ${deletion.deletion_date})`
				);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				errors.push({ userId: deletion.user_id, error: errorMessage });

				console.error(`Failed to delete user ${deletion.user_id}:`, errorMessage);
			}
		}

		// Логируем общий результат
		console.log(
			`Processed ${pendingDeletions.length} scheduled deletions: ${deletedCount} successful, ${errors.length} failed`
		);

		if (errors.length > 0) {
			console.error('Deletion errors:', errors);
		}

		return deletedCount;
	} catch (error) {
		console.error('Error in processScheduledDeletions:', error);
		throw new Error(
			`Failed to process scheduled deletions: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Получает список всех запланированных удалений с информацией о пользователях
 *
 * Возвращает JOIN с таблицей users для отображения имен пользователей
 * и датой последнего мероприятия.
 *
 * @param db - D1 Database instance
 * @returns Массив запланированных удалений с данными пользователей
 *
 * @example
 * ```ts
 * const scheduled = await getScheduledDeletions(db);
 * for (const item of scheduled) {
 *   console.log(`${item.user_email} will be deleted on ${item.deletion_date}`);
 *   console.log(`Last event: ${item.last_event_date}`);
 * }
 * ```
 */
export async function getScheduledDeletions(db: D1Database): Promise<PendingDeletionWithUser[]> {
	try {
		const result = await db
			.prepare(
				`
				SELECT 
					pd.id,
					pd.user_id,
					pd.deletion_date,
					pd.created_at,
					u.email as user_email,
					u.first_name as user_first_name,
					u.last_name as user_last_name,
					(
						SELECT MAX(e.date)
						FROM registrations r
						INNER JOIN events e ON r.event_id = e.id
						WHERE r.user_id = pd.user_id
						  AND r.cancelled_at IS NULL
					) as last_event_date
				FROM pending_deletions pd
				INNER JOIN users u ON pd.user_id = u.id
				ORDER BY pd.deletion_date ASC
			`
			)
			.all<PendingDeletionWithUser>();

		if (!result.success) {
			throw new Error('Failed to fetch scheduled deletions');
		}

		return result.results || [];
	} catch (error) {
		console.error('Error in getScheduledDeletions:', error);
		throw new Error(
			`Failed to get scheduled deletions: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
