# Database Utilities - Users

Набор функций для работы с таблицей `users` в Cloudflare D1 базе данных.

## Основные функции

### `createUser(db, data)`

Создаёт нового пользователя в БД.

**Параметры:**

- `db: D1Database` - инстанс D1 базы данных
- `data` - данные пользователя (без пароля, передаётся уже хешированный `password_hash`)

**Возвращает:** `Promise<User>` - созданный пользователь

**Исключения:**

- `"User with this email already exists"` - email уже зарегистрирован
- `"Failed to create user in database"` - ошибка БД

**Пример:**

```typescript
import { createUser } from '$lib/server/db/users';
import bcrypt from 'bcryptjs';

const passwordHash = await bcrypt.hash('password123', 10);

const user = await createUser(platform.env.DB, {
	email: 'user@example.com',
	password_hash: passwordHash,
	first_name: 'John',
	last_name: 'Doe',
	birth_date: '2000-01-01',
	address_street: 'Main Street',
	address_number: '123',
	address_zip: '01067',
	address_city: 'Dresden',
	phone: '+49123456789',
	photo_video_consent: true,
	parental_consent: false,
	preferred_language: 'de',
});
```

---

### `getUserByEmail(db, email)`

Находит пользователя по email адресу.

**Возвращает:** `Promise<User | null>` - пользователь или null

**Пример:**

```typescript
const user = await getUserByEmail(db, 'user@example.com');
if (user) {
	console.log(`Found: ${user.first_name} ${user.last_name}`);
}
```

---

### `getUserById(db, id)`

Находит пользователя по ID.

**Возвращает:** `Promise<User | null>`

---

### `updateUser(db, id, data)`

Обновляет данные пользователя. Обновляет только переданные поля.

**Параметры:**

- `data: Partial<UserUpdateData>` - объект с полями для обновления

**Возвращает:** `Promise<User>` - обновлённый пользователь

**Пример:**

```typescript
const updated = await updateUser(db, 123, {
	phone: '+49987654321',
	preferred_language: 'en',
});
```

---

### `archiveUser(db, id)`

Архивирует данные пользователя перед удалением (GDPR compliance).
Сохраняет минимальную информацию (имя, фамилия, даты, список мероприятий) в таблицу `deleted_users_archive`.

**Возвращает:** `Promise<void>`

**Исключения:**

- `"User not found"` - пользователь не существует
- `"Failed to archive user data"` - ошибка при архивировании

**Пример:**

```typescript
await archiveUser(db, 123);
```

---

### `deleteUser(db, id)`

Удаляет пользователя из БД. **Автоматически вызывает `archiveUser()` перед удалением.**

⚠️ **ВАЖНО:** Проверьте GDPR требования (28 дней после последнего мероприятия) перед вызовом.

**Возвращает:** `Promise<void>`

**Пример:**

```typescript
// Функция автоматически архивирует данные перед удалением
await deleteUser(db, 123);
```

---

### `getAllUsers(db, options?)`

Получает список всех пользователей с пагинацией.

**Параметры:**

- `options.limit` - количество записей (по умолчанию 50)
- `options.offset` - смещение (по умолчанию 0)

**Возвращает:** `Promise<{ users: User[], total: number }>`

**Пример:**

```typescript
const { users, total } = await getAllUsers(db, { limit: 20, offset: 0 });
console.log(`Page 1: ${users.length} of ${total} total users`);
```

---

### `searchUsers(db, query)`

Поиск пользователей по имени или email.

**Возвращает:** `Promise<User[]>` - массив найденных пользователей (максимум 100)

**Пример:**

```typescript
const results = await searchUsers(db, 'john');
// Найдёт пользователей с "john" в имени, фамилии или email
```

---

### `getUsersList(db, options?)`

Получает упрощённый список пользователей для админ-панели (без конфиденциальных данных).

**Возвращает:** `Promise<{ users: UserListItem[], total: number }>`

---

### `blockUser(db, id, blocked)`

Блокирует или разблокирует пользователя.

**Параметры:**

- `blocked: boolean` - true для блокировки

**Пример:**

```typescript
await blockUser(db, 123, true); // Блокируем доступ
```

---

### `emailExists(db, email)`

Проверяет, существует ли пользователь с данным email.

**Возвращает:** `Promise<boolean>`

**Пример:**

```typescript
if (await emailExists(db, 'test@example.com')) {
	throw new Error('Email already registered');
}
```

---

## Безопасность

✅ Все функции используют **prepared statements** для защиты от SQL injection  
✅ Строгая **типизация TypeScript** - используется `DBUserRow` интерфейс вместо `any`  
✅ Обработка ошибок с понятными сообщениями  
✅ JSDoc комментарии для каждой функции  
✅ Автоматическая архивация данных перед удалением (GDPR compliance)

## Формат дат

Все даты хранятся и возвращаются в **упрощённом ISO формате без миллисекунд и часового пояса**:

- Дата рождения: `YYYY-MM-DD` (например: `2000-01-01`)
- Timestamps: `YYYY-MM-DDTHH:MM:SS` (например: `2025-10-21T12:30:00`)

**Утилиты для работы с датами:**

- `nowSql()` - возвращает текущее время в формате `YYYY-MM-DDTHH:MM:SS`
- `normalizeTimestamp()` - конвертирует timestamp из БД (убирает миллисекунды и часовой пояс Z)

## Использование в SvelteKit

```typescript
// В +page.server.ts или +server.ts
import { getUserById } from '$lib/server/db/users';

export const load = async ({ platform, locals }) => {
	if (!locals.user) {
		return { user: null };
	}

	const user = await getUserById(platform.env.DB, locals.user.id);

	return { user };
};
```

## Типы данных

### `DBUserRow`

Интерфейс для строки из таблицы `users` в БД. Используется вместо `any` для строгой типизации.

### Утилиты

- `nowSql(): string` - генерирует текущий timestamp в формате SQL
- `normalizeTimestamp(timestamp: string): string` - нормализует timestamp из БД
- `rowToUser(row: DBUserRow): User` - конвертирует строку БД в объект User

## TODO

- [x] ~~Добавить функцию `archiveUser()` для GDPR compliance~~ ✅ Реализовано
- [ ] Настроить Miniflare для unit тестов
- [ ] Добавить функцию получения последней даты мероприятия пользователя для проверки 28-дневного правила
