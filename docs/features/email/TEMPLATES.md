# Email Templates Documentation

**Модуль:** `src/lib/server/email/templates.ts`  
**Создан:** 2025-10-24  
**Статус:** ✅ Реализовано

## 📋 Описание

Модуль содержит готовые текстовые email-шаблоны с полной мультиязычностью для всех этапов взаимодействия с пользователями.

## ✨ Особенности

- ✅ **Текстовые шаблоны** (plain text, не HTML) для максимальной совместимости
- ✅ **Полная мультиязычность** - все тексты загружаются из `static/translations/*.json`
- ✅ **Автоматический fallback** на немецкий для всех языков (de, en, ru, uk)
- ✅ **Максимум 80 символов на строку** для удобного чтения (кроме ссылок)
- ✅ **Профессиональный тон** с контактами для вопросов
- ✅ **Cloudflare Workers совместимость** через статические импорты
- ✅ **Типизация TypeScript** для всех функций
- ✅ **Нет хардкода** - весь контент письм берётся из переводов

## 📚 Доступные шаблоны

### 1. Welcome Email

**Функция:** `getWelcomeEmail(user, language)`

Приветственное письмо при регистрации нового пользователя.

**Содержит:**

- Приветствие
- Информация о платформе
- Как начать работу (шаги)
- Контакты для вопросов

**Пример использования:**

```typescript
import { getWelcomeEmail } from '$lib/server/email/templates';
import { sendEmail } from '$lib/server/email';

// В API route /api/auth/register/+server.ts
const { subject, text } = getWelcomeEmail(user, user.preferred_language);
await sendEmail(user.email, subject, text, platform.env);
```

---

### 2. Event Registration Email

**Функция:** `getEventRegistrationEmail(user, event, language, telegramLink?, whatsappLink?)`

Подтверждение записи на мероприятие.

**Содержит:**

- Подтверждение регистрации
- Детали мероприятия (название, дата, место, описание)
- Требования (если есть)
- Ссылки на Telegram/WhatsApp группы
- Правила отмены (минимум 3 дня)

**Пример использования:**

```typescript
import { getEventRegistrationEmail } from '$lib/server/email/templates';

const { subject, text } = getEventRegistrationEmail(
	user,
	event,
	user.preferred_language,
	event.telegram_link || undefined,
	event.whatsapp_link || undefined
);

await sendEmail(user.email, subject, text, platform.env);
```

---

### 3. Event Cancellation Email

**Функция:** `getEventCancellationEmail(user, event, language)`

Подтверждение отмены записи пользователем.

**Содержит:**

- Подтверждение отмены
- Детали отменённой регистрации
- Возможность повторной регистрации

**Пример использования:**

```typescript
import { getEventCancellationEmail } from '$lib/server/email/templates';

const { subject, text } = getEventCancellationEmail(user, event, user.preferred_language);

await sendEmail(user.email, subject, text, platform.env);
```

---

### 4. Event Cancelled by Admin Email

**Функция:** `getEventCancelledByAdminEmail(user, event, reason, language, eventsUrl?)`

Уведомление об отмене мероприятия администратором.

**Параметры:**

- `eventsUrl` (optional, default: `/events`) - URL страницы со списком мероприятий
  - 💡 **Для продакшена:** используйте абсолютный URL из env переменной `PUBLIC_EVENTS_URL`

**Содержит:**

- Извинения
- Детали отменённого мероприятия
- Причина отмены
- **Явная ссылка** на страницу с предстоящими мероприятиями

**Пример использования (продакшен):**

```typescript
import { getEventCancelledByAdminEmail } from '$lib/server/email/templates';

// Используем абсолютный URL из env (рекомендуется для продакшена)
const eventsUrl =
	platform.env.PUBLIC_EVENTS_URL || 'https://berufsorientierung.kolibri-dresden.de/events';

const { subject, text } = getEventCancelledByAdminEmail(
	user,
	event,
	'Недостаточное количество участников',
	user.preferred_language,
	eventsUrl
);

await sendEmail(user.email, subject, text, platform.env);
```

**Пример для разработки:**

```typescript
// Для локальной разработки можно использовать относительный путь
const { subject, text } = getEventCancelledByAdminEmail(
	user,
	event,
	reason,
	user.preferred_language
	// eventsUrl по умолчанию "/events"
);
```

---

## 🏗️ Архитектура

### Загрузка переводов

```typescript
// Статические импорты (работают в Cloudflare Workers)
import translationsDe from '../../../../static/translations/de.json';
import translationsEn from '../../../../static/translations/en.json';
import translationsRu from '../../../../static/translations/ru.json';
import translationsUk from '../../../../static/translations/uk.json';

const translationsMap: Record<LanguageCode, Translations> = {
	de: translationsDe,
	en: translationsEn,
	ru: translationsRu,
	uk: translationsUk,
};
```

**Преимущества:**

- ✅ Работает в Cloudflare Workers (нет доступа к файловой системе)
- ✅ Быстрая загрузка (встраивается в бандл на этапе сборки)
- ✅ Типобезопасность

### Вспомогательные функции

#### `translate(translations, path, params?)`

Получение перевода по пути с подстановкой параметров.

```typescript
translate(t, 'email.greeting', { name: 'John' });
// → "Hallo John" (для немецкого)
```

#### `getEventField(event, field, language)`

Получение мультиязычного поля мероприятия с fallback на немецкий.

```typescript
getEventField(event, 'title', 'ru');
// → event.title_ru || event.title_de
```

#### `formatDate(dateString, language)`

Форматирование даты в DD.MM.YYYY.

```typescript
formatDate('2025-12-31', 'de');
// → "31.12.2025"
```

#### `wrapText(text, maxLength, indent)`

Разбивка текста на строки максимальной длины 80 символов.

```typescript
wrapText('Very long text...', 80, '  ');
// → Текст разбитый на строки с отступом
```

---

## 📂 Структура переводов

Переводы для email находятся в `static/translations/*.json` в секции `email`:

```json
{
  "email": {
    "subjects": {
      "welcome": "Willkommen bei Berufsorientierung!",
      "eventRegistration": "Bestätigung: Anmeldung für {eventTitle}",
      "eventCancellation": "Stornierung: {eventTitle}",
      "eventCancelledByAdmin": "Veranstaltung abgesagt: {eventTitle}"
    },
    "greeting": "Hallo {name}",
    "footer": "Bei Fragen kontaktieren Sie uns: Berufsorientierung@kolibri-dresden.de",
    "thankYou": "Vielen Dank",
    "team": "Ihr Berufsorientierung Team",
    "welcome": { ... },
    "eventRegistration": { ... },
    "eventCancellation": { ... },
    "eventCancelledByAdmin": { ... }
  }
}
```

---

## 🔧 Использование в API Routes

### Пример: Регистрация пользователя

```typescript
// src/routes/api/auth/register/+server.ts
import { json, type RequestEvent } from '@sveltejs/kit';
import { getWelcomeEmail } from '$lib/server/email/templates';
import { sendEmail } from '$lib/server/email';

export async function POST({ request, platform }: RequestEvent) {
	// ... создание пользователя

	// Отправка welcome email
	const { subject, text } = getWelcomeEmail(user, user.preferred_language);
	await sendEmail(user.email, subject, text, platform!.env);

	return json({ success: true });
}
```

### Пример: Регистрация на мероприятие

```typescript
// src/routes/api/events/register/+server.ts
import { json, type RequestEvent } from '@sveltejs/kit';
import { getEventRegistrationEmail } from '$lib/server/email/templates';
import { sendEmail } from '$lib/server/email';

export async function POST({ request, platform }: RequestEvent) {
	// ... создание регистрации

	// Отправка confirmation email
	const { subject, text } = getEventRegistrationEmail(
		user,
		event,
		user.preferred_language,
		event.telegram_link || undefined,
		event.whatsapp_link || undefined
	);

	await sendEmail(user.email, subject, text, platform!.env);

	return json({ success: true });
}
```

### Пример: Массовая отправка при отмене мероприятия

```typescript
// src/routes/api/admin/events/cancel/+server.ts
import { getEventCancelledByAdminEmail } from '$lib/server/email/templates';
import { sendEmail } from '$lib/server/email';

export async function POST({ request, platform }: RequestEvent) {
	// ... получение всех зарегистрированных пользователей

	// Отправка уведомлений всем участникам
	for (const user of registeredUsers) {
		const { subject, text } = getEventCancelledByAdminEmail(
			user,
			event,
			cancellationReason,
			user.preferred_language
		);

		await sendEmail(user.email, subject, text, platform!.env);
	}

	return json({ success: true });
}
```

---

## ⚙️ Настройка переводов

При добавлении новых email-ключей обновите все 4 языковых файла:

1. `static/translations/de.json` (немецкий - **обязательно**)
2. `static/translations/en.json` (английский)
3. `static/translations/ru.json` (русский)
4. `static/translations/uk.json` (украинский)

**Важно:** Немецкий язык используется как fallback, поэтому все ключи должны быть переведены на немецкий.

---

## 🧪 Тестирование

Примеры использования находятся в `src/lib/server/email/examples.ts`.

Для локального тестирования:

```bash
# Установите переменные окружения в .env
EMAIL_FROM=Berufsorientierung <noreply@kolibri-dresden.de>
EMAIL_REPLY_TO=Berufsorientierung@kolibri-dresden.de

# Запустите dev сервер
npm run dev
```

---

## 📝 История изменений

### 2025-10-24 - Создание модуля

- ✅ Реализованы 4 основных шаблона
- ✅ Мультиязычность (de, en, ru, uk)
- ✅ Cloudflare Workers совместимость через статические импорты
- ✅ Обновлены переводы для всех языков
- ✅ Примеры использования в `examples.ts`

---

## 🔗 Связанные документы

- [Email Module (index.ts)](./README.md) - Основной модуль отправки email
- [Email Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Общая документация
- [MailChannels Integration](./MAILCHANNELS.md) - Настройка провайдера
- [Translation System](../i18n/SETUP.md) - Система интернационализации

---

## 💡 Best Practices

1. **Всегда используйте `user.preferred_language`** как параметр language
2. **Не забывайте про optional параметры** (telegram_link, whatsapp_link, eventsUrl)
3. **Для продакшена используйте абсолютные URL** из env переменных (например, `PUBLIC_EVENTS_URL`)
4. **Обрабатывайте ошибки** при отправке email (используйте try/catch)
5. **Логируйте успешные отправки** для отладки и мониторинга
6. **Для массовой рассылки** используйте `sendBulkEmails` с батчингом
7. **Длинные ссылки не оборачиваются** - это исключение из правила 80 символов (ссылки лучше не разрывать для корректной работы в email клиентах)

---

**Автор:** Berufsorientierung Development Team  
**Контакт:** Berufsorientierung@kolibri-dresden.de
