/**
 * Admin Types
 * Типы для работы с администраторами и системными функциями
 */

/**
 * Типы действий для логирования
 * Централизованный тип для всех действий в системе
 *
 * @see {@link $lib/server/db/activityLog.ts} для реализации
 */
export type ActivityLogActionType =
	// Действия пользователей
	| 'user_register' // Регистрация нового пользователя
	| 'user_login' // Вход в систему
	| 'user_login_failed' // Неудачная попытка входа
	| 'user_logout' // Выход из системы
	| 'user_update_profile' // Обновление профиля
	| 'password_reset' // Сброс пароля
	| 'user_delete_request' // Запрос на удаление аккаунта
	| 'user_deleted' // Аккаунт удален
	| 'profile_deleted_immediate' // Профиль удален немедленно (GDPR)
	| 'profile_deletion_scheduled' // Профиль запланирован к удалению (GDPR)
	| 'profile_deletion_failed' // Ошибка при удалении профиля
	// Действия с мероприятиями (админ)
	| 'event_create' // Создание мероприятия
	| 'event_update' // Обновление мероприятия
	| 'event_delete' // Удаление мероприятия
	| 'event_publish' // Публикация мероприятия
	| 'event_cancel' // Отмена мероприятия
	| 'event_regenerate_qr' // Перегенерация QR-кодов мероприятия
	| 'event_export' // Экспорт мероприятий в JSON
	| 'event_import' // Импорт мероприятий из JSON
	// Действия с записями
	| 'registration_create' // Запись на мероприятие
	| 'registration_cancel' // Отмена записи
	// Административные действия
	| 'admin_add' // Выдача прав администратора
	| 'admin_remove' // Отзыв прав администратора
	| 'admin_export_user_data' // Экспорт данных пользователя администратором
	| 'bulk_email_sent' // Массовая рассылка
	// Системные действия
	| 'system_cron_deletion'; // Автоматическое удаление через Cloudflare Cron

/**
 * @deprecated Используйте ActivityLogActionType вместо ActivityLogAction
 * Оставлено для обратной совместимости
 */
export type ActivityLogAction = ActivityLogActionType;

/**
 * Администратор системы
 * Соответствует таблице `admins` в БД
 */
export interface Admin {
	/** Уникальный идентификатор записи администратора */
	id: number;

	/** ID пользователя с правами администратора */
	user_id: number;

	/** ID администратора, который выдал права */
	created_by: number | null;

	/** Дата выдачи прав администратора */
	created_at: string;
}

/**
 * Администратор с информацией о пользователе
 */
export interface AdminWithUser extends Admin {
	/** Email администратора */
	user_email: string;

	/** Имя администратора */
	user_first_name: string;

	/** Фамилия администратора */
	user_last_name: string;

	/** Email администратора, который выдал права */
	created_by_email: string | null;
}

/**
 * Лог активности пользователей
 * Соответствует таблице `activity_log` в БД
 */
export interface ActivityLog {
	/** Уникальный идентификатор записи лога */
	id: number;

	/** ID пользователя, совершившего действие */
	user_id: number | null;

	/** Тип действия */
	action_type: ActivityLogActionType;

	/** Дополнительные детали действия (JSON) */
	details: string | null;

	/** IP адрес, с которого было выполнено действие */
	ip_address: string | null;

	/** Дата и время действия */
	timestamp: string;
}

/**
 * Лог активности с информацией о пользователе
 */
export interface ActivityLogWithUser extends ActivityLog {
	/** Email пользователя */
	user_email: string | null;

	/** Полное имя пользователя */
	user_full_name: string | null;
}

/**
 * Архив удаленных пользователей
 * Соответствует таблице `deleted_users_archive` в БД
 * Хранит минимальную информацию для отчетности (GDPR compliant)
 */
export interface DeletedUserArchive {
	/** Уникальный идентификатор архивной записи */
	id: number;

	/** Имя пользователя */
	first_name: string;

	/** Фамилия пользователя */
	last_name: string;

	/** Дата регистрации пользователя */
	registered_at: string;

	/** Дата удаления аккаунта */
	deleted_at: string;

	/** Список мероприятий, в которых участвовал (JSON массив строк) */
	events_participated: string | null;
}

/**
 * Запланированное удаление пользователя
 * Соответствует таблице `pending_deletions` в БД
 */
export interface PendingDeletion {
	/** Уникальный идентификатор записи */
	id: number;

	/** ID пользователя, чей аккаунт будет удален */
	user_id: number;

	/** Дата, когда аккаунт будет автоматически удален */
	deletion_date: string;

	/** Дата создания запроса на удаление */
	created_at: string;
}

/**
 * Запланированное удаление с информацией о пользователе
 */
export interface PendingDeletionWithUser extends PendingDeletion {
	/** Email пользователя */
	user_email: string;

	/** Имя пользователя */
	user_first_name: string;

	/** Фамилия пользователя */
	user_last_name: string;

	/** Дата последнего мероприятия */
	last_event_date: string | null;
}

/**
 * Данные для выдачи прав администратора
 */
export interface AdminGrantData {
	/** ID пользователя, которому выдаются права */
	user_id: number;
}

/**
 * Данные для отзыва прав администратора
 */
export interface AdminRevokeData {
	/** ID пользователя, у которого отзываются права */
	user_id: number;
}

/**
 * Данные для логирования действия
 */
export interface ActivityLogCreateData {
	/** ID пользователя (null для системных действий) */
	user_id?: number | null;

	/** Тип действия */
	action_type: ActivityLogActionType;

	/** Дополнительные детали */
	details?: Record<string, unknown>;

	/** IP адрес */
	ip_address?: string;
}
