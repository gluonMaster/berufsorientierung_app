# 📧 Email Deployment Guide: DNS Configuration (SPF/DKIM/DMARC)

**Цель:** Настроить DNS-записи домена `kolibri-dresden.de` для корректной отправки email через MailChannels, чтобы письма не попадали в спам.

---

## ⚠️ Важно для существующей корпоративной почты

Если домен `kolibri-dresden.de` уже используется для корпоративной почты (`info@kolibri-dresden.de`):

- ✅ **DKIM:** Безопасно — создаёте новую запись с селектором `mailchannels._domainkey` (не влияет на существующие)
- ⚠️ **SPF:** Требует осторожности — **ДОПОЛНЯЕТЕ** существующую запись, **НЕ создаёте новую**
- ✅ **DMARC:** Безопасно если политика `p=none` (только мониторинг)

**См. подробности:** [Работа с существующей корпоративной почтой](#работа-с-существующей-корпоративной-почтой) в разделе Troubleshooting.

---

## 📋 Содержание

1. [Обзор](#обзор)
2. [Предварительные требования](#предварительные-требования)
3. [Шаг 1: Настройка SPF](#шаг-1-настройка-spf)
4. [Шаг 2: Генерация и настройка DKIM](#шаг-2-генерация-и-настройка-dkim)
5. [Шаг 3: Настройка DMARC](#шаг-3-настройка-dmarc)
6. [Шаг 4: Проверка DNS записей](#шаг-4-проверка-dns-записей)
7. [Шаг 5: Тестовая отправка email](#шаг-5-тестовая-отправка-email)
8. [Чек-лист перед релизом](#чек-лист-перед-релизом)
9. [Troubleshooting](#troubleshooting)
   - [Работа с существующей корпоративной почтой](#работа-с-существующей-корпоративной-почтой)

---

## Обзор

Для того чтобы email от `Berufsorientierung@kolibri-dresden.de` проходили проверки почтовых провайдеров (Gmail, Outlook, и т.д.) и не попадали в спам, необходимо настроить три ключевых DNS-записи:

- **SPF** (Sender Policy Framework) - указывает какие серверы могут отправлять почту от имени домена
- **DKIM** (DomainKeys Identified Mail) - криптографическая подпись писем для подтверждения подлинности
- **DMARC** (Domain-based Message Authentication) - политика обработки писем, не прошедших проверку SPF/DKIM

---

## Предварительные требования

1. **Доступ к DNS настройкам домена** `kolibri-dresden.de`
   - У вашего хостинг-провайдера или DNS-провайдера (например: Cloudflare, AWS Route53, Google Domains и т.д.)
2. **Установлен OpenSSL** (для генерации DKIM ключей)
   - Windows: скачайте с https://slproweb.com/products/Win32OpenSSL.html
   - macOS/Linux: обычно предустановлен

3. **Node.js** (для запуска утилиты проверки DNS)

---

## Шаг 1: Настройка SPF

### Что такое SPF?

SPF-запись указывает почтовым серверам, какие IP-адреса/серверы имеют право отправлять почту от имени вашего домена.

### Инструкция

#### 1.1. Проверьте существующую SPF-запись

Откройте терминал и выполните:

```bash
nslookup -type=TXT kolibri-dresden.de
```

или используйте онлайн-сервис: https://mxtoolbox.com/SuperTool.aspx?action=spf%3akolibri-dresden.de

**Ищите запись формата:**

```
v=spf1 ... ~all
```

#### 1.2. Обновите/создайте SPF-запись

⚠️ **ВАЖНО для существующей корпоративной почты:**

Если домен `kolibri-dresden.de` уже используется для корпоративной почты (например, `info@kolibri-dresden.de`), у вас **обязательно есть SPF-запись**.

**НЕ создавайте новую SPF-запись!** У домена может быть только одна SPF-запись. Вместо этого **дополните существующую**, добавив `include:relay.mailchannels.net`.

##### Если SPF-запись уже существует:

**Добавьте** `include:relay.mailchannels.net` **ПЕРЕД** `~all` или `-all`:

**Пример (Google Workspace):**

```
Было:    v=spf1 include:_spf.google.com ~all
Стало:   v=spf1 include:_spf.google.com include:relay.mailchannels.net ~all
```

**Пример (Microsoft 365):**

```
Было:    v=spf1 include:spf.protection.outlook.com ~all
Стало:   v=spf1 include:spf.protection.outlook.com include:relay.mailchannels.net ~all
```

**Пример (несколько провайдеров):**

```
v=spf1 include:_spf.google.com include:mailgun.org include:relay.mailchannels.net ~all
```

##### Если SPF-записи НЕТ:

Создайте новую TXT-запись:

| Тип | Имя                      | Значение                                     | TTL  |
| --- | ------------------------ | -------------------------------------------- | ---- |
| TXT | @ или kolibri-dresden.de | `v=spf1 include:relay.mailchannels.net ~all` | 3600 |

#### 1.3. Разбор параметров SPF

- `v=spf1` - версия SPF
- `include:relay.mailchannels.net` - разрешить MailChannels отправлять почту
- `~all` - "soft fail" (рекомендуется для начала; после проверки можно изменить на `-all` для "hard fail")

### ✅ Критерий успеха

SPF-запись содержит `include:relay.mailchannels.net` и корректный завершающий параметр (`~all` или `-all`).

---

## Шаг 2: Генерация и настройка DKIM

### Что такое DKIM?

DKIM добавляет криптографическую подпись к каждому письму. Получатель проверяет подпись по публичному ключу в DNS.

### Инструкция

#### 2.1. Генерация пары ключей (публичный + приватный)

Откройте терминал и выполните:

```bash
# Генерация приватного ключа (2048 бит)
openssl genrsa -out dkim_private.key 2048

# Извлечение публичного ключа
openssl rsa -in dkim_private.key -pubout -outform der 2>/dev/null | openssl base64 -A > dkim_public.txt
```

**Результат:**

- `dkim_private.key` - приватный ключ (НЕ публикуйте! Хранить в `.env`)
- `dkim_public.txt` - публичный ключ в формате base64 (для DNS)

#### 2.2. Подготовка приватного ключа для .env

Приватный ключ должен быть в формате PEM **с экранированными переносами строк** (`\n`).

**PowerShell (Windows):**

```powershell
$key = Get-Content dkim_private.key -Raw
$key -replace "`r`n", "\n" -replace "`n", "\n"
```

**Bash (macOS/Linux):**

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' dkim_private.key
```

Скопируйте результат и вставьте в `.env`:

```env
DKIM_DOMAIN=kolibri-dresden.de
DKIM_SELECTOR=mailchannels
DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQ...\n-----END PRIVATE KEY-----"
```

#### 2.3. Создание DNS TXT-записи для DKIM

Прочитайте публичный ключ:

```bash
# Windows (PowerShell)
Get-Content dkim_public.txt

# macOS/Linux
cat dkim_public.txt
```

Создайте TXT-запись в DNS:

| Тип | Имя                                                                        | Значение                                         | TTL  |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------ | ---- |
| TXT | `mailchannels._domainkey` или `mailchannels._domainkey.kolibri-dresden.de` | `v=DKIM1; k=rsa; p=<СОДЕРЖИМОЕ_dkim_public.txt>` | 3600 |

**Пример:**

```
mailchannels._domainkey.kolibri-dresden.de
  IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr..."
```

⚠️ **ВАЖНО:**

- Селектор `mailchannels` должен совпадать с `DKIM_SELECTOR` в `.env`
- Если хотите использовать другой селектор (например `k1`), обновите везде: DNS-запись (`k1._domainkey.kolibri-dresden.de`) и `DKIM_SELECTOR=k1` в `.env`

#### 2.4. Проверка DKIM в коде

Убедитесь, что `src/lib/server/email/index.ts` использует DKIM:

```typescript
// Фрагмент из src/lib/server/email/index.ts (уже реализовано)
const dkimConfig = getDKIMConfig(env);
if (dkimConfig) {
	payload.personalizations[0].dkim_domain = dkimConfig.domain;
	payload.personalizations[0].dkim_selector = dkimConfig.selector;
	payload.personalizations[0].dkim_private_key = dkimConfig.privateKey;
}
```

Это уже реализовано! Просто проверьте что переменные в `.env` заполнены.

### ✅ Критерий успеха

- TXT-запись `mailchannels._domainkey.kolibri-dresden.de` существует и содержит публичный ключ
- В `.env` указаны `DKIM_DOMAIN`, `DKIM_SELECTOR` и `DKIM_PRIVATE_KEY`

---

## Шаг 3: Настройка DMARC

### Что такое DMARC?

DMARC - это политика, которая указывает получателям что делать с письмами, не прошедшими проверку SPF/DKIM:

- `p=none` - только мониторинг (рекомендуется для начала)
- `p=quarantine` - отправить в спам
- `p=reject` - отклонить полностью

### Инструкция

#### 3.1. Создание DMARC TXT-записи

Создайте TXT-запись в DNS:

| Тип | Имя                                      | Значение                                                     | TTL  |
| --- | ---------------------------------------- | ------------------------------------------------------------ | ---- |
| TXT | `_dmarc` или `_dmarc.kolibri-dresden.de` | `v=DMARC1; p=none; rua=mailto:postmaster@kolibri-dresden.de` | 3600 |

#### 3.2. Разбор параметров DMARC

- `v=DMARC1` - версия DMARC
- `p=none` - политика: не предпринимать действий (только отчёты)
- `rua=mailto:postmaster@kolibri-dresden.de` - адрес для получения aggregate reports

#### 3.3. Постепенное ужесточение политики

После успешного тестирования (1-2 недели с `p=none`) можно перейти к:

```
v=DMARC1; p=quarantine; pct=10; rua=mailto:postmaster@kolibri-dresden.de
```

- `p=quarantine` - подозрительные письма в спам
- `pct=10` - применять политику к 10% писем (постепенно увеличивать до 100%)

Финальная строгая политика:

```
v=DMARC1; p=reject; rua=mailto:postmaster@kolibri-dresden.de
```

### ✅ Критерий успеха

TXT-запись `_dmarc.kolibri-dresden.de` существует и содержит валидную DMARC-политику.

---

## Шаг 4: Проверка DNS записей

### Автоматическая проверка через утилиту

Запустите скрипт проверки DNS:

```bash
# По умолчанию проверяет DKIM селектор 'mailchannels'
node scripts/check-dns.mjs kolibri-dresden.de

# Или укажите другой селектор (если используете не 'mailchannels')
node scripts/check-dns.mjs kolibri-dresden.de k1
```

**Утилита проверит:**

- ✅ Наличие SPF записи с `include:relay.mailchannels.net`
- ✅ Наличие DKIM записи для указанного селектора (по умолчанию: `mailchannels._domainkey.kolibri-dresden.de`)
- ✅ Наличие DMARC записи `_dmarc.kolibri-dresden.de`
- ✅ Синтаксис всех записей

**Пример вывода:**

```
🔍 Checking DNS records for: kolibri-dresden.de

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPF Record
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SPF record found
✅ Contains include:relay.mailchannels.net
Record: v=spf1 include:relay.mailchannels.net ~all

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 DKIM Record (Selector: mailchannels)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DKIM record found
✅ Valid DKIM format (v=DKIM1; k=rsa; p=...)
Record: v=DKIM1; k=rsa; p=MIIBIjANBg...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ DMARC Record
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DMARC record found
✅ Valid DMARC format
Policy: none
Report email: postmaster@kolibri-dresden.de
Record: v=DMARC1; p=none; rua=mailto:postmaster@kolibri-dresden.de

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All DNS records are correctly configured!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Ручная проверка через онлайн-сервисы

Альтернативно можно использовать:

- **MXToolbox:** https://mxtoolbox.com/SuperTool.aspx
  - SPF: `spf:kolibri-dresden.de`
  - DKIM: `dkim:mailchannels:kolibri-dresden.de`
  - DMARC: `dmarc:kolibri-dresden.de`

- **Google Admin Toolbox:** https://toolbox.googleapps.com/apps/checkmx/

- **DKIM Validator:** https://dkimvalidator.com/

### ⏰ Время распространения DNS

После создания/изменения DNS-записей может потребоваться до **24-48 часов** для полного распространения (TTL).

Для быстрой проверки используйте:

```bash
nslookup -type=TXT kolibri-dresden.de 8.8.8.8
```

(8.8.8.8 - Google DNS, часто обновляется быстрее)

---

## Шаг 5: Тестовая отправка email

### 5.1. Подготовка

Убедитесь, что:

- `.env` содержит все необходимые переменные (включая DKIM)
- Приложение развёрнуто (локально или на Cloudflare Workers)
- DNS-записи распространились (подождите минимум 1 час после создания)

### 5.2. Отправка тестового письма через API

#### Development mode (локально):

```bash
# В .env задайте
SETUP_TOKEN=test-secret-123

# Запустите dev сервер
npm run dev
```

Отправьте POST запрос:

```bash
curl -X POST http://localhost:5173/api/dev/test-email \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: test-secret-123" \
  -d '{
    "to": "your-test-email@gmail.com",
    "subject": "Test Email from Berufsorientierung",
    "text": "This is a test email to verify DNS configuration (SPF/DKIM/DMARC)."
  }'
```

#### Production mode (Cloudflare Workers):

```bash
curl -X POST https://your-app.workers.dev/api/dev/test-email \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: your-production-setup-token" \
  -d '{
    "to": "your-test-email@gmail.com",
    "subject": "Test Email from Berufsorientierung",
    "text": "This is a test email to verify DNS configuration (SPF/DKIM/DMARC)."
  }'
```

### 5.3. Проверка результата

**Ожидаемый ответ (успех):**

```json
{
	"success": true,
	"message": "Test email sent successfully",
	"provider": "mailchannels",
	"to": "your-test-email@gmail.com"
}
```

**Ошибка аутентификации:**

```json
{
	"success": false,
	"error": "Unauthorized: invalid or missing SETUP_TOKEN"
}
```

### 5.4. Проверка письма в почтовом ящике

1. **Проверьте inbox** (или spam/junk)
2. **Откройте письмо**
3. **Посмотрите заголовки (headers)**:
   - Gmail: три точки → "Show original"
   - Outlook: File → Properties → Internet headers

**Ищите:**

```
Authentication-Results: ...
  spf=pass (google.com: domain of ...) ...
  dkim=pass header.i=@kolibri-dresden.de ...
  dmarc=pass ...
```

✅ **Все три (SPF, DKIM, DMARC) должны быть `pass`!**

### 5.5. Альтернативный метод: Mail-Tester

Отправьте тестовое письмо на адрес, сгенерированный сервисом:

1. Откройте https://www.mail-tester.com/
2. Скопируйте email адрес (например: `test-abc123@srv1.mail-tester.com`)
3. Отправьте письмо через `/api/dev/test-email` на этот адрес
4. Обновите страницу Mail-Tester и посмотрите результат

**Цель:** получить оценку **10/10** 🎯

---

## Чек-лист перед релизом

Перед запуском production развёртывания убедитесь:

### DNS Configuration

- [ ] **SPF:** TXT-запись `@` содержит `include:relay.mailchannels.net`
- [ ] **DKIM:** TXT-запись `mailchannels._domainkey` существует с публичным ключом
- [ ] **DMARC:** TXT-запись `_dmarc` существует (минимум `p=none`)
- [ ] **DNS распространение:** прошло минимум 2 часа после создания записей

### Environment Variables

- [ ] `JWT_SECRET` - случайная строка ≥32 символов
- [ ] `EMAIL_FROM` - `Berufsorientierung <Berufsorientierung@kolibri-dresden.de>`
- [ ] `EMAIL_REPLY_TO` - корректный reply-to адрес
- [ ] `DKIM_DOMAIN` - `kolibri-dresden.de`
- [ ] `DKIM_SELECTOR` - `mailchannels` (или ваш кастомный)
- [ ] `DKIM_PRIVATE_KEY` - PEM-формат с `\n` (многострочный)
- [ ] `R2_PUBLIC_URL` - URL вашего R2 bucket
- [ ] `SETUP_TOKEN` - сильный токен для `/api/dev/test-email` и создания первого админа
- [ ] `CRON_SECRET` - токен для cron triggers

### Email Testing

- [ ] Тест отправки через `/api/dev/test-email` успешен
- [ ] Письмо получено в inbox (не в spam)
- [ ] SPF `pass` в заголовках письма
- [ ] DKIM `pass` в заголовках письма
- [ ] DMARC `pass` в заголовках письма
- [ ] Mail-Tester показывает ≥9/10

### Code & Documentation

- [ ] `src/lib/server/email/index.ts` корректно использует DKIM
- [ ] `.env.example` содержит все необходимые переменные
- [ ] Документация `docs/features/email/` актуальна
- [ ] `scripts/check-dns.mjs` работает корректно

---

## Troubleshooting

### ❌ Письма попадают в спам

**Возможные причины:**

1. **DNS записи не распространились**
   - Подождите 24-48 часов
   - Проверьте через `nslookup` или MXToolbox

2. **DKIM подпись не проходит**
   - Убедитесь что `DKIM_PRIVATE_KEY` в `.env` корректен (PEM с `\n`)
   - Проверьте что селектор в DNS совпадает с `DKIM_SELECTOR`
   - Публичный ключ должен быть без пробелов/переносов строк в одну линию

3. **Некорректный SPF**
   - Проверьте что `include:relay.mailchannels.net` идёт ПЕРЕД `~all`
   - Не должно быть опечаток в домене

4. **Нет DMARC или строгая политика**
   - Начните с `p=none` для мониторинга
   - После 1-2 недель переходите к `p=quarantine`

5. **Reputation домена/IP**
   - Новые домены могут иметь низкий trust score
   - Отправляйте письма постепенно (не массовые рассылки сразу)
   - Следите за bounce rate и spam complaints

### ❌ DKIM не проходит проверку

**Проверьте:**

```bash
# Посмотрите DNS запись
nslookup -type=TXT mailchannels._domainkey.kolibri-dresden.de

# Должно вернуть что-то вроде:
# v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
```

**Если записи нет:**

- Создайте TXT-запись по инструкции выше
- Подождите 1-2 часа

**Если запись есть, но DKIM fail:**

- Сравните публичный ключ в DNS с тем что был сгенерирован
- Убедитесь что приватный ключ в `.env` соответствует публичному
- Проверьте что нет лишних пробелов/символов в DKIM_PRIVATE_KEY

### ❌ `/api/dev/test-email` возвращает 401 Unauthorized

**Причина:** Неверный или отсутствующий `X-Setup-Token` заголовок.

**Решение:**

1. Убедитесь что `SETUP_TOKEN` задан в `.env`
2. Передайте токен в заголовке: `-H "X-Setup-Token: your-token-here"`

### ❌ Endpoint `/api/dev/test-email` не найден (404)

**Причина:** Endpoint работает только в dev mode или с `SETUP_TOKEN`.

**Решение:**

- Локально: `npm run dev`
- Production: endpoint доступен только если `SETUP_TOKEN` задан в Cloudflare Workers env

### ❌ MailChannels возвращает ошибку 403/401

**Возможные причины:**

1. **Неверный DKIM ключ**
   - Проверьте формат `DKIM_PRIVATE_KEY` (должен быть PEM с `\n`)

2. **Домен не верифицирован**
   - MailChannels может требовать верификацию домена
   - Проверьте документацию: https://mailchannels.zendesk.com/hc/en-us

3. **Rate limit**
   - Слишком много запросов за короткое время
   - Используйте батчинг (`EMAIL_BULK_CHUNK` и `EMAIL_BULK_PAUSE_MS`)

### ⚠️ Работа с существующей корпоративной почтой

**Вопрос:** У домена `kolibri-dresden.de` уже работает корпоративная почта (например, `info@kolibri-dresden.de`). Что делать?

**Ответ:** Настройка DNS безопасна, **если делать правильно**:

#### Безопасные действия (не влияют на существующую почту):

✅ **DKIM (селектор `mailchannels._domainkey`)** - создаётся отдельно от существующих DKIM-записей:

- Существующие DKIM: `google._domainkey`, `default._domainkey` и т.д.
- Новый DKIM для приложения: `mailchannels._domainkey`
- Они **не конфликтуют** друг с другом

✅ **DMARC (`_dmarc`)** - если создаёте с политикой `p=none`:

- Только мониторинг, не блокирует письма
- Применяется ко всему домену (и к `info@`, и к `Berufsorientierung@`)

#### Действия требующие осторожности:

⚠️ **SPF** - у домена может быть **только одна** SPF-запись:

- **ПРАВИЛЬНО:** Дополнить существующую запись
  ```
  v=spf1 include:_spf.google.com include:relay.mailchannels.net ~all
  ```
- **НЕПРАВИЛЬНО:** Создать вторую SPF-запись (сломает почту!)
- **НЕПРАВИЛЬНО:** Удалить существующие `include:` (сломает корпоративную почту!)

⚠️ **DMARC с строгой политикой** (`p=quarantine` или `p=reject`):

- Если DMARC уже существует со строгой политикой, письма от приложения могут блокироваться до завершения настройки DKIM/SPF
- **Решение:** Временно смягчите политику до `p=none` на время тестирования

#### Рекомендуемый порядок действий:

1. **Проверьте текущие DNS-записи:**

   ```bash
   nslookup -type=TXT kolibri-dresden.de
   nslookup -type=TXT _dmarc.kolibri-dresden.de
   ```

2. **Создайте DKIM для MailChannels** (безопасно, не влияет на существующую почту)

3. **Обновите SPF** (ДОБАВЬТЕ `include:relay.mailchannels.net`, не удаляйте существующие)

4. **Проверьте/создайте DMARC** с мягкой политикой (`p=none`)

5. **Тестируйте:**
   - Отправьте письмо через `/api/dev/test-email`
   - Проверьте что SPF/DKIM/DMARC проходят
   - **Убедитесь что корпоративная почта (`info@`) всё ещё работает**

#### Альтернатива: Поддомен

Если боитесь что-то сломать, используйте поддомен:

**Пример:** `app.kolibri-dresden.de` или `events.kolibri-dresden.de`

**Преимущества:**

- ✅ Полностью изолированные DNS-записи
- ✅ Можно экспериментировать безопасно
- ✅ Не влияет на корпоративную почту

**Недостаток:**

- Email будет от `Berufsorientierung@app.kolibri-dresden.de` вместо `Berufsorientierung@kolibri-dresden.de`

### 📚 Полезные ссылки

- **MailChannels Documentation:** https://mailchannels.zendesk.com/hc/en-us
- **SPF Record Syntax:** https://www.rfc-editor.org/rfc/rfc7208.html
- **DKIM Specification:** https://www.rfc-editor.org/rfc/rfc6376.html
- **DMARC Guide:** https://dmarc.org/overview/
- **MXToolbox (тестирование DNS):** https://mxtoolbox.com/
- **Mail-Tester (проверка deliverability):** https://www.mail-tester.com/

---

## 🎯 Итоговый результат

После выполнения всех шагов:

✅ Все письма от `Berufsorientierung@kolibri-dresden.de` будут:

- Проходить SPF/DKIM/DMARC проверки
- Попадать в inbox (не в spam)
- Иметь доверенную подпись DKIM
- Отображаться корректно в клиентах (Gmail, Outlook и т.д.)

✅ Вы сможете:

- Отслеживать DMARC отчёты (на `postmaster@kolibri-dresden.de`)
- Тестировать отправку через `/api/dev/test-email`
- Автоматически проверять DNS через `scripts/check-dns.mjs`
- Постепенно ужесточать DMARC политику для максимальной защиты

**Готово к production! 🚀**
