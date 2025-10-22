# 📚 Документация проекта Berufsorientierung App

Добро пожаловать в документацию проекта! Все материалы организованы по категориям для удобного поиска.

## 📂 Структура документации

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

#### Интернационализация ([features/i18n/](./features/i18n/))

- [SETUP.md](./features/i18n/SETUP.md) - Настройка i18n
- [STORE.md](./features/i18n/STORE.md) - Store для языков

#### Валидация ([features/validation/](./features/validation/))

- [README.md](./features/validation/README.md) - Схемы валидации

#### Хранилище ([features/storage/](./features/storage/))

- [R2.md](./features/storage/R2.md) - Cloudflare R2 Storage

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

- **Мультиязычность**: [features/i18n/](./features/i18n/)
- **Загрузка файлов**: [features/storage/R2.md](./features/storage/R2.md)
- **Валидация**: [features/validation/README.md](./features/validation/README.md)

---

## 📝 Соглашения

- **README.md** - основная документация модуля
- **CHANGELOG.md** - история изменений
- **EXAMPLES.md** - примеры использования
- **QUICK_REFERENCE.md** - краткий справочник

---

**Последнее обновление**: 2025-10-22
