# Quick Reference: Activity Log Action Types

## 16 типов действий в системе

### Действия пользователей (6 типов)

| Тип действия          | Когда использовать                  | Пример details                             |
| --------------------- | ----------------------------------- | ------------------------------------------ |
| `user_register`       | При регистрации нового пользователя | `{ email: "user@example.com" }`            |
| `user_login`          | При успешном входе в систему        | `null` или `{ method: "password" }`        |
| `user_logout`         | При выходе из системы               | `null`                                     |
| `user_update_profile` | При обновлении профиля пользователя | `{ changed_fields: ["phone", "address"] }` |
| `user_delete_request` | При запросе на удаление аккаунта    | `{ deletion_date: "2025-11-20" }`          |
| `user_deleted`        | При фактическом удалении аккаунта   | `{ archived: true }`                       |

### Действия с мероприятиями - Админ (5 типов)

| Тип действия    | Когда использовать                          | Пример details                                                      |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `event_create`  | При создании нового мероприятия             | `{ event_id: 42, title: "Workshop" }`                               |
| `event_update`  | При обновлении мероприятия                  | `{ event_id: 42, changed_fields: ["max_participants"] }`            |
| `event_delete`  | При удалении мероприятия                    | `{ event_id: 42, title: "Cancelled Workshop" }`                     |
| `event_publish` | При публикации мероприятия (draft → active) | `{ event_id: 42, status: "active" }`                                |
| `event_cancel`  | При отмене мероприятия админом              | `{ event_id: 42, reason: "Low registrations", notified_users: 15 }` |

### Действия с записями (2 типа)

| Тип действия          | Когда использовать                     | Пример details                                                        |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `registration_create` | При записи пользователя на мероприятие | `{ event_id: 42, event_title: "Workshop", event_date: "2025-11-15" }` |
| `registration_cancel` | При отмене записи пользователем        | `{ event_id: 42, reason: "Schedule conflict" }`                       |

### Административные действия (3 типа)

| Тип действия      | Когда использовать             | Пример details                                                         |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `admin_add`       | При выдаче прав администратора | `{ added_user_id: 123, added_user_email: "admin@example.com" }`        |
| `admin_remove`    | При отзыве прав администратора | `{ removed_user_id: 123, removed_user_email: "ex-admin@example.com" }` |
| `bulk_email_sent` | При массовой email-рассылке    | `{ recipients_count: 150, event_id: 42, subject: "Event Update" }`     |

---

## Примеры использования

### 1. Регистрация пользователя

```typescript
import { logActivity } from '$lib/server/db';

const newUser = await createUser(db, userData);

await logActivity(
	db,
	newUser.id,
	'user_register',
	JSON.stringify({ email: newUser.email }),
	request.headers.get('cf-connecting-ip') || undefined
);
```

### 2. Вход в систему

```typescript
await logActivity(
	db,
	user.id,
	'user_login',
	null,
	request.headers.get('cf-connecting-ip') || undefined
);
```

### 3. Обновление профиля

```typescript
await updateUser(db, userId, updateData);

await logActivity(
	db,
	userId,
	'user_update_profile',
	JSON.stringify({
		changed_fields: Object.keys(updateData),
		timestamp: new Date().toISOString(),
	}),
	clientIp
);
```

### 4. Запись на мероприятие

```typescript
const registration = await registerUserForEvent(db, userId, eventId, additionalData);
const event = await getEventById(db, eventId);

await logActivity(
	db,
	userId,
	'registration_create',
	JSON.stringify({
		event_id: eventId,
		event_title: event?.title_de,
		event_date: event?.date,
	}),
	clientIp
);
```

### 5. Создание мероприятия (админ)

```typescript
const newEvent = await createEvent(db, eventData, adminUserId);

await logActivity(
	db,
	adminUserId,
	'event_create',
	JSON.stringify({
		event_id: newEvent.id,
		title: newEvent.title_de,
		date: newEvent.date,
	}),
	clientIp
);
```

### 6. Отмена мероприятия (админ)

```typescript
const registrations = await getEventRegistrations(db, eventId);

await cancelEvent(db, eventId, cancellationReason);

// Отправка email всем участникам...

await logActivity(
	db,
	adminUserId,
	'event_cancel',
	JSON.stringify({
		event_id: eventId,
		reason: cancellationReason,
		notified_users: registrations.length,
	}),
	clientIp
);
```

### 7. Выдача прав админа

```typescript
await addAdmin(db, targetUserId, currentAdminId);

await logActivity(
	db,
	currentAdminId,
	'admin_add',
	JSON.stringify({
		added_user_id: targetUserId,
		added_user_email: targetUser.email,
	}),
	clientIp
);
```

### 8. Массовая рассылка (системное действие)

```typescript
// userId = null для системных действий
await logActivity(
	db,
	null,
	'bulk_email_sent',
	JSON.stringify({
		recipients_count: recipients.length,
		event_id: eventId || null,
		subject: emailSubject,
		sent_at: new Date().toISOString(),
	})
);
```

### 9. Запрос на удаление аккаунта

```typescript
await scheduleDeletion(db, userId, deletionDate);

await logActivity(
	db,
	userId,
	'user_delete_request',
	JSON.stringify({
		deletion_date: deletionDate.toISOString(),
		reason: 'User request',
	}),
	clientIp
);
```

### 10. Фактическое удаление аккаунта

```typescript
await archiveUser(db, userId);
await deleteUser(db, userId);

await logActivity(
	db,
	null, // пользователь уже удален
	'user_deleted',
	JSON.stringify({
		deleted_user_id: userId,
		archived: true,
		deletion_method: 'scheduled',
	})
);
```

---

## Получение логов

### По типу действия

```typescript
const loginLogs = await getActivityLog(db, {
	actionType: 'user_login',
	dateFrom: weekAgo.toISOString(),
	limit: 100,
});
```

### По пользователю

```typescript
const userLogs = await getUserActivityLog(db, userId, 50);
```

### Статистика

```typescript
const stats = await getActivityStats(db, monthAgo.toISOString());
// [
//   { action_type: 'user_login', count: 450 },
//   { action_type: 'registration_create', count: 85 },
//   ...
// ]
```

---

## Best Practices

### ✅ DO

- **Всегда логируйте критические действия** (регистрация, вход, запись на мероприятия)
- **Используйте JSON для details** - структурированные данные легче анализировать
- **Включайте IP адрес** - для безопасности и аудита
- **Используйте null для системных действий** - массовая рассылка, cron jobs
- **Храните минимум персональных данных** - только необходимое для контекста

### ❌ DON'T

- **Не логируйте пароли, токены** - GDPR и безопасность
- **Не логируйте полные адреса** - минимизируйте персональные данные
- **Не делайте throw в logActivity** - логирование не должно ломать приложение
- **Не забывайте про IP адрес** - важно для аудита
- **Не дублируйте типы** - используйте единый `ActivityLogActionType`

---

## TypeScript Import

```typescript
// ✅ Правильно
import type { ActivityLogActionType } from '$lib/types';
import { logActivity, getActivityLog } from '$lib/server/db';

// ⚠️ Deprecated (но работает)
import type { ActivityLogAction } from '$lib/types';
```

---

## Структура details (JSON)

### Минимальный вариант

```json
null
```

### Простой вариант

```json
{
	"email": "user@example.com"
}
```

### Расширенный вариант

```json
{
	"event_id": 42,
	"event_title": "Career Workshop",
	"event_date": "2025-11-15T14:00:00Z",
	"additional_data": {
		"dietary_preferences": "vegetarian"
	}
}
```

### Массовая операция

```json
{
	"recipients_count": 150,
	"event_id": 42,
	"subject": "Event Cancelled",
	"sent_at": "2025-10-22T18:15:00Z",
	"batch_size": 50
}
```

---

## Cloudflare IP Address

```typescript
// В SvelteKit endpoint
const clientIp = request.headers.get('cf-connecting-ip') || undefined;

await logActivity(db, userId, actionType, details, clientIp);
```

---

**Последнее обновление:** 2025-10-22
