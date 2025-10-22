# GDPR Module - Quick Reference

Быстрый справочник по функциям модуля GDPR Compliance.

## 📋 Основные константы

```typescript
const GDPR_RETENTION_DAYS = 28; // Дней после последнего мероприятия
```

## 🔍 Проверка возможности удаления

```typescript
const result = await canDeleteUser(db, userId);
// → { canDelete: boolean, reason?: string, deleteDate?: string }
```

**Когда `canDelete = true`:**

- ✅ Нет активных регистраций
- ✅ Все мероприятия в прошлом И прошло >= 28 дней

**Когда `canDelete = false`:**

- ❌ Есть предстоящие мероприятия
- ❌ Прошло < 28 дней после последнего мероприятия

## 📅 Планирование удаления

```typescript
const deleteDate = await scheduleUserDeletion(db, userId);
// → "2025-11-19T12:00:00.000Z" (ISO string)
// ✅ Аккаунт АВТОМАТИЧЕСКИ заблокирован (is_blocked = 1)
```

**Выполняет атомарно через `db.batch()`:**

```sql
-- 1. Создает запись
INSERT INTO pending_deletions (user_id, deletion_date, created_at)
VALUES (?, ?, datetime('now'));

-- 2. Блокирует аккаунт
UPDATE users SET is_blocked = 1 WHERE id = ?;
```

**Выбрасывает ошибку если:**

- ⚠️ Пользователь уже может быть удален немедленно
- ⚠️ Удаление уже запланировано

## 💾 Архивация данных

```typescript
await archiveUserGDPR(db, userId);
```

**Сохраняет в `deleted_users_archive` (только завершенные мероприятия):**

```json
{
	"first_name": "John",
	"last_name": "Doe",
	"registered_at": "2025-01-15T10:00:00.000Z",
	"deleted_at": "2025-10-22T14:30:00.000Z",
	"events_participated": [
		{
			"eventId": 5,
			"title": "Career Workshop",
			"date": "2025-09-20" // ✅ Только date <= NOW
		}
	]
}
```

**Фильтрация:**

```sql
WHERE cancelled_at IS NULL  -- Не отмененные
  AND date <= datetime('now')  -- Завершенные
```

## 🗑️ Полное удаление

```typescript
await deleteUserCompletely(db, userId);
```

**Удаляет из всех таблиц (атомарно):**

| Таблица                 | Действие                |
| ----------------------- | ----------------------- |
| `deleted_users_archive` | ➕ Добавляет запись     |
| `admins`                | ❌ Удаляет (если есть)  |
| `registrations`         | ❌ Удаляет все записи   |
| `pending_deletions`     | ❌ Удаляет (если есть)  |
| `activity_log`          | 🔄 Обнуляет `user_id`   |
| `users`                 | ❌ Удаляет пользователя |

## ⏰ Автоматическая обработка (Cron)

```typescript
const deletedCount = await processScheduledDeletions(db);
// → 3 (количество удаленных пользователей)
```

**Обрабатывает записи где:**

```sql
deletion_date <= datetime('now')
```

## 📊 Список запланированных удалений

```typescript
const scheduled = await getScheduledDeletions(db);
// → PendingDeletionWithUser[]
```

**Структура данных:**

```typescript
{
  id: 1,
  user_id: 123,
  deletion_date: "2025-11-19T12:00:00.000Z",
  created_at: "2025-10-22T10:00:00.000Z",
  user_email: "user@example.com",
  user_first_name: "John",
  user_last_name: "Doe",
  last_event_date: "2025-09-20"
}
```

## 🎯 Типичные сценарии

### 1️⃣ Пользователь запрашивает удаление

```typescript
// Проверяем
const check = await canDeleteUser(db, userId);

if (check.canDelete) {
	// Удаляем немедленно
	await deleteUserCompletely(db, userId);
} else {
	// Планируем (автоматически блокирует аккаунт)
	const deleteDate = await scheduleUserDeletion(db, userId);
	// ✅ Блокировка уже выполнена
}
```

### 2️⃣ Админ просматривает очередь

```typescript
const scheduled = await getScheduledDeletions(db);

scheduled.forEach((item) => {
	console.log(`${item.user_email} → ${item.deletion_date}`);
});
```

### 3️⃣ Cron удаляет просроченные

```typescript
// В Cloudflare Worker
export default {
	async scheduled(event, env) {
		const count = await processScheduledDeletions(env.DB);
		console.log(`Deleted ${count} accounts`);
	},
};
```

## ⚠️ Важные моменты

### Безопасность

```typescript
// ✅ ПРАВИЛЬНО - всегда проверяем перед удалением
const check = await canDeleteUser(db, userId);
if (check.canDelete) {
	await deleteUserCompletely(db, userId);
}

// ❌ НЕПРАВИЛЬНО - можем удалить преждевременно
await deleteUserCompletely(db, userId);
```

### Атомарность

Все операции в `deleteUserCompletely` выполняются через `db.batch()`:

```typescript
const results = await db.batch([
	archiveStatement,
	deleteAdminsStatement,
	deleteRegistrationsStatement,
	// ...
]);

// Если хотя бы одна не удалась - откат всех
```

### Логирование

Всегда логируйте действия:

```typescript
await logActivity(db, {
	user_id: userId,
	action_type: 'user_deleted',
	details: { automated: true },
});
```

## 🔗 Связанные типы

```typescript
import type {
	PendingDeletion,
	PendingDeletionWithUser,
	DeletedUserArchive,
} from '$lib/types/admin';

import type { CanDeleteUserResult } from '$lib/server/db/gdpr';
```

## 📝 SQL Queries

### Проверка статуса пользователя

```sql
-- Последнее мероприятие
SELECT e.date
FROM registrations r
INNER JOIN events e ON r.event_id = e.id
WHERE r.user_id = ?
  AND r.cancelled_at IS NULL
ORDER BY e.date DESC
LIMIT 1;

-- Запланированное удаление
SELECT * FROM pending_deletions
WHERE user_id = ?;

-- Архив
SELECT * FROM deleted_users_archive
WHERE first_name = ? AND last_name = ?;
```

## 🛠️ Отладка

### Включить подробное логирование

```typescript
// В начале функций
console.log('[GDPR] Operation started:', { userId, action: 'delete' });

// Результаты
console.log('[GDPR] Result:', result);
```

### Проверить состояние БД

```typescript
// Pending deletions
const pending = await db.prepare('SELECT COUNT(*) FROM pending_deletions').first();

// Archive
const archived = await db.prepare('SELECT COUNT(*) FROM deleted_users_archive').first();

console.log(`Pending: ${pending}, Archived: ${archived}`);
```

## 📚 Дополнительно

- **Полная документация:** `docs/database/gdpr/README.md`
- **История изменений:** `docs/database/gdpr/CHANGELOG.md`
- **Примеры использования:** `docs/database/gdpr/EXAMPLES.md` (будет создан)
