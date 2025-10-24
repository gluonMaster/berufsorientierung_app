# Email Module Documentation

## Обзор

Модуль email отвечает за отправку уведомлений пользователям через MailChannels HTTP API.

**Расположение кода:** `src/lib/server/email/`

---

## 📂 Структура документации

- **[README.md](./README.md)** - Основная документация модуля (вы здесь)
- **[MAILCHANNELS.md](./MAILCHANNELS.md)** - Настройка MailChannels, DNS (SPF/DKIM/DMARC), troubleshooting
- **[DEVIATIONS.md](./DEVIATIONS.md)** - Отклонения от изначальной спецификации и их обоснование
- **[CHANGELOG.md](./CHANGELOG.md)** - История изменений модуля
- **[TEMPLATES.md](./TEMPLATES.md)** - Email шаблоны (Welcome, Event Registration, etc.) _(будет создан позже)_

---

## Основные функции

### `sendEmail(to, subject, text, env)`

Отправка одиночного email.

**Параметры:**

- `to` (string) - Email получателя
- `subject` (string) - Тема письма
- `text` (string) - Текст письма (plain text)
- `env` (App.Platform['env']) - Environment variables (обязательный параметр)

**⚠️ Почему env - обязательный параметр?**

В Cloudflare Workers нет глобального `process.env`. Environment variables доступны только через `platform.env` в контексте запроса. Явная передача `env` делает функцию:

- ✅ **Чистой** - нет скрытых зависимостей от глобального состояния
- ✅ **Тестируемой** - можно передать mock env в unit-тестах
- ✅ **Портируемой** - работает в любом Workers окружении

Это **best practice** для Cloudflare Workers и SvelteKit on Cloudflare.

**Пример:**

```typescript
import { sendEmail } from '$lib/server/email';

// В API route
export async function POST({ platform }: RequestEvent) {
	await sendEmail(
		'user@example.com',
		'Welcome to Berufsorientierung',
		'Thank you for registering!',
		platform!.env
	);

	return json({ success: true });
}
```

---

### `sendBulkEmails(recipients, subject, text, env)`

Массовая отправка с батчингом.

**Параметры:**

- `recipients` (string[]) - Массив email адресов
- `subject` (string) - Тема письма
- `text` (string) - Текст письма
- `env` (App.Platform['env']) - Environment variables (обязательный параметр)

**Возвращает:**

```typescript
{
	success: number;  // Количество успешных отправок
	failed: number;   // Количество неудачных
	errors: string[]; // Список ошибок с деталями
}
```

**⚠️ ВАЖНО:** Функция возвращает детальную статистику включая массив `errors`, что отличается от минималистичной спецификации промпта. Это сделано для лучшей отладки и мониторинга в продакшене.

**Пример:**

```typescript
import { sendBulkEmails } from '$lib/server/email';

// В API route
export async function POST({ platform }: RequestEvent) {
	const result = await sendBulkEmails(
		['user1@example.com', 'user2@example.com', 'user3@example.com'],
		'Newsletter',
		'Hello everyone!',
		platform!.env
	);

	console.log(`Sent: ${result.success}, Failed: ${result.failed}`);

	if (result.errors.length > 0) {
		console.error('Errors:', result.errors);
	}

	return json({
		success: result.failed === 0,
		stats: result,
	});
}
```

---

## Environment Variables

**Обязательные:**

```bash
EMAIL_PROVIDER=mailchannels
EMAIL_FROM=Berufsorientierung <Berufsorientierung@kolibri-dresden.de>
```

**Опциональные (для батчинга):**

```bash
EMAIL_BULK_CHUNK=50            # Размер батча (по умолчанию 50)
EMAIL_BULK_PAUSE_MS=60000      # Пауза между батчами в мс (по умолчанию 60000 = 1 мин)
EMAIL_REPLY_TO=                # Reply-To адрес (опционально)
```

**💡 Рекомендация:** Используйте консервативные значения (50 писем с паузой 1 минута) для максимальной надёжности и избежания попадания в blacklist. Это особенно важно для нового домена без установленной репутации.

**DKIM (опционально, но рекомендуется):**

```bash
DKIM_DOMAIN=kolibri-dresden.de
DKIM_SELECTOR=mailchannels
DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

---

## Особенности реализации

### 1. DKIM Подпись

Если настроены `DKIM_DOMAIN`, `DKIM_SELECTOR` и `DKIM_PRIVATE_KEY`, письма автоматически подписываются DKIM.

**Преимущества:**

- ✅ Повышенная deliverability
- ✅ Защита от спуфинга
- ✅ Лучший reputation домена

### 2. Батчинг массовых рассылок

При массовой отправке письма группируются в батчи (чанки) для:

- Предотвращения превышения лимитов API
- Снижения нагрузки на систему
- Избежания блокировок за spam

**Алгоритм:**

1. Разбить массив получателей на чанки по `EMAIL_BULK_CHUNK` (default: 50)
2. Отправить все письма в чанке параллельно (`Promise.all`)
3. Сделать паузу `EMAIL_BULK_PAUSE_MS` (default: 60000ms = 1 мин) перед следующим чанком
4. Повторить для всех чанков
5. Вернуть детальную статистику (success/failed/errors)

**Пример батчинга:**

```
500 получателей → 10 батчей по 50 писем → Пауза 1 минута между батчами
Общее время: ~10 минут (для 500 адресов)
```

### 3. Обработка ошибок

- Ошибки отправки **не блокируют** основную бизнес-логику
- Все ошибки логируются в консоль
- `sendBulkEmails` возвращает детальную статистику успехов/неудач

---

## Типы email в приложении

1. **Welcome Email** - при регистрации пользователя
2. **Event Registration Confirmation** - при записи на мероприятие
3. **Event Cancellation by User** - при отмене записи пользователем
4. **Event Cancelled by Admin** - при отмене мероприятия администратором
5. **Bulk Newsletter** - массовая рассылка через админ-панель

_(Шаблоны будут реализованы в следующем промпте)_

---

## Quick Start

### 1. Настройте DNS

Следуйте инструкциям в [MAILCHANNELS.md](./MAILCHANNELS.md) для настройки SPF, DKIM, DMARC.

### 2. Добавьте Environment Variables

```bash
# В .env или через Cloudflare Dashboard
EMAIL_FROM=Berufsorientierung <Berufsorientierung@kolibri-dresden.de>
DKIM_DOMAIN=kolibri-dresden.de
DKIM_SELECTOR=mailchannels

# Добавьте DKIM_PRIVATE_KEY через wrangler secrets
wrangler secret put DKIM_PRIVATE_KEY
```

### 3. Используйте в коде

```typescript
import { sendEmail } from '$lib/server/email';

export async function POST({ request, platform }: RequestEvent) {
	// ... ваша логика ...

	await sendEmail(
		user.email,
		'Welcome!',
		'Thank you for joining Berufsorientierung!',
		platform!.env
	);

	return json({ success: true });
}
```

---

## Безопасность

### ✅ DO

- Используйте Cloudflare Secrets для `DKIM_PRIVATE_KEY`
- Валидируйте email адреса перед отправкой
- Логируйте все отправки для аудита
- Используйте rate limiting для массовых рассылок

### ❌ DON'T

- НЕ коммитьте `.env` файл в Git
- НЕ отправляйте письма без валидации адресов
- НЕ превышайте разумные лимиты отправки (риск blacklist)
- НЕ храните DKIM ключи в открытом виде

---

## Мониторинг

### Логи Cloudflare Workers

```bash
# Просмотр логов в реальном времени
wrangler tail

# Фильтр по email логам
wrangler tail | grep "\[Email\]"
```

### Application Logs

Все email операции логируются:

```
[Email] Successfully sent to: user@example.com
[Email Bulk] Starting bulk send: { totalRecipients: 150 }
[Email Bulk] Processing chunk 1/2 (100 emails)
[Email Bulk] Chunk 1/2 completed: { success: 98, failed: 2 }
[Email Bulk] Pausing for 1500ms before next chunk...
[Email Bulk] Bulk send completed: { total: 150, success: 148, failed: 2 }
```

---

## Troubleshooting

### Письма не доходят

1. Проверьте папку Spam
2. Проверьте DNS записи: https://mxtoolbox.com/
3. Проверьте логи Workers: `wrangler tail`
4. Используйте mail-tester.com для диагностики

### DKIM проблемы

1. Убедитесь, что публичный ключ в DNS корректный
2. Проверьте, что selector совпадает (`mailchannels`)
3. Подождите 24-48 часов после изменения DNS

### MailChannels ошибки

- **401 Unauthorized** - Отправка не из Cloudflare Workers environment
- **400 Bad Request** - Проверьте формат payload
- **429 Rate Limit** - Уменьшите `EMAIL_BULK_CHUNK` или увеличьте `EMAIL_BULK_PAUSE_MS`

Подробнее: [MAILCHANNELS.md](./MAILCHANNELS.md)

---

## Changelog

**2025-10-24:**

- ✅ Создан модуль email (`src/lib/server/email/index.ts`)
- ✅ Реализована отправка через MailChannels HTTP API
- ✅ Добавлена поддержка DKIM подписи
- ✅ Реализован батчинг для массовых рассылок
- ✅ Создана документация по настройке DNS
