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

## Планы на будущее

### [1.1.0] - Планируется

- [ ] Email шаблоны (Welcome, Event Registration, etc.)
- [ ] HTML email support
- [ ] Email attachments (PDF с QR-кодами)
- [ ] Retry механизм при ошибках отправки
- [ ] Email queue для асинхронной обработки (Cloudflare Queues)

### [1.2.0] - Планируется

- [ ] Поддержка альтернативных провайдеров (Resend, SendGrid, Postmark)
- [ ] Email tracking (открытия, клики)
- [ ] Unsubscribe механизм для массовых рассылок
- [ ] A/B testing для subject lines

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
