/**
 * User Types
 * Типы для работы с пользователями системы
 */

import type { LanguageCode } from './common';

/**
 * Полная информация о пользователе (включая конфиденциальные данные)
 * Соответствует таблице `users` в БД
 */
export interface User {
	/** Уникальный идентификатор пользователя */
	id: number;

	/** Email адрес (используется для входа) */
	email: string;

	/** Хеш пароля (bcrypt) */
	password_hash: string;

	/** Имя */
	first_name: string;

	/** Фамилия */
	last_name: string;

	/** Дата рождения (ISO 8601 format: YYYY-MM-DD) */
	birth_date: string;

	/** Улица */
	address_street: string;

	/** Номер дома */
	address_number: string;

	/** Почтовый индекс */
	address_zip: string;

	/** Город */
	address_city: string;

	/** Номер телефона */
	phone: string;

	/** WhatsApp номер (может отличаться от основного телефона) */
	whatsapp: string | null;

	/** Telegram username или номер */
	telegram: string | null;

	/** Согласие на фото/видео съемку */
	photo_video_consent: boolean;

	/** Предпочитаемый язык интерфейса */
	preferred_language: LanguageCode;

	/** Согласие родителей (требуется для пользователей младше 18 лет) */
	parental_consent: boolean;

	/** Флаг блокировки аккаунта (например, при запланированном удалении) */
	is_blocked: boolean;

	/** Дата создания аккаунта */
	created_at: string;

	/** Дата последнего обновления профиля */
	updated_at: string;
}

/**
 * Публичный профиль пользователя (без конфиденциальных данных)
 * Используется для отображения в UI и передачи клиенту
 */
export interface UserProfile {
	/** Уникальный идентификатор пользователя */
	id: number;

	/** Email адрес */
	email: string;

	/** Имя */
	first_name: string;

	/** Фамилия */
	last_name: string;

	/** Дата рождения (ISO 8601 format: YYYY-MM-DD) */
	birth_date: string;

	/** Улица */
	address_street: string;

	/** Номер дома */
	address_number: string;

	/** Почтовый индекс */
	address_zip: string;

	/** Город */
	address_city: string;

	/** Номер телефона */
	phone: string;

	/** WhatsApp номер */
	whatsapp: string | null;

	/** Telegram username или номер */
	telegram: string | null;

	/** Согласие на фото/видео съемку */
	photo_video_consent: boolean;

	/** Предпочитаемый язык интерфейса */
	preferred_language: LanguageCode;

	/** Согласие родителей */
	parental_consent: boolean;

	/** Флаг блокировки аккаунта */
	is_blocked: boolean;

	/** Дата создания аккаунта */
	created_at: string;

	/** Дата последнего обновления профиля */
	updated_at: string;
}

/**
 * Данные для регистрации нового пользователя
 */
export interface UserRegistrationData {
	/** Email адрес */
	email: string;

	/** Пароль (минимум 8 символов) */
	password: string;

	/** Подтверждение пароля */
	password_confirm: string;

	/** Имя */
	first_name: string;

	/** Фамилия */
	last_name: string;

	/** Дата рождения (ISO 8601 format: YYYY-MM-DD) */
	birth_date: string;

	/** Улица */
	address_street: string;

	/** Номер дома */
	address_number: string;

	/** Почтовый индекс */
	address_zip: string;

	/** Город */
	address_city: string;

	/** Номер телефона */
	phone: string;

	/** WhatsApp номер (опционально) */
	whatsapp?: string;

	/** Telegram username или номер (опционально) */
	telegram?: string;

	/** Согласие на фото/видео съемку */
	photo_video_consent: boolean;

	/** Предпочитаемый язык интерфейса */
	preferred_language: LanguageCode;

	/** Согласие родителей (обязательно для пользователей младше 18 лет) */
	parental_consent: boolean;

	/** Согласие на обработку персональных данных (GDPR) */
	gdpr_consent: boolean;
}

/**
 * Данные для обновления профиля пользователя
 * Все поля опциональны (обновляется только то, что передано)
 */
export interface UserUpdateData {
	/** Email адрес */
	email?: string;

	/** Хеш пароля (используется внутри системы, не в запросах клиента) */
	password_hash?: string;

	/** Имя */
	first_name?: string;

	/** Фамилия */
	last_name?: string;

	/** Дата рождения (ISO 8601 format: YYYY-MM-DD) */
	birth_date?: string;

	/** Улица */
	address_street?: string;

	/** Номер дома */
	address_number?: string;

	/** Почтовый индекс */
	address_zip?: string;

	/** Город */
	address_city?: string;

	/** Номер телефона */
	phone?: string;

	/** WhatsApp номер */
	whatsapp?: string | null;

	/** Telegram username или номер */
	telegram?: string | null;

	/** Согласие на фото/видео съемку */
	photo_video_consent?: boolean;

	/** Предпочитаемый язык интерфейса */
	preferred_language?: LanguageCode;

	/** Согласие родителей (может обновляться если пользователь достиг 18 лет) */
	parental_consent?: boolean;

	/** Флаг блокировки аккаунта (только для админов) */
	is_blocked?: boolean;

	/** Текущий пароль (требуется для смены пароля) */
	current_password?: string;

	/** Новый пароль */
	new_password?: string;

	/** Подтверждение нового пароля */
	new_password_confirm?: string;
}

/**
 * Данные для входа в систему
 */
export interface UserLoginData {
	/** Email адрес */
	email: string;

	/** Пароль */
	password: string;
}

/**
 * Минимальная информация о пользователе для списков
 */
export interface UserListItem {
	/** Уникальный идентификатор */
	id: number;

	/** Email адрес */
	email: string;

	/** Имя */
	first_name: string;

	/** Фамилия */
	last_name: string;

	/** Дата регистрации */
	created_at: string;

	/** Статус блокировки */
	is_blocked: boolean;
}
