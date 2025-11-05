# GDPR Module Changelog

История изменений модуля GDPR Compliance.

## [1.0.1] - 2025-10-22

### Исправления

#### Изменено

- ✅ **`scheduleUserDeletion`**: Теперь автоматически блокирует пользователя (`is_blocked = 1`) через `db.batch()`
  - До: требовался отдельный вызов `blockUser()`
  - После: блокировка выполняется атомарно вместе с созданием записи в `pending_deletions`
- ✅ **`archiveUser`**: Добавлена фильтрация архивируемых событий
  - Только завершенные мероприятия: `cancelled_at IS NULL AND date <= datetime('now')`
  - Исключаются отмененные регистрации и будущие мероприятия
- ✅ **`deleteUserCompletely`**: Обновлен подзапрос архивации
  - Та же фильтрация: только завершенные мероприятия
- ✅ **`users.ts/archiveUser`**: Унификация с GDPR-модулем
  - Изменен формат с строки на JSON: `[{ eventId, title, date }]`
  - Добавлена фильтрация завершенных мероприятий
  - Добавлен `@deprecated` тег с рекомендацией использовать `archiveUserGDPR`

#### Документация

- ✅ Обновлены JSDoc комментарии всех затронутых функций
- ✅ Обновлены примеры в `README.md` (убран лишний вызов `blockUser`)
- ✅ Добавлены пояснения о фильтрации в документацию

---

## [1.0.0] - 2025-10-22

### Создание модуля

#### Добавлено

- ✅ `canDeleteUser(db, userId)` - проверка возможности удаления пользователя
- ✅ `scheduleUserDeletion(db, userId)` - планирование удаления на будущее
- ✅ `archiveUser(db, userId)` - архивация минимальных данных (GDPR compliant)
- ✅ `deleteUserCompletely(db, userId)` - полное удаление пользователя с зависимостями
- ✅ `processScheduledDeletions(db)` - автоматическая обработка запланированных удалений (для Cron)
- ✅ `getScheduledDeletions(db)` - получение списка запланированных удалений

#### Технические детали

**Атомарность:**

- Использование `db.batch()` для транзакционных операций в `deleteUserCompletely`
- Все SQL операции выполняются атомарно

**Архивация данных:**

- Формат: JSON массив `[{ eventId, title, date }]` для `events_participated`
- Минимальный набор: имя, фамилия, даты, список мероприятий

**Логика 28 дней:**

- Константа `GDPR_RETENTION_DAYS = 28`
- Проверка последнего мероприятия (предстоящего или прошедшего)
- Автоматический расчет `deletion_date`

**Безопасность:**

- Проверка существования пользователя перед удалением
- Валидация наличия запланированных удалений
- Обработка ошибок с откатом транзакций

#### Интеграция

**Экспорт в `src/lib/server/db/index.ts`:**

```typescript
export {
	canDeleteUser,
	scheduleUserDeletion,
	archiveUser as archiveUserGDPR,
	deleteUserCompletely,
	processScheduledDeletions,
	getScheduledDeletions,
} from './gdpr';

export type { CanDeleteUserResult } from './gdpr';
```

**Типы (`src/lib/types/admin.ts`):**

- `PendingDeletion` - запланированное удаление
- `PendingDeletionWithUser` - с информацией о пользователе
- `DeletedUserArchive` - архив удаленных пользователей

#### Документация

- ✅ Создан `docs/database/gdpr/README.md`
- ✅ Добавлены примеры использования для всех функций
- ✅ Описаны 3 типичных сценария (запрос пользователя, админ-панель, Cron)
- ✅ Документирована безопасность и атомарность операций

#### Зависимости

**SQL таблицы:**

- `pending_deletions` (id, user_id, deletion_date, created_at)
- `deleted_users_archive` (id, first_name, last_name, registered_at, deleted_at, events_participated)

**Связанные модули:**

- `users.ts` - получение данных пользователя
- `activityLog.ts` - логирование действий удаления
- `registrations.ts` - проверка мероприятий

#### Тестирование

**Рекомендуемые unit-тесты:**

```typescript
describe('GDPR Module', () => {
	test('canDeleteUser - no registrations', async () => {
		const result = await canDeleteUser(db, userWithNoEvents);
		expect(result.canDelete).toBe(true);
	});

	test('canDeleteUser - upcoming events', async () => {
		const result = await canDeleteUser(db, userWithUpcomingEvent);
		expect(result.canDelete).toBe(false);
		expect(result.deleteDate).toBeDefined();
	});

	test('canDeleteUser - 28+ days passed', async () => {
		const result = await canDeleteUser(db, userWithOldEvent);
		expect(result.canDelete).toBe(true);
	});

	test('scheduleUserDeletion - creates pending deletion', async () => {
		const deleteDate = await scheduleUserDeletion(db, userId);
		const pending = await getScheduledDeletions(db);
		expect(pending).toHaveLength(1);
	});

	test('deleteUserCompletely - removes all data', async () => {
		await deleteUserCompletely(db, userId);

		const user = await getUserById(db, userId);
		expect(user).toBeNull();

		const archive = await db.prepare('SELECT * FROM deleted_users_archive WHERE id = 1').first();
		expect(archive).toBeDefined();
	});

	test('processScheduledDeletions - processes expired', async () => {
		const count = await processScheduledDeletions(db);
		expect(count).toBeGreaterThan(0);
	});
});
```

### Следующие шаги

- [x] Создать API endpoints для запроса удаления (`/api/profile/delete`)
- [ ] Настроить Cloudflare Cron Trigger в `wrangler.toml`
- [ ] Добавить UI для админ-панели (список запланированных удалений)
- [ ] Реализовать email уведомления при удалении
- [ ] Добавить integration tests

---

## [1.1.0] - 2025-11-05

### Добавлено

#### API Endpoint: DELETE Profile

- ✅ **`POST /api/profile/delete`** - Удаление профиля пользователя
  - Файл: `src/routes/api/profile/delete/+server.ts`
  - Автоматическая проверка возможности удаления через `DB.gdpr.canDeleteUser`
  - Немедленное удаление если прошло >= 28 дней после последнего мероприятия
  - Запланированное удаление с немедленной блокировкой аккаунта
  - Автоматическая очистка auth cookie (разлогин пользователя)
  - Полное логирование всех действий в `activity_log`

**Новые типы действий в ActivityLog:**

```typescript
| 'profile_deleted_immediate'     // Немедленное удаление профиля
| 'profile_deletion_scheduled'    // Запланированное удаление (аккаунт заблокирован)
| 'profile_deletion_failed'       // Ошибка при удалении
```

**Логика endpoint:**

1. Требует авторизации (`requireAuth`)
2. Проверяет возможность удаления (`DB.gdpr.canDeleteUser`)
3. **Если можно удалить немедленно:**
   - Вызывает `DB.gdpr.deleteUserCompletely`
   - Логирует `profile_deleted_immediate` с user_id = null
   - Очищает auth cookie
   - Возвращает `{ deleted: true, immediate: true }`
4. **Если нельзя удалить сейчас:**
   - Вызывает `DB.gdpr.scheduleUserDeletion` (автоматически блокирует is_blocked = 1)
   - Логирует `profile_deletion_scheduled`
   - Очищает auth cookie
   - Возвращает `{ deleted: true, immediate: false, deletionDate }`

**Коды ответов:**

- `200` - Успешное удаление (немедленное или запланированное)
- `401` - Пользователь не авторизован
- `500` - Ошибка сервера

**Пример response (немедленное):**

```json
{
	"deleted": true,
	"immediate": true
}
```

**Пример response (запланированное):**

```json
{
	"deleted": true,
	"immediate": false,
	"deletionDate": "2025-12-05T10:00:00.000Z"
}
```

**Заголовки ответа:**

```
Set-Cookie: auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure
```

#### Документация

- ✅ Обновлен `docs/database/gdpr/README.md` - добавлена секция "API Endpoints"
- ✅ Полное описание endpoint с примерами использования
- ✅ Документированы все коды ответов и форматы логирования
- ✅ Добавлены примеры fetch запросов из клиента

#### Типы

- ✅ Обновлен `src/lib/types/admin.ts` - добавлены новые ActivityLogActionType:
  - `profile_deleted_immediate`
  - `profile_deletion_scheduled`
  - `profile_deletion_failed`

### Технические детали

**Безопасность:**

- Используется `requireAuth` middleware для проверки авторизации
- IP адрес клиента записывается в логи через `getClientIP(request)`
- Auth cookie очищается с флагами `HttpOnly`, `Secure`, `SameSite=Strict`

**Обработка ошибок:**

- Все ошибки логируются в `activity_log` с типом `profile_deletion_failed`
- Детали ошибок включают: тип операции (immediate/scheduled), сообщение об ошибке
- Catch блоки для каждого этапа удаления

**Логирование:**

При немедленном удалении:

```json
{
	"action_type": "profile_deleted_immediate",
	"details": {
		"deleted_user_id": 123,
		"email": "user@example.com",
		"reason": "immediate_deletion"
	}
}
```

При запланированном удалении:

```json
{
	"action_type": "profile_deletion_scheduled",
	"details": {
		"deletion_date": "2025-12-05T10:00:00.000Z",
		"reason": "User has upcoming events",
		"account_blocked": true
	}
}
```

### Интеграция

**Импорты:**

```typescript
import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { DB } from '$lib/server/db';
import { clearAuthCookie } from '$lib/server/auth';
```

**Использование в клиенте:**

```typescript
async function deleteProfile() {
	const response = await fetch('/api/profile/delete', {
		method: 'POST',
		credentials: 'include',
	});

	if (response.ok) {
		const data = await response.json();
		// Обработка ответа
	}
}
```

### Важные замечания

- ⚠️ После вызова endpoint пользователь **ВСЕГДА** разлогинен
- ⚠️ Если удаление запланировано, аккаунт **немедленно блокируется**
- ⚠️ Заблокированные пользователи не могут авторизоваться (проверка в `getUserFromRequest`)
- ✅ Endpoint идемпотентен - повторный вызов не создает дубликатов

### Связанные файлы

- `src/routes/api/profile/delete/+server.ts` - реализация endpoint
- `src/lib/types/admin.ts` - типы ActivityLogActionType
- `src/lib/server/db/gdpr.ts` - функции удаления
- `docs/database/gdpr/README.md` - документация

---

---

## Формат версий

Используется [Semantic Versioning](https://semver.org/):

- **MAJOR** - несовместимые изменения API
- **MINOR** - добавление функционала с обратной совместимостью
- **PATCH** - исправления багов

## Категории изменений

- **Добавлено** - новый функционал
- **Изменено** - изменения существующего функционала
- **Устарело** - функции, которые будут удалены в будущем
- **Удалено** - удаленный функционал
- **Исправлено** - исправления багов
- **Безопасность** - исправления уязвимостей
