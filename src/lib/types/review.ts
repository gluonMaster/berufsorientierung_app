/**
 * Review Types
 * Типы для работы с отзывами и публичными ссылками на форму отзывов
 */

/**
 * Статус модерации отзыва
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/**
 * Публичная ссылка для анонимных отзывов
 * Соответствует таблице `review_public_links` в БД
 */
export interface ReviewPublicLink {
	/** Уникальный идентификатор ссылки */
	id: number;

	/** ID мероприятия, к которому относится ссылка */
	event_id: number;

	/** SHA-256 хеш токена (hex) */
	token_hash: string;

	/** ID пользователя-администратора, создавшего ссылку (null если удален) */
	created_by: number | null;

	/** Дата истечения срока действия ссылки (ISO string) */
	expires_at: string;

	/** Дата отзыва ссылки, если была отозвана (ISO string) */
	revoked_at: string | null;

	/** Дата создания ссылки (ISO string) */
	created_at: string;
}

/**
 * Отзыв о мероприятии
 * Соответствует таблице `reviews` в БД
 */
export interface Review {
	/** Уникальный идентификатор отзыва */
	id: number;

	/** ID мероприятия */
	event_id: number;

	/** ID пользователя (null для отзывов через публичную ссылку) */
	user_id: number | null;

	/** ID публичной ссылки, если отзыв оставлен через нее */
	public_link_id: number | null;

	/** Оценка от 1 до 10 */
	rating: number;

	/** Текст отзыва */
	comment: string;

	/** Флаг анонимности (0 или 1 в SQLite) */
	is_anonymous: number;

	/** Отображаемое имя для публичных отзывов */
	public_display_name: string | null;

	/** Статус модерации */
	status: ReviewStatus;

	/** Дата создания отзыва (ISO string) */
	created_at: string;

	/** Дата модерации (ISO string) */
	moderated_at: string | null;

	/** ID модератора */
	moderated_by: number | null;
}

/**
 * Отзыв с расширенной информацией для админ-панели
 */
export interface ReviewForAdminList extends Review {
	/** Название мероприятия на немецком */
	event_title_de: string;

	/** Дата мероприятия */
	event_date: string;

	/** Дата окончания мероприятия */
	event_end_date: string | null;

	/** Email автора (для авторизованных пользователей) */
	author_email: string | null;

	/** Имя автора (для авторизованных пользователей) */
	author_first_name: string | null;

	/** Фамилия автора (для авторизованных пользователей) */
	author_last_name: string | null;

	/** Флаг: отзыв через публичную ссылку (true) или авторизованный пользователь (false) */
	is_public_link_review: boolean;
}

/**
 * Публичный отзыв для отображения на сайте
 * Не содержит приватных полей (email, user_id, moderated_by и т.д.)
 */
export interface PublicReview {
	/** ID отзыва */
	id: number;

	/** ID мероприятия */
	event_id: number;

	/** Название мероприятия на немецком */
	event_title_de: string;

	/** Дата мероприятия */
	event_date: string;

	/** Оценка от 1 до 10 */
	rating: number;

	/** Текст отзыва */
	comment: string;

	/** Отображаемое имя автора или "Анонимно" */
	display_name: string | null;

	/** Дата создания отзыва */
	created_at: string;
}

/**
 * Параметры фильтрации для списка отзывов в админке
 */
export interface ReviewAdminFilters {
	/** Фильтр по статусу */
	status?: ReviewStatus;

	/** Лимит записей */
	limit?: number;

	/** Смещение для пагинации */
	offset?: number;

	/** ID мероприятия */
	event_id?: number;
}

/**
 * Результат списка отзывов для админки с пагинацией
 */
export interface ReviewAdminListResult {
	/** Список отзывов */
	items: ReviewForAdminList[];

	/** Общее количество записей */
	total: number;
}

/**
 * Параметры создания отзыва авторизованным пользователем
 */
export interface CreateUserReviewData {
	/** ID мероприятия */
	event_id: number;

	/** Оценка от 1 до 10 */
	rating: number;

	/** Текст отзыва */
	comment: string;

	/** Флаг анонимности */
	is_anonymous: boolean;
}

/**
 * Параметры создания отзыва через публичную ссылку
 */
export interface CreatePublicReviewData {
	/** Токен публичной ссылки */
	token: string;

	/** Оценка от 1 до 10 */
	rating: number;

	/** Текст отзыва */
	comment: string;

	/** Флаг анонимности */
	is_anonymous: boolean;

	/** Отображаемое имя (опционально) */
	public_display_name?: string;
}

/**
 * Параметры модерации отзывов
 */
export interface ReviewModerationData {
	/** ID отзывов для модерации (если не указано all_pending) */
	review_ids?: number[];

	/** Модерировать все pending отзывы */
	all_pending?: boolean;

	/** Новый статус */
	status: 'approved' | 'rejected';
}

/**
 * Окно возможности оставить отзыв
 */
export interface ReviewWindow {
	/** Дата начала окна отзывов */
	start: Date;

	/** Дата окончания окна отзывов */
	end: Date;
}
