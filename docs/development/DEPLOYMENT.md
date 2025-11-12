# 🚀 Deployment Guide - Berufsorientierung App

Полное руководство по развертыванию приложения на **Cloudflare Workers** (с D1, R2, Cron Triggers).

⚠️ **ВАЖНО:** Это деплой как **Workers**, не Pages! SvelteKit использует `@sveltejs/adapter-cloudflare` для генерации Worker entry point.

---

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Шаг 1: Настройка Cloudflare D1 Database](#шаг-1-настройка-cloudflare-d1-database)
3. [Шаг 2: Настройка Cloudflare R2 Storage](#шаг-2-настройка-cloudflare-r2-storage)
4. [Шаг 3: Настройка Email (SPF/DKIM/DMARC)](#шаг-3-настройка-email-spfdkimdmarc)
5. [Шаг 4: Настройка Cloudflare Turnstile](#шаг-4-настройка-cloudflare-turnstile)
6. [Шаг 5: Настройка секретов (Secrets)](#шаг-5-настройка-секретов-secrets)
7. [Шаг 6: Создание первого администратора](#шаг-6-создание-первого-администратора)
8. [Шаг 7: Деплой приложения](#шаг-7-деплой-приложения)
9. [Шаг 8: Настройка Cloudflare Cron Triggers](#шаг-8-настройка-cloudflare-cron-triggers)
10. [Шаг 9: Тестирование после деплоя](#шаг-9-тестирование-после-деплоя)
11. [Troubleshooting](#troubleshooting)
12. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)

---

## Предварительные требования

### Установленное ПО

- **Node.js** 18+ ([скачать](https://nodejs.org/))
- **npm** или **pnpm**
- **Wrangler CLI v4+** (Cloudflare):
  ```bash
  npm install -g wrangler
  ```
  ⚠️ Проект использует Wrangler v4. Проверьте версию: `wrangler --version`
- **Git** ([скачать](https://git-scm.com/))
- **OpenSSL** (для генерации DKIM ключей):
  - Windows: [Win32/Win64 OpenSSL](https://slproweb.com/products/Win32OpenSSL.html)
  - macOS/Linux: обычно предустановлен

### Аккаунты

- **Cloudflare Account** с подключенным доменом
- **Доступ к DNS настройкам** домена `kolibri-dresden.de`

### Cloudflare Plan

- **Free Plan** достаточно для начала:
  - Workers: 100,000 requests/day
  - D1: 5GB storage, 5M rows read/day
  - R2: 10GB storage/month
  - Turnstile: бесплатный тариф (проверьте текущие лимиты в Dashboard)

⚠️ **Примечание:** Квоты могут измениться. Проверяйте актуальные лимиты в [Cloudflare Dashboard](https://dash.cloudflare.com/).

---

## Шаг 1: Настройка Cloudflare D1 Database

### 1.1. Авторизация в Cloudflare

```bash
wrangler login
```

Откроется браузер для авторизации.

### 1.2. Создание D1 базы данных

```bash
wrangler d1 create berufsorientierung-db
```

**Вывод:**

```
✅ Successfully created DB 'berufsorientierung-db'!

[[d1_databases]]
binding = "DB"
database_name = "berufsorientierung-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 1.3. Обновление wrangler.toml

Скопируйте `database_id` из вывода и раскомментируйте/обновите секцию `[[d1_databases]]` в `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"  # ⚠️ ВАЖНО: Биндинг должен быть именно "DB" (код ожидает platform.env.DB)
database_name = "berufsorientierung-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # <-- Ваш database_id
```

⚠️ **Не меняйте `binding = "DB"`!** Весь код приложения обращается к базе через `platform.env.DB`.

### 1.4. Применение миграций

**Миграция 1: Основная схема**

```bash
wrangler d1 execute berufsorientierung-db --remote --file=./migrations/0001_initial.sql
```

**Миграция 2: Обновление max_participants**

```bash
wrangler d1 execute berufsorientierung-db --remote --file=./migrations/0002_make_max_participants_nullable.sql
```

**Проверка:**

```bash
wrangler d1 execute berufsorientierung-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Ожидаемый вывод:**

```
users
events
event_additional_fields
registrations
admins
activity_log
deleted_users_archive
pending_deletions
```

---

## Шаг 2: Настройка Cloudflare R2 Storage

### 2.1. Создание R2 Bucket

**Production bucket:**

```bash
wrangler r2 bucket create berufsorientierung-qr-codes
```

**Preview bucket (для разработки):**

```bash
wrangler r2 bucket create berufsorientierung-qr-codes-preview
```

### 2.2. Включение Public Access

1. Откройте [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Выберите bucket `berufsorientierung-qr-codes`
3. **Settings** → **Public Access**
4. Нажмите **Allow Access**
5. Скопируйте **Public R2.dev URL**: `https://pub-xxxxx.r2.dev`

### 2.3. Обновление wrangler.toml

Секция `[[r2_buckets]]` уже настроена в `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "R2_BUCKET"  # ⚠️ ВАЖНО: Биндинг должен быть именно "R2_BUCKET" (код ожидает platform.env.R2_BUCKET)
bucket_name = "berufsorientierung-qr-codes"
preview_bucket_name = "berufsorientierung-qr-codes-preview"
```

⚠️ **Не меняйте `binding = "R2_BUCKET"`!** Код работы с файлами обращается к `platform.env.R2_BUCKET`.

### 2.4. Сохранение R2 Public URL

Сохраните Public URL для следующего шага (добавление секретов):

```
https://pub-xxxxx.r2.dev
```

⚠️ **ОБЯЗАТЕЛЬНО:** Публичный URL нужен для отображения QR-кодов в email. Он будет добавлен в secrets как `R2_PUBLIC_URL`.

---

## Шаг 3: Настройка Email (SPF/DKIM/DMARC)

⚠️ **ВАЖНО:** Без правильной настройки DNS email будут попадать в спам!

### 📚 Подробная инструкция

Полная пошаговая инструкция с примерами: **[docs/features/email/DEPLOYMENT.md](../features/email/DEPLOYMENT.md)**

### Краткий чек-лист:

#### 3.1. SPF запись

Добавьте TXT запись в DNS:

| Тип | Имя | Значение                                     | TTL  |
| --- | --- | -------------------------------------------- | ---- |
| TXT | @   | `v=spf1 include:relay.mailchannels.net ~all` | 3600 |

⚠️ **Если домен уже используется для корпоративной почты** - ДОПОЛНИТЕ существующую SPF запись:

```
v=spf1 include:_spf.google.com include:relay.mailchannels.net ~all
```

#### 3.2. DKIM ключи

**Генерация:**

```bash
# Приватный ключ
openssl genrsa -out dkim_private.key 2048

# Публичный ключ
openssl rsa -in dkim_private.key -pubout -outform der 2>/dev/null | openssl base64 -A > dkim_public.txt
```

**DNS запись:**

| Тип | Имя                       | Значение                         | TTL  |
| --- | ------------------------- | -------------------------------- | ---- |
| TXT | `mailchannels._domainkey` | `v=DKIM1; k=rsa; p=<PUBLIC_KEY>` | 3600 |

Где `<PUBLIC_KEY>` - содержимое файла `dkim_public.txt`.

#### 3.3. DMARC запись

| Тип | Имя      | Значение                                                | TTL  |
| --- | -------- | ------------------------------------------------------- | ---- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@kolibri-dresden.de` | 3600 |

#### 3.4. Проверка DNS

```bash
# Проверка SPF
nslookup -type=TXT kolibri-dresden.de

# Проверка DKIM
nslookup -type=TXT mailchannels._domainkey.kolibri-dresden.de

# Проверка DMARC
nslookup -type=TXT _dmarc.kolibri-dresden.de
```

Или используйте: https://mxtoolbox.com/

⚠️ **Проверка DNS скриптом:**

```bash
node scripts/check-dns.mjs kolibri-dresden.de mailchannels
```

Скрипт автоматически проверит SPF, DKIM и DMARC записи.

---

## Шаг 4: Настройка Cloudflare Turnstile

Turnstile — защита от ботов на формах регистрации/логина/массовой рассылки (альтернатива reCAPTCHA).

### 4.1. Создание Turnstile Site

1. Откройте [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Выберите ваш аккаунт → **Turnstile**
3. Нажмите **Add Site**
4. Заполните:
   - **Site name**: `Berufsorientierung App`
   - **Domain**: `your-app.workers.dev` или ваш кастомный домен
   - **Widget Mode**: `Managed` (рекомендуется)
5. Нажмите **Create**

### 4.2. Получение ключей

После создания вы получите:

- **Site Key** (публичный) - для клиента
- **Secret Key** (приватный) - для сервера

### 4.3. Добавление Site Key в wrangler.toml

Откройте `wrangler.toml` и добавьте в секцию `[vars]`:

```toml
[vars]
EMAIL_PROVIDER = "mailchannels"
EMAIL_FROM = "Berufsorientierung <Berufsorientierung@kolibri-dresden.de>"
EMAIL_REPLY_TO = "Berufsorientierung <Berufsorientierung@kolibri-dresden.de>"
EMAIL_BULK_CHUNK = "50"
EMAIL_BULK_PAUSE_MS = "60000"
TURNSTILE_SITE_KEY = "your_turnstile_site_key_here"  # <-- Добавьте сюда
```

### 4.4. Добавление Secret Key

```bash
wrangler secret put TURNSTILE_SECRET_KEY
# Вставьте Secret Key когда попросит
```

### 4.5. Проверка интеграции

Turnstile используется на страницах:

- `/register` - регистрация пользователей
- `/login` - вход в систему
- `/admin/newsletter/send` - массовая рассылка

После деплоя на этих страницах появится виджет Turnstile.

---

## Шаг 5: Настройка секретов (Secrets)

Секреты не хранятся в `wrangler.toml` - они добавляются через Wrangler CLI.

### 5.1. JWT Secret

Генерируйте случайную строку (минимум 32 символа):

```bash
# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# macOS/Linux (Bash)
openssl rand -base64 64 | tr -d '\n'
```

Добавьте secret:

```bash
wrangler secret put JWT_SECRET
# Вставьте сгенерированную строку когда попросит
```

### 5.2. DKIM Private Key

**Подготовьте ключ:**

```bash
# Windows (PowerShell)
$key = Get-Content dkim_private.key -Raw
$key -replace "`r`n", "\n" -replace "`n", "\n"

# macOS/Linux (Bash)
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' dkim_private.key
```

Скопируйте результат в буфер обмена.

**Добавьте secret:**

```bash
wrangler secret put DKIM_PRIVATE_KEY
# Вставьте подготовленный ключ (с \n)
```

### 5.3. DKIM Domain и Selector

```bash
wrangler secret put DKIM_DOMAIN
# Введите: kolibri-dresden.de

wrangler secret put DKIM_SELECTOR
# Введите: mailchannels
```

### 5.4. R2 Public URL

```bash
wrangler secret put R2_PUBLIC_URL
# Введите: https://pub-xxxxx.r2.dev (из Шага 2.4)
```

⚠️ **ВАЖНО:** Без этого секрета QR-коды не будут отображаться в письмах!

### 5.5. Cron Secret

Генерируйте случайную строку:

```bash
# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# macOS/Linux
openssl rand -hex 32
```

```bash
wrangler secret put CRON_SECRET
# Вставьте сгенерированную строку
```

⚠️ **Сохраните значение!** Оно понадобится для тестирования HTTP fallback endpoint (см. Шаг 8.7).

### 5.6. Setup Token (для создания первого админа)

Генерируйте случайную строку (используйте только один раз!):

```bash
wrangler secret put SETUP_TOKEN
# Введите случайную строку (сохраните в надежном месте)
```

⚠️ **ВАЖНО:** Этот токен используется только для тестирования email endpoint. После production его можно удалить.

### 5.7. Turnstile Secret Key

```bash
wrangler secret put TURNSTILE_SECRET_KEY
# Вставьте Secret Key из Cloudflare Dashboard (см. Шаг 4.4)
```

### 5.8. Проверка секретов

```bash
wrangler secret list
```

**Ожидаемый вывод:**

```
JWT_SECRET
DKIM_DOMAIN
DKIM_SELECTOR
DKIM_PRIVATE_KEY
R2_PUBLIC_URL
CRON_SECRET
SETUP_TOKEN
TURNSTILE_SECRET_KEY
```

---

## Шаг 6: Создание первого администратора

⚠️ **ВАЖНО:** Первый администратор (superadmin) создается вручную через SQL!

### 6.1. Зарегистрируйте пользователя через интерфейс

1. После деплоя (см. Шаг 7) откройте ваше приложение
2. Перейдите на `/register`
3. Зарегистрируйте нового пользователя с вашим email

### 6.2. Получите ID пользователя

```bash
wrangler d1 execute berufsorientierung-db --remote --command="SELECT id, email FROM users WHERE email='your-admin@example.com';"
```

**Вывод:**

```
id  email
--  ----------------------
1   your-admin@example.com
```

Запомните `id` (например, `1`).

### 6.3. Добавьте запись в таблицу admins

```bash
wrangler d1 execute berufsorientierung-db --remote --command="INSERT INTO admins (user_id, created_by, created_at) VALUES (1, NULL, datetime('now'));"
```

⚠️ **Замените `1` на ваш user_id!**

`created_by = NULL` делает этого пользователя **superadmin** (неудаляемым).

### 6.4. Проверка

```bash
wrangler d1 execute berufsorientierung-db --remote --command="SELECT * FROM admins;"
```

**Вывод:**

```
id  user_id  created_by  created_at
--  -------  ----------  -------------------
1   1        NULL        2025-11-12 10:00:00
```

### 6.5. Тест входа

1. Откройте `/login`
2. Войдите с email/паролем администратора
3. Перейдите на `/admin` - должна открыться админ-панель

---

## Шаг 7: Деплой приложения

⚠️ **ВАЖНО:** Это деплой как **Cloudflare Workers** (не Pages)! Точка входа: `.svelte-kit/cloudflare/_worker.js`.

### 7.1. Установка зависимостей

```bash
npm install
```

### 7.2. Проверка TypeScript

```bash
npm run check
```

Исправьте все ошибки перед деплоем!

### 7.3. Сборка проекта

```bash
npm run build
```

**Что происходит под капотом:**

1. **`vite build`** - SvelteKit генерирует production build через `@sveltejs/adapter-cloudflare`
   - Создаётся `.svelte-kit/cloudflare/_worker.js` (entry point для Workers)
   - Статические ассеты копируются в `.svelte-kit/cloudflare/assets/`

2. **`scripts/inject-cron.js`** - автоматически добавляет экспорт Cron handler
   - Внедряет `export { scheduled } from '../../src/worker.ts';` в `_worker.js`
   - Без этого шага Cloudflare Cron Triggers не будут работать!

**Ожидаемый вывод:**

```
vite v7.1.7 building for production...
✓ built in 15.42s
✅ Successfully injected scheduled handler into _worker.js
   Cloudflare Cron triggers will now work
```

⚠️ **НЕ МЕНЯЙТЕ** `main = ".svelte-kit/cloudflare/_worker.js"` в `wrangler.toml`! Это точка входа для Workers.

### 7.4. Деплой в Cloudflare

```bash
wrangler deploy
```

или используйте npm script:

```bash
npm run deploy  # Это тоже самое: npm run build && wrangler deploy
```

**Вывод:**

```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded berufsorientierung-app (X.XX sec)
Published berufsorientierung-app (X.XX sec)
  https://berufsorientierung-app.your-subdomain.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 7.5. Настройка кастомного домена (опционально)

1. Cloudflare Dashboard → **Workers & Pages**
2. Выберите `berufsorientierung-app`
3. **Settings** → **Domains & Routes**
4. **Add** → **Custom Domain**
5. Введите: `app.kolibri-dresden.de`
6. Cloudflare автоматически создаст DNS запись

---

## Шаг 8: Настройка Cloudflare Cron Triggers

### 8.1. Проверка wrangler.toml

Убедитесь, что в `wrangler.toml` есть:

```toml
[triggers]
crons = ["0 2 * * *"]  # Каждый день в 02:00 UTC
```

### 8.2. Как это работает

После `npm run build`:

- `scripts/inject-cron.js` автоматически добавляет `export { scheduled }` в `.svelte-kit/cloudflare/_worker.js`
- `src/worker.ts` содержит обработчик `scheduled()`
- При деплое Cloudflare автоматически регистрирует Cron триггер

⚠️ **ВАЖНО:** Если пропустить `npm run build`, Cron handler не будет экспортирован и триггеры не сработают!

### 8.3. Проверка Cron в Dashboard

1. Cloudflare Dashboard → **Workers & Pages**
2. Выберите `berufsorientierung-app`
3. **Triggers** → **Cron Triggers**
4. Должна быть запись: `0 2 * * *`

### 8.4. Тестирование Cron через HTTP (опционально)

Cron можно протестировать через HTTP fallback endpoint:

```bash
curl -X GET "https://your-app.workers.dev/api/cron/delete-users" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

⚠️ **Замените:**

- `https://your-app.workers.dev` на ваш URL
- `YOUR_CRON_SECRET` на значение из Шага 5.5 (или `wrangler secret list`)

⚠️ **Формат заголовка:** `Authorization: Bearer <CRON_SECRET>` (проверяется в `src/routes/api/cron/delete-users/+server.ts`)

---

## Шаг 9: Тестирование после деплоя

### 9.1. Регистрация пользователя

1. Откройте `/register`
2. Заполните форму
3. **Пройдите Turnstile проверку** (появится виджет)
4. Проверьте email - должно прийти приветственное письмо

### 9.2. Вход администратора

1. Откройте `/login`
2. Войдите с email/паролем администратора
3. **Пройдите Turnstile проверку**
4. Перейдите на `/admin`

### 9.3. Создание мероприятия

1. Админ-панель → **События**
2. Нажмите **Создать мероприятие**
3. Заполните форму (все языки)
4. Добавьте Telegram/WhatsApp ссылки
5. Нажмите **Создать**

### 9.4. Проверка QR-кодов

После создания мероприятия:

1. Откройте R2 bucket в Cloudflare Dashboard
2. Должны появиться файлы: `qr-telegram-{eventId}.png` и `qr-whatsapp-{eventId}.png`

### 9.5. Запись на мероприятие

1. Выйдите из админки (или откройте в режиме инкогнито)
2. Откройте главную страницу
3. Выберите мероприятие → **Записаться**
4. Проверьте email - должно прийти подтверждение с QR-кодами

### 9.6. Проверка Turnstile

1. Откройте Cloudflare Dashboard → **Turnstile**
2. Выберите ваш сайт
3. **Analytics** - должны появиться записи о проверках

### 9.7. Тест email отправки (для админа)

**Используйте защищённый endpoint:**

```bash
curl -X POST "https://your-app.workers.dev/api/dev/test-email" \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: YOUR_SETUP_TOKEN" \
  -d '{
    "to": "your-email@example.com",
    "type": "welcome",
    "language": "de"
  }'
```

⚠️ **Замените:**

- `https://your-app.workers.dev` на ваш URL
- `YOUR_SETUP_TOKEN` на значение из secrets
- `your-email@example.com` на ваш email

**Типы писем для теста:**

- `welcome` - приветственное письмо
- `event_registration` - подтверждение записи
- `event_cancellation` - отмена записи
- `event_cancelled_by_admin` - отмена мероприятия админом

---

## Troubleshooting

### ❌ Ошибка: "Database not found"

**Причина:** `database_id` в `wrangler.toml` неверный.

**Решение:**

```bash
wrangler d1 list
```

Скопируйте правильный `database_id` в `wrangler.toml`.

---

### ❌ Email не отправляются

**Проверка 1: DNS записи**

```bash
# SPF
nslookup -type=TXT kolibri-dresden.de

# DKIM
nslookup -type=TXT mailchannels._domainkey.kolibri-dresden.de

# DMARC
nslookup -type=TXT _dmarc.kolibri-dresden.de
```

**Проверка 2: Логи Cloudflare**

```bash
wrangler tail
```

Отправьте тестовое письмо и смотрите логи в реальном времени.

**Проверка 3: MailChannels ответ**

В логах ищите:

```
[Email] Sending email via MailChannels...
[Email] MailChannels response: 202
```

`202` = успешно отправлено.

**Проверка 4: Secrets**

```bash
wrangler secret list
```

Убедитесь, что есть:

- `DKIM_DOMAIN`
- `DKIM_SELECTOR`
- `DKIM_PRIVATE_KEY`

**Проверка 5: Spam folder**

Первые письма могут попадать в спам. Проверьте папку "Спам" и отметьте как "Не спам".

---

### ❌ QR-коды не загружаются

**Причина 1: R2 Public Access не включен**

1. Cloudflare Dashboard → R2 → `berufsorientierung-qr-codes`
2. Settings → Public Access → **Allow Access**

**Причина 2: Неверный R2_PUBLIC_URL**

```bash
wrangler secret list
```

Проверьте, что `R2_PUBLIC_URL` совпадает с Public R2.dev URL из R2 Settings.

**Причина 3: QR-коды не генерируются**

Проверьте логи:

```bash
wrangler tail
```

Создайте мероприятие с Telegram/WhatsApp ссылками и смотрите логи.

---

### ❌ Ошибка: "Unauthorized" при входе в админку

**Причина:** Пользователь не добавлен в таблицу `admins`.

**Решение:**

```bash
# Проверьте admins
wrangler d1 execute berufsorientierung-db --remote --command="SELECT * FROM admins;"

# Если пусто - добавьте первого админа (см. Шаг 5)
wrangler d1 execute berufsorientierung-db --remote --command="INSERT INTO admins (user_id, created_by, created_at) VALUES (1, NULL, datetime('now'));"
```

---

### ❌ Cron не запускается

**Проверка 1: Cron trigger в Dashboard**

1. Cloudflare Dashboard → Workers & Pages → `berufsorientierung-app`
2. Triggers → Cron Triggers
3. Должна быть запись: `0 2 * * *`

**Проверка 2: Build script**

```bash
npm run build
```

В выводе должно быть:

```
✅ Successfully injected scheduled handler into _worker.js
   Cloudflare Cron triggers will now work
```

**Проверка 3: Логи Cron**

Cron выполняется в 02:00 UTC. Проверьте логи на следующий день:

```bash
# macOS/Linux
wrangler tail | grep -i cron

# Windows
wrangler tail | findstr /i cron
```

**Проверка 4: Тест через HTTP**

```bash
curl -X GET "https://your-app.workers.dev/api/cron/delete-users" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

### ❌ TypeScript ошибки при деплое

**Решение:**

```bash
# Проверка типов
npm run check

# Если есть ошибки - исправьте их
# Затем пересоберите
npm run build
npm run deploy
```

---

### ❌ Ошибка: "R2 bucket not found"

**Причина:** Bucket name в `wrangler.toml` не совпадает с созданным.

**Решение:**

```bash
# Список buckets
wrangler r2 bucket list

# Обновите wrangler.toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "ваш-bucket-name"  # <-- Используйте точное имя
```

---

## Мониторинг и обслуживание

### Логи в реальном времени

```bash
wrangler tail
```

**Фильтрация логов:**

⚠️ **Примечание:** Флаг `--filter` может отсутствовать в некоторых версиях Wrangler. Используйте внешние инструменты:

```bash
# macOS/Linux - с ripgrep (rg) или grep
wrangler tail | rg -i 'error|cron|email'
wrangler tail | grep -i error

# Windows - с findstr
wrangler tail | findstr /i error
wrangler tail | findstr /i cron
wrangler tail | findstr /i email

# Несколько ключевых слов (Windows)
wrangler tail | findstr /i "error cron email"
```

---

### Cloudflare Analytics

1. Cloudflare Dashboard → **Workers & Pages**
2. Выберите `berufsorientierung-app`
3. **Analytics**

**Доступные метрики:**

- Requests per day
- Errors
- CPU time
- Response time

---

### Бэкап базы данных

**Экспорт SQL:**

```bash
wrangler d1 export berufsorientierung-db --remote --output=backup-$(date +%Y%m%d).sql
```

**Экспорт через админку:**

1. Админ-панель → **Статистика**
2. Нажмите **Экспорт всех данных**
3. Скачается JSON файл

**Автоматизация бэкапа (опционально):**

Создайте GitHub Action для ежедневного бэкапа:

```yaml
# .github/workflows/backup-db.yml
name: Database Backup

on:
  schedule:
    - cron: '0 3 * * *' # Каждый день в 03:00 UTC

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Wrangler
        run: npm install -g wrangler
      - name: Export DB
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          wrangler d1 export berufsorientierung-db --remote --output=backup.sql
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: db-backup-${{ github.run_number }}
          path: backup.sql
```

---

### Обновление приложения

**Из Git:**

```bash
git pull origin main
npm install
npm run build
npm run deploy
```

**Применение новых миграций:**

Если есть новая миграция (`migrations/0003_*.sql`):

```bash
wrangler d1 execute berufsorientierung-db --remote --file=./migrations/0003_*.sql
```

---

### Rollback (откат версии)

**Откат к предыдущей версии:**

```bash
wrangler rollback
```

**Откат к конкретной версии:**

1. Cloudflare Dashboard → Workers & Pages → `berufsorientierung-app`
2. **Deployments**
3. Найдите нужную версию
4. Нажмите **⋯** → **Rollback to this deployment**

---

### Проверка здоровья системы

**Health Check Endpoint:**

```bash
curl https://your-app.workers.dev/api/health
```

**Ожидаемый ответ:**

```json
{
	"status": "ok",
	"timestamp": "2025-11-12T10:00:00Z"
}
```

---

## Полезные ссылки

### Документация проекта

- **[Email Setup Guide](../features/email/DEPLOYMENT.md)** - Подробная настройка DNS
- **[Admin Features](../features/admin/README.md)** - Функционал админ-панели
- **[Database Documentation](../database/README.md)** - Структура БД
- **[Turnstile Setup](../features/security/TURNSTILE.md)** - Защита от ботов

### Cloudflare Docs

- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Turnstile Documentation](https://developers.cloudflare.com/turnstile/)

### Email

- [MailChannels Documentation](https://mailchannels.zendesk.com/hc/en-us)
- [SPF Record Checker](https://mxtoolbox.com/spf.aspx)
- [DKIM Record Checker](https://mxtoolbox.com/dkim.aspx)
- [DMARC Record Checker](https://mxtoolbox.com/dmarc.aspx)

---

## Контрольный чек-лист перед production

- [ ] **D1 Database:** База данных создана, `database_id` в `wrangler.toml`, миграции применены
- [ ] **D1 Binding:** `binding = "DB"` в `wrangler.toml` (НЕ МЕНЯТЬ!)
- [ ] **R2 Bucket:** Production и preview buckets созданы
- [ ] **R2 Public Access:** Включён, Public URL скопирован
- [ ] **R2 Binding:** `binding = "R2_BUCKET"` в `wrangler.toml` (НЕ МЕНЯТЬ!)
- [ ] **DNS - SPF:** Запись добавлена (проверить: `nslookup -type=TXT <domain>`)
- [ ] **DNS - DKIM:** Ключи сгенерированы, публичный ключ в DNS
- [ ] **DNS - DMARC:** Запись добавлена
- [ ] **DNS Verification:** Проверено через `node scripts/check-dns.mjs` или MXToolbox
- [ ] **Turnstile Site:** Создан в Cloudflare Dashboard
- [ ] **Turnstile Site Key:** Добавлен в `wrangler.toml` под `[vars]`
- [ ] **Secrets - All Set:** Проверено `wrangler secret list` (8 secrets):
  - `JWT_SECRET`
  - `DKIM_DOMAIN`, `DKIM_SELECTOR`, `DKIM_PRIVATE_KEY`
  - `R2_PUBLIC_URL`
  - `CRON_SECRET`
  - `SETUP_TOKEN`
  - `TURNSTILE_SECRET_KEY`
- [ ] **Build успешен:** `npm run build` прошёл без ошибок, Cron handler injected
- [ ] **Deploy выполнен:** `wrangler deploy` успешен, URL получен
- [ ] **Первый админ создан:** SQL INSERT в `admins` с `created_by = NULL`
- [ ] **Cron Trigger:** Проверен в Dashboard (Triggers → Cron Triggers)
- [ ] **Тестовая регистрация:** Пользователь создан, email получен (не в спаме)
- [ ] **Turnstile работает:** Виджет появляется на `/register`, `/login`
- [ ] **Админ-панель:** Вход выполнен, dashboard отображается
- [ ] **QR-коды:** Генерируются в R2, отображаются в письмах
- [ ] **Кастомный домен:** Настроен (опционально)
- [ ] **Бэкап БД:** Настроен (опционально, GitHub Actions или вручную)

---

## Поддержка

Если возникли проблемы:

1. Проверьте раздел [Troubleshooting](#troubleshooting)
2. Посмотрите логи: `wrangler tail`
3. Проверьте документацию в `docs/`
4. Создайте issue в репозитории

---

**Дата последнего обновления:** 2025-11-12  
**Версия документа:** 1.2.0  
**Изменения v1.2:** Исправлены команды фильтрации `wrangler tail` (использованы внешние инструменты), добавлено требование Wrangler v4+, обновлён лимит Turnstile.  
**Изменения v1.1:** Добавлен Turnstile, уточнены биндинги D1/R2, детализирован процесс build, обновлён формат Authorization для Cron HTTP.
