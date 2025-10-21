/**
 * Common Types
 * Общие типы, используемые во всем приложении
 */

/**
 * Поддерживаемые языки интерфейса
 */
export type LanguageCode = 'de' | 'en' | 'ru' | 'uk';

/**
 * Поддерживаемые языки с опцией "все языки" (для фильтров и рассылок)
 */
export type LanguageCodeOrAll = LanguageCode | 'all';
