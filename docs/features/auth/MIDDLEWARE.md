# Auth Middleware

## 📋 Обзор

Модуль `lib/server/middleware/auth.ts` предоставляет middleware функции для проверки аутентификации и авторизации в Cloudflare Workers окружении.

## 🎯 Основные функции

### 1. `getUserFromRequest()`

Извлекает пользователя из запроса используя JWT токен из cookies.

**Особенность:** НЕ бросает ошибку - возвращает `null` если пользователь не авторизован.

```typescript
async function getUserFromRequest(
	request: Request,
	db: D1Database,
	jwtSecret: string
): Promise<User | null>;
```

**Параметры:**

- `request` - объект Request с cookies
- `db` - D1 Database инстанс
- `jwtSecret` - секретный ключ для JWT (из `env.JWT_SECRET`)

**Возвращает:**

- `User` - если токен валидный и пользователь найден
- `null` - если токен отсутствует, невалидный, пользователь не найден или заблокирован

**Пример использования:**

```typescript
// В SvelteKit endpoint
export async function GET({ request, platform }) {
	const user = await getUserFromRequest(request, platform.env.DB, platform.env.JWT_SECRET);

	if (user) {
		return json({ message: `Hello, ${user.first_name}` });
	} else {
		return json({ message: 'Hello, guest' });
	}
}
```

---

### 2. `requireAuth()`

Требует обязательной авторизации для доступа к endpoint.

**Особенность:** Бросает ошибку `401 Unauthorized` если пользователь не авторизован.

```typescript
async function requireAuth(request: Request, db: D1Database, jwtSecret: string): Promise<User>;
```

**Параметры:**

- `request` - объект Request с cookies
- `db` - D1 Database инстанс
- `jwtSecret` - секретный ключ для JWT

**Возвращает:**

- `User` - гарантированно авторизованный пользователь

**Бросает:**

- `Error { status: 401, message: 'Unauthorized' }` - если не авторизован

**Пример использования:**

```typescript
// В защищённом API endpoint
export async function POST({ request, platform }) {
	try {
		const user = await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);

		// Пользователь авторизован, продолжаем работу
		return json({ user_id: user.id });
	} catch (error: any) {
		return json({ error: error.message }, { status: error.status || 500 });
	}
}
```

---

### 3. `requireAdmin()`

Требует обязательной авторизации И прав администратора.

**Особенность:** Проверяет как авторизацию, так и права админа.

```typescript
async function requireAdmin(request: Request, db: D1Database, jwtSecret: string): Promise<User>;
```

**Параметры:**

- `request` - объект Request с cookies
- `db` - D1 Database инстанс
- `jwtSecret` - секретный ключ для JWT

**Возвращает:**

- `User` - гарантированно администратор

**Бросает:**

- `Error { status: 401 }` - если не авторизован
- `Error { status: 403 }` - если авторизован, но не является администратором

**Пример использования:**

```typescript
// В админском API endpoint
export async function DELETE({ request, platform, params }) {
	try {
		const admin = await requireAdmin(request, platform.env.DB, platform.env.JWT_SECRET);

		// Администратор подтверждён, можно выполнять операцию
		await deleteEvent(platform.env.DB, Number(params.id));
		return json({ success: true });
	} catch (error: any) {
		return json({ error: error.message }, { status: error.status || 500 });
	}
}
```

---

### 4. `getClientIP()`

Получает IP адрес клиента в Cloudflare Workers окружении.

```typescript
function getClientIP(request: Request): string | null;
```

**Параметры:**

- `request` - объект Request

**Возвращает:**

- `string` - IP адрес клиента
- `null` - если не удалось определить

**Логика определения IP:**

1. **`CF-Connecting-IP`** (приоритетный) - Cloudflare добавляет автоматически
2. **`X-Forwarded-For`** (fallback) - берёт первый IP из списка
3. **`X-Real-IP`** (fallback)

**Пример использования:**

```typescript
import { getClientIP } from '$lib/server/middleware/auth';
import { logActivity } from '$lib/server/db/activityLog';

export async function POST({ request, platform }) {
	const user = await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);
	const ip = getClientIP(request);

	// Логируем действие с IP адресом
	await logActivity(platform.env.DB, user.id, 'profile_update', { ip });

	return json({ success: true });
}
```

---

## 🔐 Безопасность

### Обработка ошибок

Все middleware функции правильно обрабатывают ошибки:

- `getUserFromRequest()` - **никогда не бросает** ошибку, возвращает `null`
- `requireAuth()` - бросает `401` если не авторизован
- `requireAdmin()` - бросает `401` или `403` в зависимости от ситуации

### Проверка блокировки

Middleware автоматически проверяет флаг `is_blocked`:

- Если пользователь заблокирован → возвращается `null` / бросается `401`

### JWT верификация

Использует модуль `lib/server/auth`:

- Токен извлекается из httpOnly cookies
- Верификация через WebCrypto API (jose)
- Проверка срока действия токена (7 дней)

---

## 🌍 Cloudflare Workers особенности

### IP адрес клиента

В Cloudflare Workers используйте заголовок `CF-Connecting-IP`:

- Cloudflare автоматически добавляет его
- Содержит реальный IP клиента (не proxy)
- Более надёжен чем `X-Forwarded-For`

### D1 Database

Тип `D1Database` импортируется из `@cloudflare/workers-types`:

```typescript
type D1Database = import('@cloudflare/workers-types').D1Database;
```

---

## 📝 Примеры использования

### Защита страницы профиля

```typescript
// src/routes/profile/+page.server.ts
import { requireAuth } from '$lib/server/middleware/auth';

export const load = async ({ request, platform }) => {
	const user = await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);

	return { user };
};
```

### Опциональная авторизация

```typescript
// src/routes/events/+page.server.ts
import { getUserFromRequest } from '$lib/server/middleware/auth';

export const load = async ({ request, platform }) => {
	// Получаем пользователя если авторизован (но не требуем)
	const user = await getUserFromRequest(request, platform.env.DB, platform.env.JWT_SECRET);

	const events = await getAllEvents(platform.env.DB);

	return { events, user }; // user может быть null
};
```

### Админская операция с логированием

```typescript
// src/routes/api/admin/events/delete/+server.ts
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { deleteEvent } from '$lib/server/db/events';
import { logActivity } from '$lib/server/db/activityLog';

export async function DELETE({ request, platform, params }) {
	try {
		// Проверяем права администратора
		const admin = await requireAdmin(request, platform.env.DB, platform.env.JWT_SECRET);

		// Получаем IP для логирования
		const ip = getClientIP(request);

		// Выполняем операцию
		await deleteEvent(platform.env.DB, Number(params.id));

		// Логируем действие
		await logActivity(platform.env.DB, admin.id, 'event_deleted', { event_id: params.id, ip });

		return json({ success: true });
	} catch (error: any) {
		return json({ error: error.message }, { status: error.status || 500 });
	}
}
```

---

## ✅ Checklist интеграции

При использовании middleware убедитесь:

- [ ] Передаёте `platform.env.DB` как параметр `db`
- [ ] Передаёте `platform.env.JWT_SECRET` как параметр `jwtSecret`
- [ ] Обрабатываете ошибки с правильными статусами (401/403)
- [ ] Используете `getClientIP()` для логирования критичных операций
- [ ] Проверяете `user.is_blocked` перед важными операциями (уже встроено в middleware)

---

## 🔗 Связанные модули

- [`lib/server/auth/index.ts`](../../../src/lib/server/auth/index.ts) - JWT утилиты
- [`lib/server/db/users.ts`](../../../src/lib/server/db/users.ts) - Операции с пользователями
- [`lib/server/db/admin.ts`](../../../src/lib/server/db/admin.ts) - Проверка прав админа
- [Основная документация аутентификации](./README.md) - Auth модуль
- [Примеры использования](./EXAMPLES.md) - Готовые паттерны для endpoints

---

**Последнее обновление:** 23 октября 2025  
**Версия:** 1.0.0
