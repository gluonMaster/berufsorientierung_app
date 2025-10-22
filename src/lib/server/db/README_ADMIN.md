# Admin Database Utilities

Утилиты для работы с администраторами системы.

## Основные функции

### `isAdmin(db, userId)`

Проверяет, является ли пользователь администратором.

**Параметры:**

- `db: D1Database` - база данных
- `userId: number` - ID пользователя

**Возвращает:**

- `Promise<boolean>` - true если пользователь админ

**Пример:**

```typescript
const isUserAdmin = await isAdmin(platform.env.DB, userId);
if (!isUserAdmin) {
	throw error(403, 'Доступ запрещен');
}
```

---

### `addAdmin(db, userId, createdBy)`

Добавляет пользователя в администраторы.

**Параметры:**

- `db: D1Database` - база данных
- `userId: number` - ID пользователя, которому выдаются права
- `createdBy: number` - ID админа, который выдаёт права

**Возвращает:**

- `Promise<Admin>` - созданная запись администратора

**Ошибки:**

- "Пользователь не найден" - если user_id не существует
- "Пользователь уже является администратором" - если уже админ

**Пример:**

```typescript
try {
	const admin = await addAdmin(platform.env.DB, newAdminUserId, currentAdminId);
	await logActivity(
		platform.env.DB,
		currentAdminId,
		'admin_add',
		JSON.stringify({ added_user_id: newAdminUserId })
	);
} catch (error) {
	console.error('Не удалось добавить администратора:', error);
}
```

---

### `removeAdmin(db, userId)`

Убирает права администратора у пользователя.

**Параметры:**

- `db: D1Database` - база данных
- `userId: number` - ID пользователя, у которого отзываются права

**Возвращает:**

- `Promise<void>`

**Ошибки:**

- "Пользователь не является администратором" - если не админ
- "Нельзя убрать права у superadmin" - если created_by IS NULL

**Пример:**

```typescript
try {
	await removeAdmin(platform.env.DB, userId);
	await logActivity(
		platform.env.DB,
		currentAdminId,
		'admin_remove',
		JSON.stringify({ removed_user_id: userId })
	);
} catch (error) {
	console.error('Не удалось удалить администратора:', error);
}
```

---

### `getAllAdmins(db)`

Возвращает список всех администраторов с информацией о пользователях.

**Параметры:**

- `db: D1Database` - база данных

**Возвращает:**

- `Promise<AdminWithUser[]>` - массив администраторов

**Пример:**

```typescript
const admins = await getAllAdmins(platform.env.DB);
// [
//   {
//     id: 1,
//     user_id: 5,
//     created_by: null, // superadmin
//     created_at: '2024-01-15T10:00:00Z',
//     user_email: 'admin@example.com',
//     user_first_name: 'John',
//     user_last_name: 'Doe',
//     created_by_email: null
//   },
//   ...
// ]
```

---

### `getAdminByUserId(db, userId)`

Получает информацию об администраторе по ID пользователя.

**Параметры:**

- `db: D1Database` - база данных
- `userId: number` - ID пользователя

**Возвращает:**

- `Promise<AdminWithUser | null>` - информация об администраторе или null

**Пример:**

```typescript
const admin = await getAdminByUserId(platform.env.DB, userId);
if (admin) {
	console.log(`Админ: ${admin.user_email}, права выданы: ${admin.created_at}`);
}
```

---

## Структура таблицы `admins`

```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

## Типы данных

### `Admin`

```typescript
interface Admin {
	id: number;
	user_id: number;
	created_by: number | null; // null для superadmin
	created_at: string;
}
```

### `AdminWithUser`

```typescript
interface AdminWithUser extends Admin {
	user_email: string;
	user_first_name: string;
	user_last_name: string;
	created_by_email: string | null;
}
```

## Бизнес-правила

1. **Superadmin**: Первый администратор (created_by IS NULL) не может быть удален
2. **Уникальность**: Пользователь может быть админом только один раз
3. **Каскадное удаление**: При удалении пользователя автоматически удаляется запись админа
4. **Логирование**: Все операции с админами должны логироваться через `logActivity`

## Использование в роутах

```typescript
// src/routes/admin/+layout.server.ts
export async function load({ platform, locals }) {
	const userId = locals.user?.id;

	if (!userId) {
		throw redirect(302, '/login');
	}

	const isUserAdmin = await isAdmin(platform.env.DB, userId);

	if (!isUserAdmin) {
		throw error(403, 'Доступ запрещен');
	}

	return { user: locals.user };
}
```

## Безопасность

- ✅ Prepared statements для защиты от SQL injection
- ✅ Проверка существования пользователя перед добавлением
- ✅ Защита superadmin от удаления
- ✅ Обязательное логирование всех операций с админами
