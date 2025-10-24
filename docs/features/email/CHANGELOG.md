# Email Module Changelog

История изменений модуля отправки email.

---

## [1.0.1] - 2025-10-24 (Hotfix)

### 🔧 Изменено

#### Консервативные дефолты для батчинга

- **EMAIL_BULK_CHUNK** изменён с 100 на **50** (безопаснее для нового домена)
- **EMAIL_BULK_PAUSE_MS** изменён с 1500ms на **60000ms (1 минута)** (избегаем blacklist)

**Причина:** Агрессивная рассылка может привести к блокировке домена. Консервативные значения обеспечивают максимальную надёжность для домена без установленной репутации.

#### Улучшена документация

- ✅ Добавлено пояснение **почему env - обязательный параметр** (Workers best practice)
- ✅ Обновлены примеры с правильными значениями батчинга
- ✅ Исправлена SPF рекомендация в README.md (теперь `include:relay.mailchannels.net`)
- ✅ Добавлены расчёты времени для массовых рассылок
- ✅ Улучшен раздел troubleshooting с акцентом на безопасность

#### Сигнатура функций

- **sendEmail(to, subject, text, env)** - env параметр обязателен
- **sendBulkEmails(recipients, subject, text, env)** - env параметр обязателен, возвращает `{ success, failed, errors }`

**Отличие от изначальной спецификации:**

- Добавлен `env` параметр (Workers best practice)
- `sendBulkEmails` возвращает дополнительное поле `errors: string[]` для детальной отладки

---

## [1.0.0] - 2025-10-24

### ✅ Добавлено

#### Email Transport (`src/lib/server/email/index.ts`)

- **sendEmail()** - Отправка одиночных писем через MailChannels HTTP API
- **sendBulkEmails()** - Массовая отправка с батчингом
- **DKIM подпись** - Автоматическая подпись писем при наличии конфигурации
- **Батчинг** - Разбиение массовых рассылок на чанки с паузами
- **Логирование** - Детальное логирование успехов/ошибок
- **Обработка ошибок** - Graceful обработка без блокировки бизнес-логики

#### Environment Variables

- `EMAIL_PROVIDER` - Провайдер email (mailchannels)
- `EMAIL_FROM` - Адрес отправителя
- `EMAIL_REPLY_TO` - Reply-To адрес (опционально)
- `EMAIL_BULK_CHUNK` - Размер батча для массовых рассылок (default: 50)
- `EMAIL_BULK_PAUSE_MS` - Пауза между батчами в мс (default: 60000)
- `DKIM_DOMAIN` - Домен для DKIM подписи (опционально)
- `DKIM_SELECTOR` - DKIM selector (опционально)
- `DKIM_PRIVATE_KEY` - Приватный ключ DKIM (опционально)

#### Документация

- **README.md** - Основная документация модуля
- **MAILCHANNELS.md** - Детальная инструкция по настройке MailChannels, DNS (SPF/DKIM/DMARC), troubleshooting

### 🔧 Технические детали

**Провайдер:** MailChannels (https://api.mailchannels.net/tx/v1/send)

**Особенности реализации:**

- Plain text emails (без HTML)
- Поддержка формата "Name <email@example.com>"
- Параллельная отправка в рамках одного батча
- Паузы между батчами для соблюдения rate limits
- Детальная статистика отправок (success/failed/errors)

**Безопасность:**

- DKIM подпись для защиты от спуфинга
- Валидация email адресов
- Логирование всех операций
- Secrets для хранения приватного ключа

---

## [1.1.2] - 2025-10-24 (Улучшения)

### 🔧 Улучшено

#### Консистентность переводов

- ✅ Добавлен ключ `email.eventCancellation.date` во все 4 языка
- Ранее использовался `email.eventRegistration.date` (работало, но не консистентно)
- Теперь каждая секция имеет собственный полный набор ключей

#### Документация для продакшена

- ✅ Добавлена рекомендация использовать `PUBLIC_EVENTS_URL` из env
- ✅ Обновлён JSDoc комментарий в `getEventCancelledByAdminEmail()`
- ✅ Добавлены примеры использования для продакшена и разработки в TEMPLATES.md

**Рекомендация для продакшена:**

```typescript
const eventsUrl = platform.env.PUBLIC_EVENTS_URL || 'https://example.com/events';
const { subject, text } = getEventCancelledByAdminEmail(user, event, reason, language, eventsUrl);
```

Использование абсолютного URL из env избегает зависимости от базового пути и гарантирует корректные ссылки в email.

---

## [1.1.1] - 2025-10-24 (Hotfix)

### 🐛 Исправлено

#### Полная мультиязычность шаблонов

**Проблема:** В первоначальной версии 1.1.0 часть текстов в шаблонах была захардкожена на немецком языке вместо использования переводов из JSON.

**Исправлено:**

1. **getWelcomeEmail()** - все тексты теперь берутся из `email.welcome.*`:
   - `intro`, `howItWorks`, `nextSteps`, `step1`, `step2`, `step3`, `closing`

2. **getEventRegistrationEmail()** - все лейблы из `email.eventRegistration.*`:
   - `confirmed`, `date`, `location`, `description`, `requirements`
   - `stayInTouch`, `telegram`, `whatsapp`, `cancellation`, `cancellationInfo`

3. **getEventCancellationEmail()** - все тексты из `email.eventCancellation.*`:
   - `cancelled`, `reregister`, `seeYouSoon`

4. **getEventCancelledByAdminEmail()** - все тексты из `email.eventCancelledByAdmin.*`:
   - `notification`, `reason`, `apology`, `checkWebsite`
   - ✅ Добавлен параметр `eventsUrl?: string` (default: `/events`)
   - ✅ Явная ссылка на страницу с предстоящими мероприятиями в письме

**Обработка длинных ссылок:**

- Ссылки (Telegram/WhatsApp/Events URL) **не оборачиваются** функцией `wrapText()`
- Это исключение из правила "80 символов на строку"
- Причина: разрыв ссылок может нарушить их работу в email клиентах

**Результат:** Теперь **весь контент** писем полностью мультиязычен и корректно отображается на всех 4 языках (de, en, ru, uk).

---

## [1.1.0] - 2025-10-24

### ✅ Добавлено

#### Email Templates (`src/lib/server/email/templates.ts`)

- **getWelcomeEmail()** - Приветственное письмо при регистрации
- **getEventRegistrationEmail()** - Подтверждение записи на мероприятие
- **getEventCancellationEmail()** - Подтверждение отмены записи пользователем
- **getEventCancelledByAdminEmail()** - Уведомление об отмене мероприятия администратором

**Особенности:**

- ✅ Полная мультиязычность (de, en, ru, uk)
- ✅ Автоматический fallback на немецкий язык
- ✅ Текстовые шаблоны (plain text, 80 символов на строку)
- ✅ Cloudflare Workers совместимость (статические импорты)
- ✅ Динамическая подстановка данных пользователя/мероприятия
- ✅ Форматирование дат (DD.MM.YYYY)
- ✅ Обработка мультиязычных полей событий с fallback

#### Вспомогательные функции

- `loadTranslations(language)` - Загрузка переводов из JSON
- `translate(translations, path, params)` - Получение перевода по пути с параметрами
- `getEventField(event, field, language)` - Получение мультиязычного поля события
- `formatDate(dateString, language)` - Форматирование даты
- `wrapText(text, maxLength, indent)` - Разбивка текста на строки

#### Обновлённые переводы

Добавлены расширенные ключи в `static/translations/*.json`:

```json
"email": {
  "welcome": { ... },
  "eventRegistration": { ... },
  "eventCancellation": { ... },
  "eventCancelledByAdmin": { ... }
}
```

Все ключи переведены для 4 языков (de, en, ru, uk).

#### Обновлённые примеры (`examples.ts`)

- Интеграция с новыми шаблонами
- Демонстрация использования в API routes
- Правильная передача языка и параметров

#### Документация

- **[TEMPLATES.md](./TEMPLATES.md)** - Полная документация email шаблонов с примерами

### 🔧 Технические детали

**Cloudflare Workers совместимость:**

Вместо `fs.readFileSync()` используются статические импорты:

```typescript
import translationsDe from '../../../../static/translations/de.json';
```

Это работает благодаря встроенному JSON loader в Vite/SvelteKit и совместимо с Cloudflare Workers.

**Архитектура:**

```
templates.ts
├── Статические импорты переводов (de, en, ru, uk)
├── loadTranslations() - Получение переводов из карты
├── translate() - Получение перевода по пути с параметрами
├── getEventField() - Мультиязычные поля с fallback
├── formatDate() - DD.MM.YYYY
├── wrapText() - 80 символов на строку
└── 4 функции-шаблона (getWelcomeEmail, etc.)
```

---

## Планы на будущее

### [1.2.0] - Планируется

- [ ] HTML email support (с текстовым fallback)
- [ ] Email attachments (PDF с QR-кодами)
- [ ] Retry механизм при ошибках отправки
- [ ] Email queue для асинхронной обработки (Cloudflare Queues)

### [1.3.0] - Планируется

- [ ] Поддержка альтернативных провайдеров (Resend, SendGrid, Postmark)
- [ ] Email tracking (открытия, клики)
- [ ] Unsubscribe механизм для массовых рассылок
- [ ] A/B testing для subject lines
- [ ] Newsletter шаблон с переменными блоками

---

## Обоснование архитектурных решений

### Почему env - обязательный параметр?

**Изначальная спецификация промпта:**

```typescript
sendEmail(to, subject, text): Promise<void>
```

**Реализованная сигнатура:**

```typescript
sendEmail(to, subject, text, env): Promise<void>
```

**Причина отклонения от спецификации:**

В Cloudflare Workers **нет глобального `process.env`**. Environment variables доступны только через `platform.env` в контексте запроса. Явная передача `env`:

1. **Следует Workers best practices** - рекомендация Cloudflare
2. **Делает функции чистыми** - нет скрытых зависимостей
3. **Улучшает тестируемость** - легко передать mock env
4. **Обеспечивает type safety** - TypeScript знает точный тип
5. **Портируемость** - работает в любом Workers окружении

Это стандартный паттерн для всех серверных модулей в проекте (auth, db, email).

### Почему sendBulkEmails возвращает errors[]?

**Изначальная спецификация:**

```typescript
{
	success: number;
	failed: number;
}
```

**Реализация:**

```typescript
{ success: number; failed: number; errors: string[] }
```

**Причина:** В продакшене критически важно знать **какие именно адреса** и **почему** не получили письма. Поле `errors` позволяет:

- Логировать проблемные адреса
- Повторно отправить только на failed адреса
- Диагностировать проблемы с доменами/провайдерами
- Мониторить качество email базы

Минимальная стоимость (array strings) vs большая польза для операций.

---

**Версия:** 1.0.1  
**Дата:** 2025-10-24  
**Автор:** Berufsorientierung Development Team
