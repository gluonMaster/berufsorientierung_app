/**
 * Event Types
 * Типы для работы с мероприятиями
 */

/**
 * Статус мероприятия
 */
export type EventStatus = 'draft' | 'active' | 'cancelled';

/**
 * Тип дополнительного поля
 * Согласно спецификации Prompt 1.3
 */
export type FieldType = 'text' | 'select' | 'checkbox' | 'date' | 'number';

/**
 * Мультиязычные переводы для мероприятия
 */
export interface EventTranslations {
	/** Заголовок на немецком (обязательно) */
	title_de: string;

	/** Заголовок на английском */
	title_en?: string | null;

	/** Заголовок на русском */
	title_ru?: string | null;

	/** Заголовок на украинском */
	title_uk?: string | null;

	/** Описание на немецком (обязательно) */
	description_de: string;

	/** Описание на английском */
	description_en?: string | null;

	/** Описание на русском */
	description_ru?: string | null;

	/** Описание на украинском */
	description_uk?: string | null;

	/** Требования на немецком */
	requirements_de?: string | null;

	/** Требования на английском */
	requirements_en?: string | null;

	/** Требования на русском */
	requirements_ru?: string | null;

	/** Требования на украинском */
	requirements_uk?: string | null;

	/** Место проведения на немецком (обязательно) */
	location_de: string;

	/** Место проведения на английском */
	location_en?: string | null;

	/** Место проведения на русском */
	location_ru?: string | null;

	/** Место проведения на украинском */
	location_uk?: string | null;
}

/**
 * Мультиязычные переводы для создания мероприятия
 * Согласно спецификации Prompt 1.3: обязателен только title_de
 */
export interface EventTranslationsCreate {
	/** Заголовок на немецком (обязательно) */
	title_de: string;

	/** Заголовок на английском */
	title_en?: string | null;

	/** Заголовок на русском */
	title_ru?: string | null;

	/** Заголовок на украинском */
	title_uk?: string | null;

	/** Описание на немецком (опционально) */
	description_de?: string | null;

	/** Описание на английском */
	description_en?: string | null;

	/** Описание на русском */
	description_ru?: string | null;

	/** Описание на украинском */
	description_uk?: string | null;

	/** Требования на немецком */
	requirements_de?: string | null;

	/** Требования на английском */
	requirements_en?: string | null;

	/** Требования на русском */
	requirements_ru?: string | null;

	/** Требования на украинском */
	requirements_uk?: string | null;

	/** Место проведения на немецком (опционально) */
	location_de?: string | null;

	/** Место проведения на английском */
	location_en?: string | null;

	/** Место проведения на русском */
	location_ru?: string | null;

	/** Место проведения на украинском */
	location_uk?: string | null;
}

/**
 * Полная информация о мероприятии
 * Соответствует таблице `events` в БД
 */
export interface Event extends EventTranslations {
	/** Уникальный идентификатор мероприятия */
	id: number;

	/** Дата проведения мероприятия (ISO 8601 format) */
	date: string;

	/** Дата и время окончания мероприятия (ISO 8601 format, nullable) */
	end_date: string | null;

	/** Крайний срок регистрации (ISO 8601 format) */
	registration_deadline: string;

	/** Максимальное количество участников (null = безлимит) */
	max_participants: number | null;

	/** Ссылка на Telegram группу/канал */
	telegram_link: string | null;

	/** Ссылка на WhatsApp группу */
	whatsapp_link: string | null;

	/** URL QR-кода для Telegram (в R2 storage) */
	qr_telegram_url: string | null;

	/** URL QR-кода для WhatsApp (в R2 storage) */
	qr_whatsapp_url: string | null;

	/** Текущий статус мероприятия */
	status: EventStatus;

	/** Дата и время отмены мероприятия */
	cancelled_at: string | null;

	/** Причина отмены мероприятия */
	cancellation_reason: string | null;

	/** Дата создания записи */
	created_at: string;

	/** Дата последнего обновления */
	updated_at: string;

	/** ID администратора, создавшего мероприятие */
	created_by: number;

	/** Текущее количество зарегистрированных участников (вычисляемое поле) */
	current_participants?: number;
}

/**
 * Дополнительное поле для сбора информации при регистрации
 * Соответствует таблице `event_additional_fields` в БД
 *
 * Поле field_options возвращается из БД как распарсенный объект/массив,
 * но в БД хранится как JSON строка
 */
export interface EventAdditionalField {
	/** Уникальный идентификатор поля */
	id: number;

	/** ID мероприятия, к которому относится поле */
	event_id: number;

	/** Ключ поля (используется для хранения значения) */
	field_key: string;

	/** Тип поля */
	field_type: FieldType;

	/**
	 * Опции для select/checkbox (массив строк для выбора)
	 * null для text/date/number полей
	 * Возвращается как распарсенный объект, в БД хранится как JSON строка
	 */
	field_options: string[] | null;

	/** Обязательно ли поле для заполнения */
	required: boolean;

	/** Метка поля на немецком */
	label_de: string;

	/** Метка поля на английском */
	label_en: string | null;

	/** Метка поля на русском */
	label_ru: string | null;

	/** Метка поля на украинском */
	label_uk: string | null;

	/** Placeholder на немецком */
	placeholder_de: string | null;

	/** Placeholder на английском */
	placeholder_en: string | null;

	/** Placeholder на русском */
	placeholder_ru: string | null;

	/** Placeholder на украинском */
	placeholder_uk: string | null;
}

/**
 * Входные данные для создания дополнительного поля
 * Принимает field_options как массив строк или null
 * Внутри будет автоматически сериализовано в JSON строку для БД
 */
export type EventAdditionalFieldInput = Omit<EventAdditionalField, 'id' | 'event_id'>;

/**
 * Данные для создания нового мероприятия
 * Использует EventTranslationsCreate, где обязателен только title_de
 */
export interface EventCreateData extends EventTranslationsCreate {
	/** Дата проведения мероприятия (ISO 8601 format) */
	date: string;

	/** Дата и время окончания мероприятия (ISO 8601 format, опционально) */
	end_date?: string | null;

	/** Крайний срок регистрации (ISO 8601 format) */
	registration_deadline: string;

	/** Максимальное количество участников (null = безлимит) */
	max_participants: number | null;

	/** Ссылка на Telegram группу/канал */
	telegram_link?: string;

	/** Ссылка на WhatsApp группу */
	whatsapp_link?: string;

	/** Начальный статус (по умолчанию 'draft') */
	status?: 'draft' | 'active';

	/** Дополнительные поля для сбора информации */
	additional_fields?: EventAdditionalFieldInput[];
}

/**
 * Данные для обновления мероприятия
 * Все поля опциональны
 */
export interface EventUpdateData extends Partial<EventTranslations> {
	/** Дата проведения мероприятия */
	date?: string;

	/** Дата и время окончания мероприятия */
	end_date?: string | null;

	/** Крайний срок регистрации */
	registration_deadline?: string;

	/** Максимальное количество участников (null = безлимит) */
	max_participants?: number | null;

	/** Ссылка на Telegram группу/канал */
	telegram_link?: string | null;

	/** Ссылка на WhatsApp группу */
	whatsapp_link?: string | null;

	/** Статус мероприятия */
	status?: EventStatus;

	/** Дополнительные поля для сбора информации */
	additional_fields?: EventAdditionalFieldInput[];
}

/**
 * Мероприятие с дополнительными полями
 */
export interface EventWithFields extends Event {
	/** Дополнительные поля для регистрации */
	additional_fields: EventAdditionalField[];
}

/**
 * Минимальная информация о мероприятии для списков
 */
export interface EventListItem {
	/** Уникальный идентификатор */
	id: number;

	/** Заголовок на немецком */
	title_de: string;

	/** Дата проведения */
	date: string;

	/** Дата и время окончания мероприятия */
	end_date: string | null;

	/** Крайний срок регистрации */
	registration_deadline: string;

	/** Максимальное количество участников (null = безлимит) */
	max_participants: number | null;

	/** Текущее количество участников */
	current_participants: number;

	/** Статус */
	status: EventStatus;

	/** Дата создания */
	created_at: string;
}
