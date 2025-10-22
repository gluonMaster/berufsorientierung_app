# Berufsorientierung - Система регистрации на мероприятия

Веб-приложение для регистрации участников на мероприятия проекта профориентации молодежи с миграционным прошлым (Kolibri Dresden).

## 🚀 Технологический стек

**Frontend:**

- SvelteKit (TypeScript)
- Tailwind CSS
- svelte-i18n (мультиязычность)

**Backend:**

- Cloudflare Workers (serverless)
- Cloudflare D1 (SQLite база данных)
- Cloudflare R2 (хранилище QR-кодов)

**Библиотеки:**

- Zod (валидация)
- bcryptjs (хеширование паролей)
- jose (JWT токены)
- qrcode (генерация QR-кодов)
- MailChannels (отправка email)

## 📦 Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd berufsorientierung-app

# Установить зависимости
npm install

# Скопировать пример переменных окружения
cp .env.example .env

# Заполнить переменные в .env файле
```

## 🛠️ Разработка

```bash
# Запустить dev сервер
npm run dev

# Открыть браузер на http://localhost:5173
```

## 🧪 Тестирование

```bash
# Запустить тесты
npm test

# Запустить тесты в режиме watch
npm run test:watch

# Открыть UI для тестов
npm run test:ui
```

## 📝 Линтинг и форматирование

```bash
# Проверить код на ошибки
npm run lint

# Форматировать код
npm run format

# Проверить TypeScript типы
npm run check
```

## 🗄️ База данных

### Создание D1 базы данных

```bash
# Создать базу данных в Cloudflare
wrangler d1 create berufsorientierung_db

# Скопировать database_id из вывода в wrangler.toml
```

### Применение миграций

```bash
# Применить миграции локально (для разработки)
wrangler d1 execute berufsorientierung_db --local --file=./migrations/0001_initial.sql

# Применить миграции в продакшн
wrangler d1 execute berufsorientierung_db --file=./migrations/0001_initial.sql
```

## 📦 R2 Storage

### Создание R2 bucket для QR-кодов

```bash
# Создать bucket
wrangler r2 bucket create berufsorientierung-qr-codes

# Обновить wrangler.toml с именем bucket
```

## 🔐 Секреты

```bash
# Установить секреты для продакшн
wrangler secret put JWT_SECRET
wrangler secret put DKIM_PRIVATE_KEY
wrangler secret put SETUP_TOKEN
wrangler secret put CRON_SECRET
```

## 🚀 Деплой

```bash
# Собрать проект
npm run build

# Задеплоить в Cloudflare Workers
npm run deploy

# Или через wrangler напрямую
wrangler deploy
```

## 🌍 Мультиязычность

Поддерживаемые языки:

- 🇩🇪 Немецкий (по умолчанию)
- 🇬🇧 Английский
- 🇷🇺 Русский
- 🇺🇦 Украинский

Переводы находятся в `static/translations/`.

## 📧 Email настройки

### MailChannels (бесплатно через Cloudflare Workers)

1. Настроить SPF запись в DNS:

```
v=spf1 include:_spf.mx.cloudflare.net ~all
```

2. Настроить DKIM (опционально):

- Сгенерировать ключи
- Добавить публичный ключ в DNS
- Добавить приватный ключ в секреты Cloudflare

3. Настроить DMARC запись:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@kolibri-dresden.de
```

## 📁 Структура проекта

```
berufsorientierung-app/
├── src/
│   ├── routes/              # SvelteKit роуты
│   ├── lib/
│   │   ├── components/      # Svelte компоненты
│   │   ├── server/          # Серверный код
│   │   ├── types/           # TypeScript типы
│   │   └── stores/          # Svelte stores
│   └── app.d.ts             # TypeScript декларации
├── static/
│   └── translations/        # i18n переводы
├── migrations/              # SQL миграции
├── tests/                   # Тесты
├── docs/                    # 📚 Документация проекта
│   ├── development/         # Для разработчиков
│   ├── database/            # Документация БД
│   └── features/            # Функционал приложения
├── wrangler.toml           # Cloudflare конфиг
└── .env.example            # Пример переменных окружения
```

## 📚 Документация

Полная документация проекта находится в папке [`docs/`](./docs/):

- **[docs/README.md](./docs/README.md)** - Главная страница документации
- **[docs/development/](./docs/development/)** - Документация для разработчиков
- **[docs/database/](./docs/database/)** - Описание модулей БД
- **[docs/features/](./docs/features/)** - Функциональные возможности

## 🔒 GDPR Compliance

- Пользователи могут удалить свой профиль
- Автоматическое удаление через 28 дней после последнего мероприятия
- Минимальная архивация данных для отчетности
- Явное согласие на обработку данных
- Согласие на фото/видео съемку (опционально)

## 📱 Мобильная адаптация

- Mobile-first подход
- Минимальная высота кнопок: 44px
- Минимальный размер текста: 16px
- Адаптивные таблицы и формы

## 👥 Команда

Разработано для **Kolibri Dresden**

## 📄 Лицензия

[Указать лицензию]
