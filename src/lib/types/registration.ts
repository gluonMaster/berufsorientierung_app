/**
 * Registration Types
 * Типы для работы с регистрациями на мероприятия
 */

/**
 * Регистрация пользователя на мероприятие
 * Соответствует таблице `registrations` в БД
 */
export interface Registration {
	/** Уникальный идентификатор регистрации */
	id: number;

	/** ID пользователя */
	user_id: number;

	/** ID мероприятия */
	event_id: number;

	/** Дополнительные данные (ответы на дополнительные поля мероприятия) */
	additional_data: string | null; // JSON строка

	/** Дата и время регистрации */
	registered_at: string;

	/** Дата и время отмены регистрации */
	cancelled_at: string | null;

	/** Причина отмены регистрации */
	cancellation_reason: string | null;
}

/**
 * Регистрация с информацией о пользователе
 */
export interface RegistrationWithUser extends Registration {
	/** Имя пользователя */
	user_first_name: string;

	/** Фамилия пользователя */
	user_last_name: string;

	/** Email пользователя */
	user_email: string;

	/** Телефон пользователя */
	user_phone: string;

	/** WhatsApp пользователя */
	user_whatsapp: string | null;

	/** Telegram пользователя */
	user_telegram: string | null;
}

/**
 * Регистрация с информацией о мероприятии
 */
export interface RegistrationWithEvent extends Registration {
	/** Заголовок мероприятия на немецком */
	event_title_de: string;

	/** Заголовок мероприятия на английском */
	event_title_en: string | null;

	/** Заголовок мероприятия на русском */
	event_title_ru: string | null;

	/** Заголовок мероприятия на украинском */
	event_title_uk: string | null;

	/** Дата проведения мероприятия */
	event_date: string;

	/** Место проведения на немецком */
	event_location_de: string;

	/** Статус мероприятия */
	event_status: 'draft' | 'active' | 'cancelled';
}

/**
 * Полная информация о регистрации (с пользователем и мероприятием)
 */
export interface RegistrationWithDetails extends Registration {
	/** Имя пользователя */
	user_first_name: string;

	/** Фамилия пользователя */
	user_last_name: string;

	/** Email пользователя */
	user_email: string;

	/** Телефон пользователя */
	user_phone: string;

	/** Заголовок мероприятия на немецком */
	event_title_de: string;

	/** Дата проведения мероприятия */
	event_date: string;

	/** Место проведения на немецком */
	event_location_de: string;
}

/**
 * Данные для создания новой регистрации
 */
export interface RegistrationCreateData {
	/** ID мероприятия */
	event_id: number;

	/** Дополнительные данные (ответы на дополнительные поля) */
	additional_data?: Record<string, unknown>;

	/** Подтверждение данных профиля */
	profile_confirmed?: boolean;
}

/**
 * Данные для отмены регистрации
 */
export interface RegistrationCancelData {
	/** ID регистрации */
	registration_id: number;

	/** Причина отмены */
	cancellation_reason?: string;
}

/**
 * Минимальная информация о регистрации для списков
 */
export interface RegistrationListItem {
	/** Уникальный идентификатор */
	id: number;

	/** Полное имя пользователя */
	user_full_name: string;

	/** Email пользователя */
	user_email: string;

	/** Заголовок мероприятия */
	event_title: string;

	/** Дата регистрации */
	registered_at: string;

	/** Статус (активна/отменена) */
	is_cancelled: boolean;
}
