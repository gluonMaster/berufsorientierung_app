# 📚 Документация проекта Berufsorientierung App

Добро пожаловать в документацию проекта! Все материалы организованы по категориям для удобного поиска.

## 🚀 Быстрый старт

- **[DEPLOYMENT.md](./development/DEPLOYMENT.md)** - 📦 Полное руководство по развертыванию на Cloudflare Workers
- **[Email Setup](./features/email/DEPLOYMENT.md)** - 📧 Настройка DNS (SPF/DKIM/DMARC)

## �📂 Структура документации

### 🔧 Разработка ([development/](./development/))

Документация для разработчиков проекта.

- [PROGRESS.md](./development/PROGRESS.md) - История развития проекта
- [TYPE_SYSTEM.md](./development/TYPE_SYSTEM.md) - Система типов TypeScript
- **fixes/** - История исправлений
  - [ADMIN_ACTIVITYLOG.md](./development/fixes/ADMIN_ACTIVITYLOG.md) - Исправления админ-логов
  - [REPORT_EVENTS.md](./development/fixes/REPORT_EVENTS.md) - Исправления событий

---

### 🗄️ База данных ([database/](./database/))

Документация по модулям работы с базой данных.

#### Activity Log ([database/activitylog/](./database/activitylog/))

- [README.md](./database/activitylog/README.md) - Описание модуля логирования
- [QUICK_REFERENCE.md](./database/activitylog/QUICK_REFERENCE.md) - Быстрый справочник
- [EXAMPLES.md](./database/activitylog/EXAMPLES.md) - Примеры использования
- [CHANGELOG.md](./database/activitylog/CHANGELOG.md) - История изменений

#### Администраторы ([database/admin/](./database/admin/))

- [README.md](./database/admin/README.md) - Описание модуля администраторов

#### Мероприятия ([database/events/](./database/events/))

- [README.md](./database/events/README.md) - Описание модуля мероприятий
- [EVENTFIELDS.md](./database/events/EVENTFIELDS.md) - Дополнительные поля
- [CHANGELOG.md](./database/events/CHANGELOG.md) - История изменений

#### Регистрации ([database/registrations/](./database/registrations/))

- [README.md](./database/registrations/README.md) - Описание модуля регистраций
- [CHANGELOG.md](./database/registrations/CHANGELOG.md) - История изменений

#### Пользователи ([database/users/](./database/users/))

- [README.md](./database/users/README.md) - Описание модуля пользователей
- [CHANGELOG.md](./database/users/CHANGELOG.md) - История изменений

---

### ⚙️ Функционал ([features/](./features/))

Документация по функциональным возможностям приложения.

#### Аутентификация ([features/auth/](./features/auth/))

- [README.md](./features/auth/README.md) - Полная документация модуля аутентификации

#### Интернационализация ([features/i18n/](./features/i18n/))

- [SETUP.md](./features/i18n/SETUP.md) - Настройка i18n
- [STORE.md](./features/i18n/STORE.md) - Store для языков

#### Валидация ([features/validation/](./features/validation/))

- [README.md](./features/validation/README.md) - Схемы валидации

#### Хранилище ([features/storage/](./features/storage/))

- [README.md](./features/storage/README.md) - Обзор модуля storage
- [R2.md](./features/storage/R2.md) - Cloudflare R2 Storage (загрузка/удаление файлов)
- [QR.md](./features/storage/QR.md) - Генерация QR-кодов для Telegram/WhatsApp

#### Email ([features/email/](./features/email/))

- [README.md](./features/email/README.md) - Основная документация модуля email
- [MAILCHANNELS.md](./features/email/MAILCHANNELS.md) - Настройка MailChannels и DNS

#### Безопасность ([features/security/](./features/security/))

- [CSRF.md](./features/security/CSRF.md) - CSRF защита (double-submit cookie)
- [TURNSTILE.md](./features/security/TURNSTILE.md) - Cloudflare Turnstile (защита от ботов)
- [QUICK_REFERENCE.md](./features/security/QUICK_REFERENCE.md) - Быстрый справочник безопасности

#### UI Компоненты ([features/ui/](./features/ui/))

- [README.md](./features/ui/README.md) - Полная документация всех компонентов
- [QUICK_REFERENCE.md](./features/ui/QUICK_REFERENCE.md) - Быстрый справочник
- [EXAMPLES.md](./features/ui/EXAMPLES.md) - Практические примеры
- [CHANGELOG.md](./features/ui/CHANGELOG.md) - История изменений

#### Cron Триггеры ([features/cron/](./features/cron/))

- [README.md](./features/cron/README.md) - Cloudflare Cron для автоматического удаления пользователей

---

## 🔍 Быстрая навигация

### Для разработчиков

- **Начать работу**: [PROGRESS.md](./development/PROGRESS.md)
- **Типы данных**: [TYPE_SYSTEM.md](./development/TYPE_SYSTEM.md)
- **Последние исправления**: [development/fixes/](./development/fixes/)

### Для работы с БД

- **Логирование**: [database/activitylog/](./database/activitylog/)
- **События**: [database/events/](./database/events/)
- **Пользователи**: [database/users/](./database/users/)

### Для функционала

- **Аутентификация**: [features/auth/README.md](./features/auth/README.md)
- **Мультиязычность**: [features/i18n/](./features/i18n/)
- **Безопасность**: [features/security/](./features/security/)
  - [CSRF Protection](./features/security/CSRF.md) - Защита от CSRF атак
  - [Turnstile](./features/security/TURNSTILE.md) - Защита от ботов
- **UI Компоненты**: [features/ui/README.md](./features/ui/README.md)
  - [Quick Reference](./features/ui/QUICK_REFERENCE.md) - Быстрый справочник
  - [Examples](./features/ui/EXAMPLES.md) - Примеры использования
- **Загрузка файлов**: [features/storage/README.md](./features/storage/README.md)
  - [R2 Storage](./features/storage/R2.md) - Базовые утилиты
  - [QR Codes](./features/storage/QR.md) - Генерация QR-кодов
- **Email отправка**: [features/email/README.md](./features/email/README.md)
- **Валидация**: [features/validation/README.md](./features/validation/README.md)
- **Cron триггеры**: [features/cron/README.md](./features/cron/README.md)
  - Автоматическое удаление пользователей
  - Настройка через Cloudflare / внешние сервисы
  - Ручной запуск для тестирования

---

## 📝 Соглашения

- **README.md** - основная документация модуля
- **CHANGELOG.md** - история изменений
- **EXAMPLES.md** - примеры использования
- **QUICK_REFERENCE.md** - краткий справочник

---

**Последнее обновление**: 2025-11-20
