/**
 * API Types
 * Типы для API запросов и ответов
 */

import type { LanguageCode, LanguageCodeOrAll } from './common';

/**
 * Стандартная обёртка для успешных API ответов
 */
export interface ApiResponse<T = unknown> {
	/** Флаг успешности операции */
	success: true;

	/** Данные ответа */
	data: T;

	/** Опциональное сообщение */
	message?: string;
}

/**
 * Стандартная обёртка для ошибочных API ответов
 */
export interface ApiErrorResponse {
	/** Флаг успешности операции */
	success: false;

	/** Сообщение об ошибке */
	error: string;

	/** Код ошибки (для программной обработки) */
	code?: string;

	/** HTTP статус код */
	statusCode?: number;

	/** Дополнительные детали ошибки */
	details?: Record<string, unknown>;
}

/**
 * Объединенный тип API ответа
 */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiErrorResponse;

/**
 * Информация об ошибке
 */
export interface ApiError {
	/** Сообщение об ошибке */
	message: string;

	/** Код ошибки */
	code?: string;

	/** HTTP статус код */
	statusCode: number;

	/** Дополнительные детали */
	details?: Record<string, unknown>;
}

/**
 * Пагинированный ответ
 */
export interface PaginatedResponse<T> {
	/** Элементы текущей страницы */
	items: T[];

	/** Общее количество элементов */
	total: number;

	/** Номер текущей страницы (с 1) */
	page: number;

	/** Размер страницы */
	page_size: number;

	/** Общее количество страниц */
	total_pages: number;

	/** Есть ли следующая страница */
	has_next: boolean;

	/** Есть ли предыдущая страница */
	has_prev: boolean;
}

/**
 * Параметры пагинации для запросов
 */
export interface PaginationParams {
	/** Номер страницы (с 1) */
	page?: number;

	/** Размер страницы */
	page_size?: number;

	/** Поле для сортировки */
	sort_by?: string;

	/** Направление сортировки */
	sort_order?: 'asc' | 'desc';
}

/**
 * Данные для входа
 */
export interface LoginRequest {
	/** Email адрес */
	email: string;

	/** Пароль */
	password: string;

	/** Cloudflare Turnstile токен */
	turnstile_token?: string;
}

/**
 * Ответ при успешном входе
 */
export interface LoginResponse {
	/** Информация о пользователе */
	user: {
		id: number;
		email: string;
		first_name: string;
		last_name: string;
		preferred_language: LanguageCode;
		is_admin: boolean;
	};

	/** JWT токен (в production будет в httpOnly cookie) */
	token?: string;
}

/**
 * Статистика по мероприятиям
 */
export interface EventStatistics {
	/** Общее количество мероприятий */
	total_events: number;

	/** Количество активных мероприятий */
	active_events: number;

	/** Количество предстоящих мероприятий */
	upcoming_events: number;

	/** Количество прошедших мероприятий */
	past_events: number;

	/** Количество отмененных мероприятий */
	cancelled_events: number;

	/** Общее количество участников */
	total_participants: number;

	/** Среднее количество участников на мероприятие */
	average_participants_per_event: number;
}

/**
 * Статистика по пользователям
 */
export interface UserStatistics {
	/** Общее количество пользователей */
	total_users: number;

	/** Количество новых пользователей в этом месяце */
	new_users_this_month: number;

	/** Количество активных пользователей (зарегистрированных хотя бы на одно мероприятие) */
	active_users: number;

	/** Количество заблокированных пользователей */
	blocked_users: number;

	/** Количество пользователей, ожидающих удаления */
	pending_deletions: number;
}

/**
 * Общая статистика системы
 */
export interface SystemStatistics {
	/** Статистика по мероприятиям */
	events: EventStatistics;

	/** Статистика по пользователям */
	users: UserStatistics;

	/** Дата и время формирования статистики */
	generated_at: string;
}

/**
 * Данные для массовой рассылки
 */
export interface NewsletterRequest {
	/** Тема письма */
	subject: string;

	/** Тело письма (поддерживает переменные: {first_name}, {last_name}, {email}) */
	body: string;

	/** Целевой язык (или 'all' для всех) */
	target_language?: LanguageCodeOrAll;

	/** Целевая группа получателей */
	target_group?: 'all' | 'active' | 'inactive' | 'event_participants';

	/** ID конкретного мероприятия (если target_group = 'event_participants') */
	event_id?: number;

	/** Тестовый режим (отправка только администраторам) */
	test_mode?: boolean;

	/** Cloudflare Turnstile токен */
	turnstile_token?: string;
}

/**
 * Результат массовой рассылки
 */
export interface NewsletterResponse {
	/** Количество успешно отправленных писем */
	sent: number;

	/** Количество ошибок при отправке */
	failed: number;

	/** Общее количество получателей */
	total: number;

	/** Список адресов с ошибками */
	failed_emails?: string[];

	/** Время выполнения рассылки (мс) */
	duration_ms: number;
}

/**
 * Параметры экспорта данных
 */
export interface ExportRequest {
	/** Тип данных для экспорта */
	type: 'events' | 'users' | 'registrations' | 'all';

	/** Формат экспорта */
	format: 'json' | 'csv';

	/** Фильтр по датам (ISO 8601) */
	date_from?: string;

	/** Фильтр по датам (ISO 8601) */
	date_to?: string;

	/** Включать ли удаленные записи */
	include_deleted?: boolean;
}

/**
 * Данные для импорта мероприятий
 */
export interface ImportEventsRequest {
	/** JSON строка с массивом мероприятий */
	events_json: string;

	/** Режим импорта */
	mode: 'create_only' | 'update_existing' | 'replace_all';

	/** Автоматически опубликовать импортированные мероприятия */
	auto_publish?: boolean;
}

/**
 * Результат импорта мероприятий
 */
export interface ImportEventsResponse {
	/** Количество созданных мероприятий */
	created: number;

	/** Количество обновленных мероприятий */
	updated: number;

	/** Количество пропущенных мероприятий */
	skipped: number;

	/** Количество ошибок */
	errors: number;

	/** Детали ошибок */
	error_details?: Array<{
		index: number;
		event_title?: string;
		error: string;
	}>;
}

/**
 * Параметры фильтрации мероприятий
 */
export interface EventFilterParams extends PaginationParams {
	/** Фильтр по статусу */
	status?: 'draft' | 'active' | 'cancelled' | 'all';

	/** Фильтр по дате начала */
	date_from?: string;

	/** Фильтр по дате окончания */
	date_to?: string;

	/** Поиск по тексту (в заголовке и описании) */
	search?: string;

	/** Фильтр по наличию мест */
	has_available_places?: boolean;
}

/**
 * Параметры фильтрации пользователей
 */
export interface UserFilterParams extends PaginationParams {
	/** Поиск по email или имени */
	search?: string;

	/** Фильтр по статусу блокировки */
	is_blocked?: boolean;

	/** Фильтр по наличию прав администратора */
	is_admin?: boolean;

	/** Фильтр по дате регистрации (от) */
	registered_from?: string;

	/** Фильтр по дате регистрации (до) */
	registered_to?: string;
}

/**
 * Параметры фильтрации регистраций
 */
export interface RegistrationFilterParams extends PaginationParams {
	/** Фильтр по ID мероприятия */
	event_id?: number;

	/** Фильтр по ID пользователя */
	user_id?: number;

	/** Показывать только отмененные */
	cancelled_only?: boolean;

	/** Фильтр по дате регистрации (от) */
	registered_from?: string;

	/** Фильтр по дате регистрации (до) */
	registered_to?: string;
}
