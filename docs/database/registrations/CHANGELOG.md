# Changelog - Registrations Module

История изменений модуля работы с записями на мероприятия.

## [1.1.0] - 2025-10-22 (Обновление после ревью)

### ✅ Добавлено

- **`parseAdditionalData()`** - Безопасный парсинг JSON дополнительных данных
  - Type-safe возврат `Record<string, unknown> | null`
  - Проверка что результат - объект (не массив/примитив)
  - Обработка ошибок парсинга

### 🧪 Тестирование

- **Создан файл `tests/unit/db-registrations.test.ts`** с 17 юнит-тестами:
  - ✅ 3 теста для логики реактивации
  - ✅ 9 тестов для `parseAdditionalData()`
  - ✅ 2 теста для валидации структуры Registration
  - ✅ 1 тест для UNIQUE constraint сценариев
  - ✅ 2 теста для трансформации дополнительных данных

### 🔄 Изменено

- **`registerUserForEvent()`** - Добавлена реактивация отменённых записей
  - **CRITICAL FIX**: Теперь обходит UNIQUE constraint на (user_id, event_id)
  - Если найдена отменённая запись (cancelled_at IS NOT NULL), выполняется UPDATE вместо INSERT
  - Реактивация очищает cancelled_at, cancellation_reason
  - Обновляет registered_at и additional_data
  - Возвращает ту же запись (сохраняется ID)

### 📝 Документация

- Обновлён README.md с описанием реактивации
- Добавлены примеры использования `parseAdditionalData()`
- Уточнены JSDoc комментарии

## [1.0.0] - 2025-10-22 (Начальная версия)

### ✅ Добавлено

#### Функции создания и отмены

- **`registerUserForEvent()`** - Регистрация пользователя на мероприятие
  - Полная валидация всех условий (пользователь, мероприятие, места, дедлайн)
  - Проверка что пользователь не заблокирован
  - Проверка что мероприятие активно
  - Проверка наличия свободных мест
  - Проверка дедлайна регистрации
  - Проверка что пользователь не имеет активной записи
  - Сохранение дополнительных данных в формате JSON
- **`cancelRegistration()`** - Отмена записи на мероприятие
  - Soft delete (устанавливает cancelled_at, не удаляет запись)
  - Проверка временного ограничения (>3 дней до мероприятия)
  - Сохранение причины отмены

#### Функции получения данных

- **`getUserRegistrations()`** - Все записи пользователя
  - JOIN с таблицей events
  - Включает активные и отменённые записи
  - Сортировка: предстоящие первыми, потом прошедшие
  - Возвращает тип `RegistrationWithEvent[]`
- **`getEventRegistrations()`** - Все активные участники мероприятия
  - JOIN с таблицей users
  - Только активные записи (cancelled_at IS NULL)
  - Не возвращает password_hash (безопасность)
  - Возвращает тип `RegistrationWithUser[]`
- **`getRegistrationCount()`** - Количество активных участников
  - Быстрый подсчёт для проверки мест
  - WHERE cancelled_at IS NULL
- **`isUserRegistered()`** - Проверка статуса регистрации
  - Булево значение для быстрой проверки
  - Только активные записи
- **`getRegistrationById()`** - Получение записи по ID
  - Базовая функция для детального просмотра

#### Вспомогательные утилиты

- **`nowSql()`** - Генерация timestamp в формате YYYY-MM-DDTHH:MM:SS
- **`normalizeTimestamp()`** - Нормализация timestamp из SQLite
- **`rowToRegistration()`** - Преобразование DB row в объект Registration

### 📋 Типизация

- Все функции с полной TypeScript типизацией
- Интерфейс `DBRegistrationRow` для строк из БД
- Использование типов из `$lib/types/registration`
- Использование типов из `$lib/types/user`
- Использование типов из `$lib/types/event`

### 🔒 Безопасность

- Все запросы через prepared statements (защита от SQL injection)
- Валидация на уровне БД перед созданием/изменением
- Не возвращаем password_hash в getEventRegistrations
- Проверка is_blocked перед регистрацией

### 📝 Документация

- Создан README.md с полным описанием
- JSDoc комментарии для всех функций (на русском)
- Примеры использования для каждой функции
- Описание типичных сценариев
- Раздел "Важные замечания"

### 🔗 Интеграция

- Экспортировано в `src/lib/server/db/index.ts`
- Зависимости от модулей:
  - `users.ts` (getUserById)
  - `events.ts` (getEventById)
- Готово к использованию в API routes

### ✅ Соответствие спецификации

Все требования из **Prompt 2.5** выполнены:

1. ✅ `registerUserForEvent()` с валидацией
2. ✅ `cancelRegistration()` с проверкой 3 дней
3. ✅ `getUserRegistrations()` с JOIN и сортировкой
4. ✅ `getEventRegistrations()` с JOIN, без password_hash
5. ✅ `getRegistrationCount()` только активные
6. ✅ `isUserRegistered()` только активные
7. ✅ `getRegistrationById()` базовая функция

## Планы на будущее

### Функционал для админов

- [ ] `cancelEventRegistrations()` - Отмена всех записей при отмене мероприятия
- [ ] `getRegistrationStats()` - Статистика по записям
- [ ] `bulkCancelRegistrations()` - Массовая отмена записей

### Оптимизация

- [ ] Кеширование количества участников
- [ ] Индексы для частых запросов
- [ ] Batch операции для массовых действий

### Email интеграция

- [ ] Автоматическая отправка подтверждения при регистрации
- [ ] Автоматическая отправка при отмене
- [ ] Напоминание за день до мероприятия

### Waitlist функционал

- [ ] Очередь ожидания при отсутствии мест
- [ ] Автоматическое уведомление при освобождении места

## Решённые проблемы

### v1.1.0

**Проблема #1: UNIQUE constraint violation при повторной регистрации**

- **Описание**: БД имеет `UNIQUE(user_id, event_id)`. Если пользователь отменил запись и пытается записаться снова, INSERT падал с ошибкой.
- **Решение**: Реализована логика реактивации. Функция `registerUserForEvent()` проверяет наличие отменённой записи и выполняет UPDATE вместо INSERT.
- **Преимущества**:
  - Сохраняется история (ID не меняется)
  - Нет проблем с UNIQUE constraint
  - Логичное поведение для пользователя

**Проблема #2: Небезопасный парсинг JSON**

- **Описание**: Поле `additional_data` возвращалось как `string | null`, требовало ручного `JSON.parse()` везде.
- **Решение**: Добавлена функция `parseAdditionalData()` с безопасным парсингом и проверкой типов.
- **Преимущества**:
  - Централизованная обработка ошибок
  - Type-safe возврат `Record<string, unknown>`
  - Проверка что результат - объект

## Известные ограничения

1. **Временная зона**: Все даты в UTC, нужно учитывать при сравнении
2. **Soft delete**: Отменённые записи остаются в БД (по дизайну)
3. **Нет транзакций**: D1 пока не поддерживает полноценные транзакции
4. **Лимит JSON**: additional_data не должен превышать 1MB
5. **Реактивация ID**: При реактивации сохраняется старый ID записи

## Миграции

Таблица `registrations` создана в миграции `0001_initial.sql`:

```sql
CREATE TABLE registrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	additional_data TEXT, -- JSON
	registered_at TEXT NOT NULL,
	cancelled_at TEXT,
	cancellation_reason TEXT,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_registrations_status ON registrations(cancelled_at);
```

## Тестирование

### Unit тесты (планируется)

```typescript
// tests/unit/db-registrations.test.ts
describe('registerUserForEvent', () => {
	test('успешная регистрация');
	test('ошибка если пользователь не существует');
	test('ошибка если мероприятие не активно');
	test('ошибка если нет мест');
	test('ошибка если дедлайн истёк');
	test('ошибка если уже записан');
});

describe('cancelRegistration', () => {
	test('успешная отмена');
	test('ошибка если меньше 3 дней до мероприятия');
	test('ошибка если запись не найдена');
});

describe('getUserRegistrations', () => {
	test('возвращает все записи пользователя');
	test('сортировка: предстоящие первыми');
	test('включает отменённые записи');
});

describe('getEventRegistrations', () => {
	test('возвращает только активные записи');
	test('не возвращает password_hash');
	test('JOIN с users работает корректно');
});
```

### Integration тесты (планируется)

```typescript
// tests/integration/registration-flow.test.ts
describe('Registration flow', () => {
	test('полный цикл: регистрация -> отмена');
	test('регистрация на заполненное мероприятие');
	test('регистрация после дедлайна');
});
```

## Связанные файлы

- `src/lib/server/db/registrations.ts` - Основной модуль
- `src/lib/server/db/index.ts` - Экспорт функций
- `src/lib/types/registration.ts` - TypeScript типы
- `migrations/0001_initial.sql` - SQL схема
- `docs/database/registrations/README.md` - Документация

---

**Автор**: GitHub Copilot  
**Дата создания**: 2025-10-22  
**Версия**: 1.0.0  
**Проект**: Berufsorientierung App (Kolibri Dresden)
