/**
 * Admin Types
 * Типы для работы с администраторами и системными функциями
 */

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
 * Типы действий для логирования
 */
export type ActivityLogAction =
	| 'user_register'
	| 'user_login'
	| 'user_logout'
	| 'user_update_profile'
	| 'user_delete_account'
	| 'event_register'
	| 'event_cancel_registration'
	| 'admin_create_event'
	| 'admin_update_event'
	| 'admin_delete_event'
	| 'admin_cancel_event'
	| 'admin_publish_event'
	| 'admin_send_newsletter'
	| 'admin_grant_rights'
	| 'admin_revoke_rights'
	| 'admin_block_user'
	| 'admin_unblock_user'
	| 'admin_export_data'
	| 'admin_import_data';

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
	action_type: ActivityLogAction;

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
	action_type: ActivityLogAction;

	/** Дополнительные детали */
	details?: Record<string, unknown>;

	/** IP адрес */
	ip_address?: string;
}
