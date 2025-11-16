# MailChannels Email Configuration

## Введение

Berufsorientierung использует **MailChannels** как дефолтный провайдер отправки email через
Cloudflare Workers. Отправка идёт по HTTP API, без SMTP.

В этом документе:

- базовая настройка MailChannels (SPF/DKIM/DMARC);
- проверка DNS и логов;
- типичные ошибки (`401`, `400`, `429`);
- краткая схема интеграции **Resend** как альтернативного провайдера.

---

## 1. Базовая схема работы

- SvelteKit работает на Cloudflare Workers.
- Код приложения формирует JSON‑payload и отправляет его на:
  - `https://api.mailchannels.net/tx/v1/send` — если `EMAIL_PROVIDER=mailchannels`;
  - `https://api.resend.com/emails` — если `EMAIL_PROVIDER=resend`.
- Выбор провайдера выполняется в `src/lib/server/email/index.ts` функцией `sendEmail()`,
  которая внутри вызывает `sendEmailViaMailChannels` или `sendEmailViaResend`.

---

## 2. Настройка MailChannels: DNS

### 2.1 SPF

В DNS‑зоне домена `kolibri-dresden.de` должна быть TXT‑запись SPF, которая разрешает
MailChannels отправлять почту от имени домена.

Пример (адаптируйте к своей конфигурации IONOS):

```text
Тип: TXT
Имя: @
Значение: v=spf1 include:_spf-eu.ionos.com include:relay.mailchannels.net ~all
```

Где:

- `include:_spf-eu.ionos.com` — SPF IONOS (входящая/исходящая почта IONOS);
- `include:relay.mailchannels.net` — доверие MailChannels;
- `~all` — soft‑fail для всего остального.

### 2.2 DKIM

MailChannels подписывает письма DKIM при условии, что в DNS есть валидная публичная часть
ключа, а приватный ключ передан в Worker через `DKIM_PRIVATE_KEY`.

1. Сгенерировать ключи (на локальной машине):

   ```bash
   openssl genrsa -out dkim_private.key 2048
   openssl rsa -in dkim_private.key -pubout -out dkim_public.key
   ```

2. Преобразовать публичный ключ в одну строку (без заголовков):

   ```bash
   grep -v "PUBLIC KEY" dkim_public.key | tr -d '\n'
   ```

3. Добавить TXT‑запись в DNS:

   ```text
   Тип: TXT
   Имя: mailchannels._domainkey
   Значение: v=DKIM1; k=rsa; p=MIIBIjANBgkq...   # значение p=... из шага 2
   ```

4. Приватный ключ положить в секрет `DKIM_PRIVATE_KEY` (см. раздел 3.2).

### 2.3 DMARC

DMARC помогает контролировать, как принимающие сервера обрабатывают письма от домена.

Пример базовой записи (режим `p=none` — только отчёты, без жёсткого блокирования):

```text
Тип: TXT
Имя: _dmarc
Значение: v=DMARC1; p=none; rua=mailto:postmaster@kolibri-dresden.de
```

Важно: для домена должна быть **ровно одна** TXT‑запись `_dmarc`.

---

## 3. Настройка MailChannels: Worker и секреты

### 3.1 `wrangler.toml`

Файл `wrangler.toml` уже содержит базовые переменные:

```toml
[vars]
EMAIL_PROVIDER = "mailchannels"
EMAIL_FROM = "Berufsorientierung <Berufsorientierung@kolibri-dresden.de>"
EMAIL_REPLY_TO = "Berufsorientierung <Berufsorientierung@kolibri-dresden.de>"
EMAIL_BULK_CHUNK = "50"
EMAIL_BULK_PAUSE_MS = "60000"
```

### 3.2 Секреты MailChannels (DKIM и др.)

В production‑окружении приватные ключи и секреты задаются через `wrangler secret`:

```bash
wrangler secret put DKIM_DOMAIN        # kolibri-dresden.de
wrangler secret put DKIM_SELECTOR      # mailchannels
wrangler secret put DKIM_PRIVATE_KEY   # содержимое dkim_private.key (BEGIN/END, \n)

wrangler secret put JWT_SECRET
wrangler secret put SETUP_TOKEN
wrangler secret put CRON_SECRET
```

В рантайме код читает их через `platform.env.DKIM_DOMAIN`, `DKIM_SELECTOR`, `DKIM_PRIVATE_KEY`.

---

## 4. Проверка DNS (локальный скрипт)

В репозитории есть скрипт `scripts/check-dns.mjs`, который помогает проверить SPF/DKIM/DMARC.

Пример использования:

```bash
node scripts/check-dns.mjs kolibri-dresden.de mailchannels
```

Скрипт:

- проверяет наличие TXT‑записей SPF, DKIM и DMARC;
- проверяет, что DKIM‑ключ похож на валидный (`p=...` достаточной длины);
- выводит подсказки, если чего‑то не хватает.

---

## 5. Тестовый endpoint `/api/dev/test-email`

Для проверки отправки email без UI есть endpoint:

- `POST /api/dev/test-email`
- защищён заголовком `X-Setup-Token` (значение — `SETUP_TOKEN` из env).

Тело запроса:

```json
{
  "to": "you@example.com",
  "subject": "Test email",
  "text": "Hello from Berufsorientierung!"
}
```

В логах (`wrangler tail`) можно увидеть:

```text
[Test Email] Sending test email: { to, subject, provider: 'mailchannels' }
[Email] DKIM configured: { ... }
[Email] Successfully sent to: you@example.com
```

Если `EMAIL_PROVIDER=resend`, в логах будет `provider: 'resend'`.

---

## 6. Troubleshooting MailChannels

### 6.1 401 Unauthorized от MailChannels

Причины:

- запрос выполняется **не** из Cloudflare Workers (локальный dev без `--remote`);
- домен отправителя не принадлежит Cloudflare‑аккаунту (для встроенной интеграции);
- серьёзные проблемы на стороне MailChannels.

Действия:

- убедиться, что тест идёт через `wrangler deploy` или `wrangler dev --remote`;
- проверить SPF/DKIM/DMARC;
- проверить логи через `wrangler tail`.

### 6.2 400 Bad Request

Чаще всего проблема в payload:

- неверный формат email‑адреса;
- пустой `subject` или `text`;
- некорректный DKIM‑ключ (обрезан, содержит лишние переносы и т.п.).

Смотрите подробный ответ тела (`body`) в логе `[Email] MailChannels error`.

### 6.3 429 Rate Limit

MailChannels может ограничивать скорость отправки bulk‑писем.

Меры:

- уменьшить `EMAIL_BULK_CHUNK` (например, до 50);
- увеличить `EMAIL_BULK_PAUSE_MS` (например, до 60000–90000 мс);
- при необходимости реализовать очередь и backoff (см. план в общем email‑дизайне).

---

## 7. Альтернативные провайдеры

Код приложения поддерживает переключение провайдера через `EMAIL_PROVIDER`:

- `mailchannels` — дефолтный режим (через Cloudflare Workers → MailChannels);
- `resend` — отправка через Resend HTTP API.

В будущем можно добавить SendGrid/Postmark/Amazon SES через дополнительные функции
`sendEmailVia[Provider]` в `src/lib/server/email/index.ts`.

---

## 8. Интеграция Resend (кратко)

### 8.1 Зачем Resend

Resend — современный email‑провайдер с простым HTTP API и хорошей доставляемостью.
В проекте он используется как альтернатива MailChannels, не требующая переноса DNS
зоны на Cloudflare.

### 8.2 Шаги настройки Resend

1. **Регистрация и домен**

   - Зарегистрироваться на <https://resend.com>.
   - В Dashboard → **Domains** добавить `kolibri-dresden.de`.
   - Resend покажет список DNS‑записей для домена.

2. **DNS на IONOS**

   Важно: всегда копируйте значения **из Dashboard Resend**, а не из этого документа.

   Для текущей конфигурации используются:

   - TXT для верификации домена (DKIM):

     ```text
     Тип: TXT
     Имя: resend._domainkey
     Значение: p=MI...   # длинная строка p=..., берётся из Resend
     ```

   - MX и SPF для поддомена отправки, например `send.kolibri-dresden.de`:

     ```text
     # MX для send.kolibri-dresden.de
     Тип:  MX
     Имя:  send
     Значение: feedback-smtp.eu-west-1....resend.com
     Приоритет: 10

     # SPF только для поддомена send
     Тип:  TXT
     Имя:  send
     Значение: v=spf1 include:amazonses.com ~all
     ```

     При этом:

     - существующие `MX @` для основной почты IONOS **не изменяются**;
     - SPF для `@` может оставаться своим (IONOS + MailChannels);
       Resend использует SPF именно для поддомена `send`.

   - DMARC:

     Если для домена уже есть `_dmarc`, вторую запись создавать нельзя.
     Используйте уже существующую (в проекте — `p=none; rua=mailto:postmaster@kolibri-dresden.de`).

3. **API key**

   - В Dashboard → **API Keys** создать ключ с правами *Sending access*.
   - Сразу сохранить значение (`re_xxxxxxxxxxxxxxxxxxxxxxxxxx`) в менеджер паролей.

4. **Переменные окружения**

   В `.env.example` указаны примеры:

   ```bash
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   В production‑окружении Cloudflare:

   ```bash
   # wrangler.toml
   [vars]
   EMAIL_PROVIDER = "resend"

   # secrets
   wrangler secret put RESEND_API_KEY
   ```

5. **Проверка**

   - Подождать 15–30 минут после изменения DNS (propagation).
   - В Resend Dashboard убедиться, что домен **Verified** и **Sending enabled**.
   - Вызвать `/api/dev/test-email` с заголовком `X-Setup-Token` и проверить,
     что письмо приходит, а в логах видно `[Email][Resend] Successfully sent to: ...`.

---

## 9. Итоги

- MailChannels остаётся основным провайдером, если `EMAIL_PROVIDER=mailchannels`.
- Resend может быть включён одной переменной `EMAIL_PROVIDER=resend` и требует
  только DNS‑записей на IONOS и одного API‑ключа.
- Выбор провайдера и логика отправки централизованы в
  `src/lib/server/email/index.ts`.

