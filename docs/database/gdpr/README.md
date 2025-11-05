# GDPR Compliance модуль

## Описание

Модуль для управления удалением пользователей в соответствии с требованиями GDPR (General Data Protection Regulation).

**Файл:** `src/lib/server/db/gdpr.ts`

## Основные принципы

### 1. Право на удаление (Right to be forgotten)

Пользователь имеет право запросить удаление своих персональных данных. Однако для отчетности и логистики мы применяем следующие правила:

- **28 дней** - минимальный срок после последнего мероприятия, через который можно удалить аккаунт
- Если срок не истек - аккаунт **блокируется** и **планируется** к удалению
- Автоматическое удаление через **Cron Trigger** (ежедневно в 02:00)

### 2. Минимальная архивация

При удалении сохраняется минимум данных для отчетности:

```typescript
{
	first_name: string;
	last_name: string;
	registered_at: string; // Дата регистрации
	deleted_at: string; // Дата удаления
	events_participated: [
		// JSON массив
		{
			eventId: number,
			title: string,
			date: string,
		},
	];
}
```

### 3. Полное удаление зависимостей

При удалении очищаются все таблицы:

- ✅ `users` - полное удаление
- ✅ `admins` - удаление (если был админом)
- ✅ `registrations` - удаление всех записей
- ✅ `pending_deletions` - удаление из очереди
- ✅ `activity_log` - обнуление `user_id` (история сохраняется)
- ✅ `deleted_users_archive` - добавление записи

## API Reference

### `canDeleteUser(db, userId)`

Проверяет, можно ли удалить пользователя прямо сейчас.

**Параметры:**

- `db: D1Database` - инстанс базы данных
- `userId: number` - ID пользователя

**Возвращает:** `Promise<CanDeleteUserResult>`

```typescript
interface CanDeleteUserResult {
	canDelete: boolean; // Можно ли удалить сейчас
	reason?: string; // Причина отказа
	deleteDate?: string; // Дата возможного удаления (ISO)
}
```

**Логика:**

1. Получить все активные регистрации (`cancelled_at IS NULL`)
2. Если нет регистраций → `canDelete = true`
3. Если есть предстоящие мероприятия → `canDelete = false`, `deleteDate = последнее + 28 дней`
4. Если все мероприятия в прошлом:
   - Если прошло >= 28 дней → `canDelete = true`
   - Иначе → `canDelete = false`, `deleteDate = последнее + 28 дней`

**Примеры:**

```typescript
const result = await canDeleteUser(db, 123);

if (result.canDelete) {
	// Можно удалить немедленно
	await deleteUserCompletely(db, 123);
} else {
	// Нельзя удалить, показываем причину и дату
	console.log(`Причина: ${result.reason}`);
	console.log(`Можно будет удалить: ${result.deleteDate}`);
}
```

---

### `scheduleUserDeletion(db, userId)`

Планирует удаление пользователя на будущее **и немедленно блокирует доступ**.

**Параметры:**

- `db: D1Database` - инстанс базы данных
- `userId: number` - ID пользователя

**Возвращает:** `Promise<string>` - дата удаления (ISO string)

**Выбрасывает:**

- `Error` - если пользователь уже может быть удален немедленно
- `Error` - если удаление уже запланировано

**Что делает (атомарно через `db.batch()`):**

1. Проверяет через `canDeleteUser`, можно ли удалить
2. Если `canDelete = true` → выбрасывает ошибку (используйте `deleteUserCompletely`)
3. Создает запись в `pending_deletions` с `deletion_date`
4. **Блокирует аккаунт** (`is_blocked = 1`)
5. Возвращает дату удаления

**Примеры:**

```typescript
try {
	const deleteDate = await scheduleUserDeletion(db, 123);
	// ✅ Аккаунт АВТОМАТИЧЕСКИ заблокирован

	console.log(`Аккаунт заблокирован и будет удален: ${deleteDate}`);
} catch (error) {
	if (error.message.includes('already scheduled')) {
		console.log('Удаление уже запланировано');
	} else if (error.message.includes('immediately')) {
		// Можно удалить сразу
		await deleteUserCompletely(db, 123);
	}
}
```

---

### `archiveUser(db, userId)` (экспортируется как `archiveUserGDPR`)

Архивирует минимальные данные пользователя перед удалением.

**Параметры:**

- `db: D1Database` - инстанс базы данных
- `userId: number` - ID пользователя

**Возвращает:** `Promise<void>`

**Что сохраняет:**

```sql
INSERT INTO deleted_users_archive (
  first_name,
  last_name,
  registered_at,
  deleted_at,
  events_participated  -- JSON: [{ eventId, title, date }]
)
-- Только завершенные мероприятия:
-- WHERE cancelled_at IS NULL AND date <= datetime('now')
```

**Примеры:**

```typescript
await archiveUserGDPR(db, 123);
// Данные пользователя сохранены в deleted_users_archive
// Только мероприятия, в которых он ДЕЙСТВИТЕЛЬНО участвовал
```

---

### `deleteUserCompletely(db, userId)`

Полное удаление пользователя из системы (атомарная операция).

**Параметры:**

- `db: D1Database` - инстанс базы данных
- `userId: number` - ID пользователя

**Возвращает:** `Promise<void>`

**Что делает (в транзакции через `db.batch`):**

1. ✅ Архивирует данные в `deleted_users_archive`
2. ✅ Удаляет из `admins` (если есть)
3. ✅ Удаляет из `registrations`
4. ✅ Удаляет из `pending_deletions` (если есть)
5. ✅ Обнуляет `user_id` в `activity_log`
6. ✅ Удаляет из `users`

**Примеры:**

```typescript
// Проверка перед удалением
const check = await canDeleteUser(db, 123);

if (check.canDelete) {
	await deleteUserCompletely(db, 123);
	console.log('Пользователь полностью удален');
} else {
	throw new Error('Нельзя удалить пользователя сейчас');
}
```

---

### `processScheduledDeletions(db)`

Обрабатывает все запланированные удаления (вызывается через Cron).

**Параметры:**

- `db: D1Database` - инстанс базы данных

**Возвращает:** `Promise<number>` - количество удаленных пользователей

**Что делает:**

1. Получает все записи из `pending_deletions` где `deletion_date <= NOW()`
2. Для каждой вызывает `deleteUserCompletely(userId)`
3. Логирует успехи и ошибки
4. Возвращает количество успешно удаленных

**Примеры (Cloudflare Worker):**

```typescript
// wrangler.toml
[triggers]
crons = ["0 2 * * *"]  # Каждый день в 02:00

// src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const deletedCount = await processScheduledDeletions(env.DB);

    console.log(`[CRON] Обработано ${deletedCount} запланированных удалений`);

    // Логирование в activity_log
    if (deletedCount > 0) {
      await logActivity(env.DB, {
        action_type: 'user_deleted',
        details: { automated: true, count: deletedCount },
      });
    }
  }
};
```

---

### `getScheduledDeletions(db)`

Получает список всех запланированных удалений с информацией о пользователях.

**Параметры:**

- `db: D1Database` - инстанс базы данных

**Возвращает:** `Promise<PendingDeletionWithUser[]>`

```typescript
interface PendingDeletionWithUser {
	id: number;
	user_id: number;
	deletion_date: string;
	created_at: string;
	user_email: string;
	user_first_name: string;
	user_last_name: string;
	last_event_date: string | null;
}
```

**Примеры:**

```typescript
const scheduled = await getScheduledDeletions(db);

for (const item of scheduled) {
	console.log(`${item.user_email} будет удален ${item.deletion_date}`);
	console.log(`Последнее мероприятие: ${item.last_event_date}`);
}
```

## Типичные сценарии использования

### Сценарий 1: Пользователь запрашивает удаление аккаунта

```typescript
// 1. Проверяем, можно ли удалить
const check = await canDeleteUser(db, userId);

if (check.canDelete) {
	// 2a. Можно удалить немедленно
	await deleteUserCompletely(db, userId);

	// 3a. Логируем
	await logActivity(db, {
		user_id: userId,
		action_type: 'user_deleted',
		details: { immediate: true },
	});

	return { message: 'Ваш аккаунт удален' };
} else {
	// 2b. Нельзя удалить, планируем (автоматически блокирует)
	const deleteDate = await scheduleUserDeletion(db, userId);

	// 3b. Логируем (блокировка уже выполнена в scheduleUserDeletion)
	await logActivity(db, {
		user_id: userId,
		action_type: 'user_delete_request',
		details: { scheduled: true, deleteDate },
	});

	return {
		message: `Ваш аккаунт заблокирован и будет удален ${deleteDate}`,
		reason: check.reason,
	};
}
```

### Сценарий 2: Админ просматривает запланированные удаления

```typescript
// Получаем список
const scheduled = await getScheduledDeletions(db);

// Отображаем в UI
return scheduled.map((item) => ({
	email: item.user_email,
	name: `${item.user_first_name} ${item.user_last_name}`,
	deleteDate: item.deletion_date,
	lastEvent: item.last_event_date,
	daysUntilDeletion: Math.ceil(
		(new Date(item.deletion_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
	),
}));
```

### Сценарий 3: Автоматическое удаление (Cron)

```typescript
// Cloudflare Worker scheduled handler
export default {
	async scheduled(event: ScheduledEvent, env: Env) {
		const deletedCount = await processScheduledDeletions(env.DB);

		if (deletedCount > 0) {
			// Отправляем email администраторам
			await sendEmail({
				to: 'admin@kolibri-dresden.de',
				subject: '[GDPR] Automated user deletion',
				text: `${deletedCount} user accounts were automatically deleted.`,
			});
		}
	},
};
```

## Безопасность

### 1. Атомарность операций

Используется `db.batch()` для атомарного выполнения всех SQL операций в `deleteUserCompletely`:

```typescript
const statements = [
	// Архивация
	db.prepare('INSERT INTO deleted_users_archive ...'),
	// Удаление зависимостей
	db.prepare('DELETE FROM admins ...'),
	db.prepare('DELETE FROM registrations ...'),
	// ...
];

const results = await db.batch(statements);
```

Если хотя бы одна операция не удалась - весь batch откатывается.

### 2. Валидация перед удалением

Всегда проверяйте `canDeleteUser` перед вызовом `deleteUserCompletely`:

```typescript
// ✅ ПРАВИЛЬНО
const check = await canDeleteUser(db, userId);
if (check.canDelete) {
	await deleteUserCompletely(db, userId);
}

// ❌ НЕПРАВИЛЬНО
await deleteUserCompletely(db, userId); // Может удалить до истечения 28 дней
```

### 3. Логирование всех действий

Каждое удаление должно логироваться:

```typescript
await logActivity(db, {
	user_id: userId,
	action_type: 'user_deleted',
	details: {
		automated: false,
		scheduled: true,
	},
});
```

## API Endpoints

### POST /api/profile/delete

Удаляет профиль текущего авторизованного пользователя.

**Файл:** `src/routes/api/profile/delete/+server.ts`

**Требования:**

- Пользователь должен быть авторизован (JWT токен в cookie)

**Request:**

```typescript
// Тело запроса пустое, пользователь определяется по auth токену
POST /api/profile/delete
```

**Response (немедленное удаление):**

```json
{
	"deleted": true,
	"immediate": true
}
```

**Response (запланированное удаление):**

```json
{
	"deleted": true,
	"immediate": false,
	"deletionDate": "2025-12-05T10:00:00.000Z"
}
```

**Заголовки ответа:**

```
Set-Cookie: auth_token=; Max-Age=0; HttpOnly; Secure; SameSite=Strict
```

**Логика:**

1. Проверка авторизации (`requireAuth`)
2. Проверка возможности удаления (`DB.gdpr.canDeleteUser`)
3. Если `canDelete = true`:
   - Полное удаление (`DB.gdpr.deleteUserCompletely`)
   - Логирование `profile_deleted_immediate`
   - Очистка auth cookie
   - Возврат `{ deleted: true, immediate: true }`
4. Если `canDelete = false`:
   - Планирование удаления + блокировка (`DB.gdpr.scheduleUserDeletion`)
   - Логирование `profile_deletion_scheduled`
   - Очистка auth cookie
   - Возврат `{ deleted: true, immediate: false, deletionDate }`

**Коды ответов:**

- `200` - Успешное удаление (немедленное или запланированное)
- `401` - Пользователь не авторизован
- `500` - Ошибка сервера

**Пример использования (fetch):**

```typescript
async function deleteProfile() {
	const response = await fetch('/api/profile/delete', {
		method: 'POST',
		credentials: 'include', // Важно для отправки cookies
	});

	if (response.ok) {
		const data = await response.json();

		if (data.immediate) {
			alert('Ваш профиль удален');
			window.location.href = '/';
		} else {
			alert(`Ваш профиль будет удален ${new Date(data.deletionDate).toLocaleDateString()}`);
			window.location.href = '/';
		}
	} else {
		alert('Ошибка при удалении профиля');
	}
}
```

**Логирование:**

При удалении создаются следующие записи в `activity_log`:

- `profile_deleted_immediate` - успешное немедленное удаление
  ```json
  {
  	"deleted_user_id": 123,
  	"email": "user@example.com",
  	"reason": "immediate_deletion"
  }
  ```
- `profile_deletion_scheduled` - запланированное удаление (аккаунт заблокирован)

  ```json
  {
  	"deletion_date": "2025-12-05T10:00:00.000Z",
  	"reason": "User has upcoming events",
  	"account_blocked": true
  }
  ```

- `profile_deletion_failed` - ошибка при удалении
  ```json
  {
  	"reason": "immediate_deletion_error",
  	"error": "Database error message"
  }
  ```

**Важные замечания:**

- После вызова endpoint пользователь **ВСЕГДА** разлогинен (cookie очищается)
- Если удаление запланировано, аккаунт **немедленно блокируется** (`is_blocked = 1`)
- Заблокированные пользователи не могут авторизоваться (проверка в `getUserFromRequest`)

---

## Связанные файлы

- **Типы:** `src/lib/types/admin.ts` - `PendingDeletion`, `DeletedUserArchive`
- **Схема БД:** `migrations/0001_initial.sql` - таблицы `pending_deletions`, `deleted_users_archive`
- **Activity Log:** `src/lib/server/db/activityLog.ts` - логирование действий
- **API Endpoint:** `src/routes/api/profile/delete/+server.ts` - удаление профиля

## Changelog

### 2025-10-22

- ✅ Создан модуль GDPR compliance
- ✅ Реализованы все 6 функций согласно спецификации
- ✅ Добавлена поддержка JSON для `events_participated`
- ✅ Использован `db.batch()` для атомарности операций
- ✅ Добавлена полная документация с примерами
