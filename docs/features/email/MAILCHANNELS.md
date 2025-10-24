# MailChannels Email Configuration

## Обзор

Berufsorientierung использует **MailChannels** для отправки email через Cloudflare Workers.

**Преимущества:**

- ✅ Бесплатная отправка из Workers
- ✅ HTTP API (без SMTP)
- ✅ Поддержка DKIM подписи
- ✅ Высокая deliverability при правильной настройке DNS

---

## 1. Настройка DNS записей

Для максимальной deliverability email необходимо настроить **SPF**, **DKIM** и **DMARC** записи в DNS домена.

### 📋 Требуемые DNS записи для домена `kolibri-dresden.de`

#### 1.1 SPF (Sender Policy Framework)

**Тип:** TXT  
**Имя:** `@` (или `kolibri-dresden.de`)  
**Значение:**

```
v=spf1 a mx include:relay.mailchannels.net ~all
```

**Что это делает:**

- Разрешает MailChannels отправлять письма от имени домена
- `~all` = soft fail (письма проходят, но могут попасть в спам без других мер)

---

#### 1.2 DKIM (DomainKeys Identified Mail)

**Шаг 1: Генерация ключей**

Используйте OpenSSL для генерации приватного ключа:

```bash
# Генерация приватного ключа (2048 бит)
openssl genrsa -out dkim_private.key 2048

# Извлечение публичного ключа
openssl rsa -in dkim_private.key -pubout -out dkim_public.key
```

**Шаг 2: Форматирование публичного ключа для DNS**

```bash
# Удалить заголовки и переносы строк
grep -v "PUBLIC KEY" dkim_public.key | tr -d '\n'
```

Результат будет выглядеть примерно так:

```
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...остальная часть ключа...
```

**Шаг 3: Создание DNS записи**

**Тип:** TXT  
**Имя:** `mailchannels._domainkey` (selector = `mailchannels`)  
**Значение:**

```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...ваш_публичный_ключ...
```

**Примечание:** Некоторые DNS провайдеры требуют заключать значение в кавычки.

**Шаг 4: Добавление приватного ключа в .env**

Скопируйте содержимое `dkim_private.key` (включая `-----BEGIN PRIVATE KEY-----` и `-----END PRIVATE KEY-----`) и добавьте в `.env`:

```bash
DKIM_DOMAIN=kolibri-dresden.de
DKIM_SELECTOR=mailchannels
DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
...ваш_приватный_ключ...
-----END PRIVATE KEY-----"
```

⚠️ **ВАЖНО:**

- Используйте двойные кавычки для многострочного значения
- Замените `\n` на реальные переносы строк или оставьте как есть (оба варианта работают)
- **НЕ КОММИТЬТЕ** `.env` файл в Git!

---

#### 1.3 DMARC (Domain-based Message Authentication)

**Тип:** TXT  
**Имя:** `_dmarc`  
**Значение:**

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@kolibri-dresden.de; ruf=mailto:dmarc@kolibri-dresden.de; fo=1
```

**Параметры:**

- `p=quarantine` - письма без DKIM/SPF попадают в карантин (spam)
- `p=reject` - (более строгая политика) письма отклоняются полностью
- `rua` - email для агрегированных отчётов
- `ruf` - email для forensic отчётов
- `fo=1` - генерировать отчёты при любом сбое проверки

**Рекомендация:** Начните с `p=none` для мониторинга, затем перейдите на `p=quarantine` или `p=reject`.

---

## 2. Проверка настройки DNS

### 2.1 Онлайн инструменты

- **SPF проверка:** https://mxtoolbox.com/spf.aspx
- **DKIM проверка:** https://mxtoolbox.com/dkim.aspx
- **DMARC проверка:** https://mxtoolbox.com/dmarc.aspx
- **Общая проверка:** https://www.mail-tester.com/

### 2.2 Командная строка (Linux/Mac)

```bash
# Проверка SPF
dig TXT kolibri-dresden.de +short

# Проверка DKIM
dig TXT mailchannels._domainkey.kolibri-dresden.de +short

# Проверка DMARC
dig TXT _dmarc.kolibri-dresden.de +short
```

### 2.3 Windows PowerShell

```powershell
# Проверка SPF
Resolve-DnsName -Name kolibri-dresden.de -Type TXT

# Проверка DKIM
Resolve-DnsName -Name mailchannels._domainkey.kolibri-dresden.de -Type TXT

# Проверка DMARC
Resolve-DnsName -Name _dmarc.kolibri-dresden.de -Type TXT
```

---

## 3. Настройка Environment Variables

### 3.1 Почему env - обязательный параметр?

В отличие от Node.js, где есть глобальный `process.env`, **Cloudflare Workers** предоставляет environment variables через контекст запроса (`platform.env` в SvelteKit).

**Преимущества явной передачи env:**

- ✅ **Чистые функции** - нет скрытых зависимостей от глобального состояния
- ✅ **Тестируемость** - легко передать mock env в unit-тестах
- ✅ **Портируемость** - работает в любом Workers окружении
- ✅ **Type Safety** - TypeScript знает точный тип env
- ✅ **Workers Best Practice** - рекомендованный подход Cloudflare

**Пример использования:**

```typescript
import { sendEmail } from '$lib/server/email';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ platform }: RequestEvent) {
	// platform.env доступен только в контексте запроса
	await sendEmail(
		'user@example.com',
		'Test',
		'Hello!',
		platform!.env // Явная передача env
	);
}
```

### 3.2 Конфигурация через wrangler.toml

В Cloudflare Workers Dashboard или через `wrangler.toml`:

```toml
[vars]
EMAIL_PROVIDER = "mailchannels"
EMAIL_FROM = "Berufsorientierung <Berufsorientierung@kolibri-dresden.de>"
EMAIL_REPLY_TO = "Berufsorientierung@kolibri-dresden.de"
# Консервативные значения для надёжности
EMAIL_BULK_CHUNK = "50"
EMAIL_BULK_PAUSE_MS = "60000"
DKIM_DOMAIN = "kolibri-dresden.de"
DKIM_SELECTOR = "mailchannels"

# DKIM_PRIVATE_KEY должен быть добавлен через секреты (secrets)
```

**Добавление секрета через Wrangler:**

```bash
# Добавление DKIM приватного ключа как секрет
wrangler secret put DKIM_PRIVATE_KEY

# Вставьте содержимое dkim_private.key (включая заголовки)
```

---

## 4. Тестирование отправки email

### 4.1 Простой тест

Создайте тестовый endpoint или используйте существующий:

```typescript
import { sendEmail } from '$lib/server/email';

// В API route
export async function POST({ platform }) {
	try {
		await sendEmail(
			'your-test-email@example.com',
			'Test Email',
			'This is a test email from Berufsorientierung',
			platform!.env
		);

		return json({ success: true });
	} catch (error) {
		console.error(error);
		return json({ success: false, error: String(error) }, { status: 500 });
	}
}
```

### 4.2 Проверка deliverability

Отправьте тестовое письмо на:

- https://www.mail-tester.com/ (получите временный адрес)
- Ваш личный email

**Что проверяет mail-tester:**

- ✅ SPF alignment
- ✅ DKIM signature
- ✅ DMARC policy
- ✅ Spam score
- ✅ Blacklist status

**Целевой балл:** 10/10

---

## 5. Решение проблем (Troubleshooting)

### 5.1 Письма не доходят

**Проблема:** Email не приходит в inbox

**Решения:**

1. Проверьте папку Spam/Junk
2. Проверьте DNS записи (SPF, DKIM, DMARC)
3. Проверьте логи Cloudflare Workers
4. Используйте mail-tester.com для диагностики
5. Убедитесь, что домен не в blacklist: https://mxtoolbox.com/blacklists.aspx

### 5.2 DKIM signature не проходит проверку

**Проблема:** DKIM verification failed

**Решения:**

1. Убедитесь, что публичный ключ в DNS корректный (без пробелов/переносов)
2. Проверьте, что selector в DNS и в `.env` совпадают (`mailchannels`)
3. Убедитесь, что приватный ключ в `.env` содержит заголовки `-----BEGIN/END-----`
4. Подождите 24-48 часов после изменения DNS (TTL propagation)

### 5.3 MailChannels API ошибки

**Ошибка 401 Unauthorized:**

- MailChannels не требует API ключа для Workers
- Убедитесь, что отправка идёт именно из Cloudflare Workers environment

**Ошибка 400 Bad Request:**

- Проверьте формат payload (см. `src/lib/server/email/index.ts`)
- Убедитесь, что email адреса валидны

**Ошибка 429 Rate Limit:**

- Уменьшите `EMAIL_BULK_CHUNK`
- Увеличьте `EMAIL_BULK_PAUSE_MS`

### 5.4 Массовая рассылка слишком медленная

**⚠️ ВАЖНО:** Медленная рассылка - это **фича, а не баг**! Консервативные настройки (50 писем с паузой 1 минута) предотвращают попадание в blacklist.

**Если всё же нужно ускорить:**

- Увеличьте `EMAIL_BULK_CHUNK` до 100-150 (осторожно!)
- Уменьшите `EMAIL_BULK_PAUSE_MS` до 30000-45000ms (не менее 30 секунд!)
- ❌ **НЕ уменьшайте** паузу ниже 30 секунд - риск блокировки
- Рассмотрите использование Cloudflare Queues для асинхронной обработки

**Пример расчёта времени:**

```
1000 получателей с настройками по умолчанию (50/60000):
- 20 батчей × 60 секунд = ~20 минут
- Это НОРМАЛЬНО для массовой рассылки!
```

**💡 Рекомендация:** Запускайте массовые рассылки через Cron Job в ночное время, когда скорость не критична.

---

## 6. Дополнительные настройки

### 6.1 Reply-To адрес

Если хотите получать ответы на отдельный адрес:

```bash
EMAIL_REPLY_TO=support@kolibri-dresden.de
```

### 6.2 Мультидоменная отправка

Если нужно отправлять с разных доменов:

1. Настройте SPF/DKIM для каждого домена
2. Создайте отдельные DKIM ключи для каждого домена
3. В функции `sendEmail()` передавайте разные конфигурации

---

## 7. Безопасность

### 7.1 Защита DKIM приватного ключа

- ❌ **НЕ коммитьте** `.env` файл в Git
- ❌ **НЕ храните** приватный ключ в открытом виде
- ✅ Используйте Cloudflare Workers Secrets для продакшена
- ✅ Добавьте `.env` в `.gitignore`

### 7.2 Rate Limiting

MailChannels не публикует чёткие лимиты, но рекомендуется:

- **50 писем на батч** (консервативно и безопасно)
- **Пауза 1 минута** между батчами (минимум 30 секунд)
- Мониторинг ошибок 429 (Too Many Requests)

**Почему такие консервативные лимиты?**

- Новый домен без репутации требует осторожности
- Агрессивная рассылка может привести к блокировке домена
- Email провайдеры (Gmail, Outlook) мониторят паттерны спама
- Лучше медленно, но стабильно, чем быстро и в blacklist

---

## 8. Мониторинг и логирование

### 8.1 Cloudflare Workers Logs

Просмотр логов в реальном времени:

```bash
wrangler tail
```

### 8.2 DMARC отчёты

Регулярно проверяйте DMARC отчёты на `rua` адресе для:

- Обнаружения фишинга/спуфинга
- Мониторинга deliverability
- Выявления проблем с настройкой

### 8.3 Application Logs

Все отправки логируются в консоль:

```
[Email] Successfully sent to: user@example.com
[Email Bulk] Starting bulk send: { totalRecipients: 150, chunkSize: 100 }
[Email Bulk] Chunk 1/2 completed: { success: 98, failed: 2 }
```

---

## 9. Альтернативные провайдеры

Если MailChannels не подходит, можно использовать:

- **Resend** (https://resend.com) - современный API, хорошая deliverability
- **SendGrid** (https://sendgrid.com) - популярный сервис, бесплатный тариф 100 писем/день
- **Postmark** (https://postmarkapp.com) - специализируется на transactional emails

**Для переключения провайдера:**

1. Обновите `EMAIL_PROVIDER` в `.env`
2. Реализуйте адаптер в `src/lib/server/email/index.ts`

---

## 10. Полезные ссылки

- **MailChannels Docs:** https://mailchannels.zendesk.com/hc/en-us
- **Cloudflare Workers Email:** https://developers.cloudflare.com/workers/runtime-apis/email/
- **SPF проверка:** https://www.spf-record.com/
- **DKIM проверка:** https://dkimcore.org/tools/
- **DMARC проверка:** https://dmarc.org/resources/deployment-tools/

---

## Changelog

**2025-10-24:**

- ✅ Создана документация по настройке MailChannels
- ✅ Добавлены инструкции по SPF, DKIM, DMARC
- ✅ Описаны процедуры проверки и troubleshooting
