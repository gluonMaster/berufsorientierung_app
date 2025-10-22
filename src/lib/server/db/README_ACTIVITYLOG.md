# Activity Log Database Utilities

Утилиты для логирования активности пользователей и системных действий.

## Основные функции

### `logActivity(db, userId, actionType, details?, ipAddress?)`

Записывает действие пользователя в лог.

**Параметры:**

- `db: D1Database` - база данных
- `userId: number | null` - ID пользователя (null для системных действий)
- `actionType: ActivityLogActionType` - тип действия
- `details?: string` - дополнительные детали (опционально, обычно JSON)
- `ipAddress?: string` - IP адрес пользователя (опционально)

**Возвращает:**

- `Promise<void>`

**Особенность:** Не выбрасывает ошибки, чтобы не прерывать основной поток выполнения

**Пример:**

```typescript
// После успешной регистрации
await logActivity(
	platform.env.DB,
	newUser.id,
	'user_register',
	JSON.stringify({ email: newUser.email }),
	request.headers.get('cf-connecting-ip') || undefined
);

// Системное действие (userId = null)
await logActivity(
	platform.env.DB,
	null,
	'bulk_email_sent',
	JSON.stringify({ recipients_count: 150, event_id: 42 })
);
```

---

### `getActivityLog(db, filters?)`

Получает логи активности с фильтрами и пагинацией.

**Параметры:**

- `db: D1Database` - база данных
- `filters?: ActivityLogFilters` - фильтры (опционально)
  - `userId?: number` - фильтр по пользователю
  - `actionType?: ActivityLogActionType` - фильтр по типу действия
  - `dateFrom?: string` - начало периода (ISO формат)
  - `dateTo?: string` - конец периода (ISO формат)
  - `limit?: number` - количество записей (по умолчанию 50)
  - `offset?: number` - смещение для пагинации (по умолчанию 0)

**Возвращает:**

- `Promise<ActivityLogResult>` - объект с массивом логов и общим количеством

**Пример:**

```typescript
// Получить все действия пользователя
const result = await getActivityLog(platform.env.DB, {
	userId: 123,
	limit: 20,
	offset: 0,
});

console.log(`Всего записей: ${result.total}`);
console.log(`Получено: ${result.logs.length}`);

// Получить логи за последний месяц
const monthAgo = new Date();
monthAgo.setMonth(monthAgo.getMonth() - 1);

const recentResult = await getActivityLog(platform.env.DB, {
	dateFrom: monthAgo.toISOString(),
	limit: 100,
});
```

---

### `getRecentActivity(db, limit?)`

Получает последние N действий в системе.

**Параметры:**

- `db: D1Database` - база данных
- `limit?: number` - количество записей (по умолчанию 20)

**Возвращает:**

- `Promise<ActivityLogWithUser[]>` - массив последних логов

**Пример:**

```typescript
// Для админ-панели: показать последние 50 действий
const recentActions = await getRecentActivity(platform.env.DB, 50);
```

---

### `getUserActivityLog(db, userId, limit?)`

Получает логи активности для конкретного пользователя.

**Параметры:**

- `db: D1Database` - база данных
- `userId: number` - ID пользователя
- `limit?: number` - количество записей (по умолчанию 50)

**Возвращает:**

- `Promise<ActivityLogWithUser[]>` - массив логов пользователя

**Пример:**

```typescript
// История действий пользователя
const userHistory = await getUserActivityLog(platform.env.DB, userId, 100);
```

---

### `getActivityStats(db, dateFrom?, dateTo?)`

Получает статистику действий по типам за указанный период.

**Параметры:**

- `db: D1Database` - база данных
- `dateFrom?: string` - начало периода (опционально)
- `dateTo?: string` - конец периода (опционально)

**Возвращает:**

- `Promise<Array<{ action_type: string; count: number }>>` - статистика

**Пример:**

```typescript
// Статистика за последнюю неделю
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

const stats = await getActivityStats(
	platform.env.DB,
	weekAgo.toISOString(),
	new Date().toISOString()
);

// [
//   { action_type: 'user_login', count: 450 },
//   { action_type: 'registration_create', count: 85 },
//   { action_type: 'user_register', count: 23 },
//   ...
// ]
```

---

### `cleanOldLogs(db, daysToKeep?)`

Удаляет старые логи (для соблюдения GDPR и экономии места).

**Параметры:**

- `db: D1Database` - база данных
- `daysToKeep?: number` - количество дней для хранения (по умолчанию 365)

**Возвращает:**

- `Promise<number>` - количество удаленных записей

**Пример:**

```typescript
// В Cloudflare Cron Trigger (каждый месяц)
// Удалить логи старше 1 года
const deletedCount = await cleanOldLogs(platform.env.DB, 365);
console.log(`Удалено логов: ${deletedCount}`);
```

---

## Типы действий

```typescript
type ActivityLogActionType =
	// Действия пользователей
	| 'user_register' // Регистрация нового пользователя
	| 'user_login' // Вход в систему
	| 'user_logout' // Выход из системы
	| 'user_update_profile' // Обновление профиля
	| 'user_delete_request' // Запрос на удаление аккаунта
	| 'user_deleted' // Аккаунт удален

	// Действия с мероприятиями (админ)
	| 'event_create' // Создание мероприятия
	| 'event_update' // Обновление мероприятия
	| 'event_delete' // Удаление мероприятия
	| 'event_publish' // Публикация мероприятия
	| 'event_cancel' // Отмена мероприятия

	// Действия с записями
	| 'registration_create' // Запись на мероприятие
	| 'registration_cancel' // Отмена записи

	// Административные действия
	| 'admin_add' // Выдача прав администратора
	| 'admin_remove' // Отзыв прав администратора
	| 'bulk_email_sent'; // Массовая рассылка
```

## Структура таблицы `activity_log`

```sql
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action_type TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);
```

## Типы данных

### `ActivityLog`

```typescript
interface ActivityLog {
	id: number;
	user_id: number | null;
	action_type: ActivityLogActionType;
	details: string | null;
	ip_address: string | null;
	timestamp: string;
}
```

### `ActivityLogWithUser`

```typescript
interface ActivityLogWithUser extends ActivityLog {
	user_email: string | null;
	user_full_name: string | null;
}
```

### `ActivityLogFilters`

```typescript
interface ActivityLogFilters {
	userId?: number;
	actionType?: ActivityLogActionType;
	dateFrom?: string;
	dateTo?: string;
	limit?: number;
	offset?: number;
}
```

### `ActivityLogResult`

```typescript
interface ActivityLogResult {
	logs: ActivityLogWithUser[];
	total: number;
}
```

## Рекомендации по использованию

### 1. Логирование при каждом важном действии

```typescript
// При регистрации
const newUser = await createUser(db, userData);
await logActivity(
	db,
	newUser.id,
	'user_register',
	JSON.stringify({ email: userData.email }),
	clientIp
);

// При входе
await logActivity(db, user.id, 'user_login', null, clientIp);

// При записи на мероприятие
await logActivity(
	db,
	userId,
	'registration_create',
	JSON.stringify({ event_id: eventId, event_title: event.title_de }),
	clientIp
);
```

### 2. Детали в формате JSON

```typescript
// Хорошо
await logActivity(
	db,
	userId,
	'event_update',
	JSON.stringify({
		event_id: 42,
		changed_fields: ['title_de', 'max_participants'],
		old_max: 50,
		new_max: 75,
	})
);

// Плохо
await logActivity(db, userId, 'event_update', 'Changed event 42');
```

### 3. IP адрес из Cloudflare

```typescript
// В SvelteKit routes
export async function POST({ request, platform, locals }) {
	const clientIp = request.headers.get('cf-connecting-ip') || undefined;

	await logActivity(platform.env.DB, locals.user?.id, 'some_action', undefined, clientIp);
}
```

### 4. Админская панель - просмотр логов

```typescript
// src/routes/admin/logs/+page.server.ts
export async function load({ platform, url }) {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 50;
	const offset = (page - 1) * limit;

	const userId = url.searchParams.get('user_id');
	const actionType = url.searchParams.get('action_type');

	const result = await getActivityLog(platform.env.DB, {
		userId: userId ? parseInt(userId) : undefined,
		actionType: actionType || undefined,
		limit,
		offset,
	});

	return {
		logs: result.logs,
		total: result.total,
		page,
		totalPages: Math.ceil(result.total / limit),
	};
}
```

## GDPR Compliance

- Логи удаляются автоматически через `cleanOldLogs` (например, каждый год)
- При удалении пользователя: `user_id` становится NULL (ON DELETE SET NULL)
- Минимальные персональные данные в `details` (не хранить пароли, токены и т.д.)
- IP адреса анонимизируются или удаляются через определенное время

## Производительность

- Индексы на `user_id`, `action_type`, `timestamp` для быстрых запросов
- Пагинация обязательна для больших выборок
- Регулярная очистка старых логов через Cron
- Логирование НЕ должно прерывать основной поток (try-catch без throw)

## Использование в Cloudflare Cron

```typescript
// wrangler.toml
[triggers]
crons = ["0 2 * * *"]  # Каждый день в 02:00

// src/routes/api/cron/+server.ts
export async function GET({ platform, request }) {
  // Проверка Cloudflare Cron secret
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${platform.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Удалить логи старше 1 года
  const deletedCount = await cleanOldLogs(platform.env.DB, 365);

  return new Response(JSON.stringify({ deleted: deletedCount }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```
