/**
 * Email Templates Module
 *
 * Модуль текстовых шаблонов email с мультиязычностью
 *
 * Все шаблоны:
 * - Текстовые (не HTML)
 * - Мультиязычные (загрузка переводов из static/translations/)
 * - Максимум 80 символов на строку
 * - Профессиональный тон
 * - С контактами для вопросов
 */

import type { User } from '$lib/types/user';
import type { Event } from '$lib/types/event';
import type { LanguageCode } from '$lib/types/common';

// Импортируем переводы напрямую (работает в Cloudflare Workers и локально)
import translationsDe from '../../../../static/translations/de.json';
import translationsEn from '../../../../static/translations/en.json';
import translationsRu from '../../../../static/translations/ru.json';
import translationsUk from '../../../../static/translations/uk.json';

/**
 * Тип для структуры переводов
 */
interface Translations {
	[key: string]: any;
}

/**
 * Карта переводов для всех языков
 * Переводы загружаются на этапе сборки через статический импорт
 */
const translationsMap: Record<LanguageCode, Translations> = {
	de: translationsDe,
	en: translationsEn,
	ru: translationsRu,
	uk: translationsUk,
};

/**
 * Загрузка переводов для указанного языка
 *
 * Функция возвращает предзагруженные переводы из статических импортов.
 * Это работает как в Cloudflare Workers, так и локально.
 *
 * @param language - Код языка (de, en, ru, uk)
 * @returns Объект с переводами
 */
function loadTranslations(language: LanguageCode): Translations {
	const translations = translationsMap[language];

	if (!translations) {
		console.warn(
			`[Email Templates] Translations for ${language} not found, falling back to German`
		);
		return translationsMap.de;
	}

	return translations;
}

/**
 * Вспомогательная функция для получения перевода по пути
 *
 * @param translations - Объект переводов
 * @param path - Путь к ключу (например, "email.subjects.welcome")
 * @param params - Параметры для подстановки (например, {name: "John"})
 * @returns Переведенная строка с подставленными параметрами
 */
function translate(
	translations: Translations,
	path: string,
	params?: Record<string, string>
): string {
	const keys = path.split('.');
	let value: any = translations;

	// Идём по пути к нужному ключу
	for (const key of keys) {
		if (value && typeof value === 'object' && key in value) {
			value = value[key];
		} else {
			// Если ключ не найден, возвращаем путь как есть
			console.warn(`[Email Templates] Translation key not found: ${path}`);
			return path;
		}
	}

	// Если значение не строка, возвращаем путь
	if (typeof value !== 'string') {
		console.warn(`[Email Templates] Translation value is not a string: ${path}`);
		return path;
	}

	// Подставляем параметры
	if (params) {
		for (const [key, val] of Object.entries(params)) {
			value = value.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
		}
	}

	return value;
}

/**
 * Получение мультиязычного поля события с fallback на немецкий
 *
 * @param event - Объект мероприятия
 * @param field - Название поля (title, description, requirements, location)
 * @param language - Код языка
 * @returns Значение поля на указанном языке или на немецком (fallback)
 */
function getEventField(
	event: Event,
	field: 'title' | 'description' | 'requirements' | 'location',
	language: LanguageCode
): string {
	const fieldKey = `${field}_${language}` as keyof Event;
	const fallbackKey = `${field}_de` as keyof Event;

	// Пытаемся получить значение на запрошенном языке
	const value = event[fieldKey];
	if (value && typeof value === 'string') {
		return value;
	}

	// Fallback на немецкий
	const fallbackValue = event[fallbackKey];
	if (fallbackValue && typeof fallbackValue === 'string') {
		return fallbackValue;
	}

	// Если даже немецкого нет, возвращаем пустую строку или название поля
	return `[${field}]`;
}

/**
 * Форматирование даты в читаемый формат
 *
 * @param dateString - Дата в ISO 8601 формате (YYYY-MM-DD или YYYY-MM-DDTHH:MM:SS)
 * @param language - Код языка для форматирования
 * @returns Дата в формате DD.MM.YYYY
 */
function formatDate(dateString: string, language: LanguageCode): string {
	const date = new Date(dateString);

	// Проверяем валидность даты
	if (isNaN(date.getTime())) {
		return dateString;
	}

	// Форматируем в DD.MM.YYYY (универсальный формат для Европы)
	const day = date.getDate().toString().padStart(2, '0');
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const year = date.getFullYear();

	return `${day}.${month}.${year}`;
}

/**
 * Форматирование строки с максимальной длиной 80 символов
 * Разбивает текст на строки, добавляя отступы при необходимости
 */
function wrapText(text: string, maxLength: number = 80, indent: string = ''): string {
	if (text.length <= maxLength) {
		return text;
	}

	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = indent;

	for (const word of words) {
		if ((currentLine + word).length > maxLength) {
			lines.push(currentLine.trimEnd());
			currentLine = indent + word + ' ';
		} else {
			currentLine += word + ' ';
		}
	}

	if (currentLine.trim()) {
		lines.push(currentLine.trimEnd());
	}

	return lines.join('\n');
}

/**
 * 1. WELCOME EMAIL
 *
 * Приветственное письмо при регистрации
 *
 * @param user - Объект пользователя
 * @param language - Код языка
 * @returns Объект с темой и текстом письма
 */
export function getWelcomeEmail(
	user: User,
	language: LanguageCode
): { subject: string; text: string } {
	const t = loadTranslations(language);

	const subject = translate(t, 'email.subjects.welcome');

	const greeting = translate(t, 'email.greeting', { name: user.first_name });
	const footer = translate(t, 'email.footer');
	const thankYou = translate(t, 'email.thankYou');
	const team = translate(t, 'email.team');

	// Получаем переводы для содержимого письма
	const intro = translate(t, 'email.welcome.intro');
	const howItWorks = translate(t, 'email.welcome.howItWorks');
	const nextSteps = translate(t, 'email.welcome.nextSteps');
	const step1 = translate(t, 'email.welcome.step1');
	const step2 = translate(t, 'email.welcome.step2');
	const step3 = translate(t, 'email.welcome.step3');
	const closing = translate(t, 'email.welcome.closing');

	// Формируем текст письма
	const text = `
${greeting},

${wrapText(intro)}

${wrapText(howItWorks)}

${nextSteps}
- ${step1}
- ${step2}
- ${step3}

${wrapText(closing)}

${footer}

${thankYou},
${team}
`.trim();

	return { subject, text };
}

/**
 * 5. PASSWORD RESET EMAIL
 *
 * Письмо для восстановления пароля
 *
 * @param user - Объект пользователя
 * @param language - Код языка
 * @param resetLink - Ссылка для сброса пароля
 * @returns Объект с темой и текстом письма
 */
export function getPasswordResetEmail(
	user: User,
	language: LanguageCode,
	resetLink: string
): { subject: string; text: string } {
	const t = loadTranslations(language);

	const subject = translate(t, 'email.subjects.passwordReset');

	const greeting = translate(t, 'email.greeting', { name: user.first_name });
	const footer = translate(t, 'email.footer');
	const thankYou = translate(t, 'email.thankYou');
	const team = translate(t, 'email.team');

	// Получаем переводы для содержимого письма
	const intro = translate(t, 'email.passwordReset.intro');
	const instructions = translate(t, 'email.passwordReset.instructions');
	const linkNotice = translate(t, 'email.passwordReset.linkNotice');
	const ignoreIfNotYou = translate(t, 'email.passwordReset.ignoreIfNotYou');
	const securityNote = translate(t, 'email.passwordReset.securityNote');

	// Формируем текст письма
	const text = `
${greeting},

${wrapText(intro)}

${instructions}
${resetLink}

${wrapText(linkNotice)}

${wrapText(ignoreIfNotYou)}

${wrapText(securityNote)}

${footer}

${thankYou},
${team}
`.trim();

	return { subject, text };
}

/**
 * 2. EVENT REGISTRATION EMAIL
 *
 * Подтверждение записи на мероприятие
 *
 * @param user - Объект пользователя
 * @param event - Объект мероприятия
 * @param language - Код языка
 * @param telegramLink - Ссылка на Telegram группу (опционально)
 * @param whatsappLink - Ссылка на WhatsApp группу (опционально)
 * @returns Объект с темой и текстом письма
 */
export function getEventRegistrationEmail(
	user: User,
	event: Event,
	language: LanguageCode,
	telegramLink?: string,
	whatsappLink?: string
): { subject: string; text: string } {
	const t = loadTranslations(language);

	const eventTitle = getEventField(event, 'title', language);
	const eventDescription = getEventField(event, 'description', language);
	const eventLocation = getEventField(event, 'location', language);
	const eventRequirements = getEventField(event, 'requirements', language);

	const subject = translate(t, 'email.subjects.eventRegistration', { eventTitle });

	const greeting = translate(t, 'email.greeting', { name: user.first_name });
	const footer = translate(t, 'email.footer');
	const thankYou = translate(t, 'email.thankYou');
	const team = translate(t, 'email.team');

	// Получаем переводы для содержимого письма
	const confirmed = translate(t, 'email.eventRegistration.confirmed');
	const dateLabel = translate(t, 'email.eventRegistration.date');
	const locationLabel = translate(t, 'email.eventRegistration.location');
	const descriptionLabel = translate(t, 'email.eventRegistration.description');
	const requirementsLabel = translate(t, 'email.eventRegistration.requirements');
	const stayInTouch = translate(t, 'email.eventRegistration.stayInTouch');
	const telegramLabel = translate(t, 'email.eventRegistration.telegram');
	const whatsappLabel = translate(t, 'email.eventRegistration.whatsapp');
	const cancellationLabel = translate(t, 'email.eventRegistration.cancellation');
	const cancellationInfo = translate(t, 'email.eventRegistration.cancellationInfo');

	// Форматируем дату
	const formattedDate = formatDate(event.date, language);

	// Формируем секцию с ссылками на мессенджеры
	let messengerSection = '';
	if (telegramLink || whatsappLink) {
		messengerSection = `\n\n${stayInTouch}\n`;
		if (telegramLink) {
			// Ссылки не оборачиваются - это исключение из правила 80 символов
			messengerSection += `- ${telegramLabel}: ${telegramLink}\n`;
		}
		if (whatsappLink) {
			messengerSection += `- ${whatsappLabel}: ${whatsappLink}\n`;
		}
	}

	// Секция с требованиями (если есть)
	let requirementsSection = '';
	if (eventRequirements) {
		requirementsSection = `\n${requirementsLabel}:\n${wrapText(eventRequirements, 80, '  ')}\n`;
	}

	// Формируем текст письма
	const text = `
${greeting},

${wrapText(confirmed)}

${wrapText(eventTitle, 80)}

${dateLabel}: ${formattedDate}
${locationLabel}: ${wrapText(eventLocation, 80, '     ')}

${descriptionLabel}:
${wrapText(eventDescription, 80, '  ')}
${requirementsSection}${messengerSection}

${cancellationLabel}:
${wrapText(cancellationInfo)}

${footer}

${thankYou},
${team}
`.trim();

	return { subject, text };
}

/**
 * 3. EVENT CANCELLATION EMAIL
 *
 * Подтверждение отмены записи пользователем
 *
 * @param user - Объект пользователя
 * @param event - Объект мероприятия
 * @param language - Код языка
 * @returns Объект с темой и текстом письма
 */
export function getEventCancellationEmail(
	user: User,
	event: Event,
	language: LanguageCode
): { subject: string; text: string } {
	const t = loadTranslations(language);

	const eventTitle = getEventField(event, 'title', language);

	const subject = translate(t, 'email.subjects.eventCancellation', { eventTitle });

	const greeting = translate(t, 'email.greeting', { name: user.first_name });
	const footer = translate(t, 'email.footer');
	const thankYou = translate(t, 'email.thankYou');
	const team = translate(t, 'email.team');

	// Получаем переводы для содержимого письма
	const cancelled = translate(t, 'email.eventCancellation.cancelled');
	const dateLabel = translate(t, 'email.eventCancellation.date');
	const reregister = translate(t, 'email.eventCancellation.reregister');
	const seeYouSoon = translate(t, 'email.eventCancellation.seeYouSoon');

	// Форматируем дату
	const formattedDate = formatDate(event.date, language);

	// Формируем текст письма
	const text = `
${greeting},

${wrapText(cancelled)}

${wrapText(eventTitle, 80)}

${dateLabel}: ${formattedDate}

${wrapText(reregister)}

${wrapText(seeYouSoon)}

${footer}

${thankYou},
${team}
`.trim();

	return { subject, text };
}

/**
 * 4. EVENT CANCELLED BY ADMIN EMAIL
 *
 * Уведомление об отмене мероприятия администратором
 *
 * ⚠️ ВАЖНО: Использует общее приветствие без имени (email.greetingNoName)
 * для корректной массовой рассылки через sendBulkEmails.
 *
 * @param user - Объект пользователя (используется только для типизации, не для персонализации)
 * @param event - Объект мероприятия
 * @param reason - Причина отмены
 * @param language - Код языка
 * @param eventsUrl - URL страницы со списком мероприятий (опционально, по умолчанию "/events")
 *                    💡 Для продакшена рекомендуется передавать абсолютный URL из env переменной
 *                    (например, process.env.PUBLIC_EVENTS_URL || 'https://example.com/events')
 * @returns Объект с темой и текстом письма
 */
export function getEventCancelledByAdminEmail(
	user: User,
	event: Event,
	reason: string,
	language: LanguageCode,
	eventsUrl: string = '/events'
): { subject: string; text: string } {
	const t = loadTranslations(language);

	const eventTitle = getEventField(event, 'title', language);

	const subject = translate(t, 'email.subjects.eventCancelledByAdmin', { eventTitle });

	// Используем общее приветствие без имени для массовой рассылки
	const greeting = translate(t, 'email.greetingNoName');
	const footer = translate(t, 'email.footer');
	const thankYou = translate(t, 'email.thankYou');
	const team = translate(t, 'email.team');

	// Получаем переводы для содержимого письма
	const notification = translate(t, 'email.eventCancelledByAdmin.notification');
	const dateLabel = translate(t, 'email.eventRegistration.date');
	const reasonLabel = translate(t, 'email.eventCancelledByAdmin.reason');
	const apology = translate(t, 'email.eventCancelledByAdmin.apology');
	const checkWebsite = translate(t, 'email.eventCancelledByAdmin.checkWebsite');

	// Форматируем дату
	const formattedDate = formatDate(event.date, language);

	// Формируем текст письма
	const text = `
${greeting},

${wrapText(notification)}

${wrapText(eventTitle, 80)}

${dateLabel}: ${formattedDate}

${reasonLabel}:
${wrapText(reason, 80, '  ')}

${wrapText(apology)}

${wrapText(checkWebsite)}
${eventsUrl}

${footer}

${thankYou},
${team}
`.trim();

	return { subject, text };
}
