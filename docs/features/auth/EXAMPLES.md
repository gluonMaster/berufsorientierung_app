# Auth Middleware - Примеры использования

## 🚀 Быстрый старт

### 1. Публичный endpoint (без авторизации)

```typescript
// src/routes/api/events/list/+server.ts
import { json } from '@sveltejs/kit';
import { getAllEvents } from '$lib/server/db/events';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const events = await getAllEvents(platform!.env.DB);
	return json({ events });
};
```

---

### 2. Защищённый endpoint (требуется авторизация)

```typescript
// src/routes/api/profile/update/+server.ts
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { updateUser } from '$lib/server/db/users';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, platform }) => {
	try {
		// Проверяем авторизацию
		const user = await requireAuth(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Получаем данные из запроса
		const data = await request.json();

		// Обновляем профиль
		const updated = await updateUser(platform!.env.DB, user.id, data);

		return json({ success: true, user: updated });
	} catch (error: any) {
		return json({ error: error.message }, { status: error.status || 500 });
	}
};
```

---

### 3. Админский endpoint (требуется роль администратора)

```typescript
// src/routes/api/admin/events/delete/+server.ts
import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/auth';
import { deleteEvent } from '$lib/server/db/events';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, platform, params }) => {
	try {
		// Проверяем права администратора
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Выполняем операцию
		await deleteEvent(platform!.env.DB, Number(params.id));

		return json({ success: true });
	} catch (error: any) {
		return json({ error: error.message }, { status: error.status || 500 });
	}
};
```

---

### 4. Опциональная авторизация (пользователь может быть null)

```typescript
// src/routes/events/+page.server.ts
import { getUserFromRequest } from '$lib/server/middleware/auth';
import { getAllEvents } from '$lib/server/db/events';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, platform }) => {
	// Получаем пользователя если авторизован (НЕ требуем)
	const user = await getUserFromRequest(request, platform!.env.DB, platform!.env.JWT_SECRET);

	// Загружаем мероприятия
	const events = await getAllEvents(platform!.env.DB);

	return {
		user, // может быть null
		events,
	};
};
```

---

### 5. Логирование действий с IP адресом

```typescript
// src/routes/api/events/register/+server.ts
import { json } from '@sveltejs/kit';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { registerForEvent } from '$lib/server/db/registrations';
import { logActivity } from '$lib/server/db/activityLog';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, params }) => {
	try {
		// Проверяем авторизацию
		const user = await requireAuth(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Получаем IP адрес
		const ip = getClientIP(request);

		// Регистрируем на мероприятие
		const eventId = Number(params.id);
		await registerForEvent(platform!.env.DB, user.id, eventId);

		// Логируем действие
		await logActivity(platform!.env.DB, user.id, 'event_registration', {
			event_id: eventId,
			ip,
		});

		return json({ success: true });
	} catch (error: any) {
		return json({ error: error.message }, { status: error.status || 500 });
	}
};
```

---

### 6. Защита страницы (server load function)

```typescript
// src/routes/profile/+page.server.ts
import { requireAuth } from '$lib/server/middleware/auth';
import { getUserById } from '$lib/server/db/users';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, platform }) => {
	try {
		// Проверяем авторизацию
		const user = await requireAuth(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Загружаем дополнительные данные если нужно
		const fullUser = await getUserById(platform!.env.DB, user.id);

		return { user: fullUser };
	} catch (err: any) {
		// Перенаправляем на страницу логина
		throw error(err.status || 500, err.message);
	}
};
```

---

### 7. Админская страница с middleware

```typescript
// src/routes/admin/+layout.server.ts
import { requireAdmin } from '$lib/server/middleware/auth';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request, platform }) => {
	try {
		// Проверяем права администратора для ВСЕХ страниц /admin/*
		const admin = await requireAdmin(request, platform!.env.DB, platform!.env.JWT_SECRET);

		return { admin };
	} catch (err: any) {
		// 401 -> редирект на логин
		// 403 -> показываем ошибку доступа
		throw error(err.status || 500, err.message);
	}
};
```

---

## ⚡ Паттерны обработки ошибок

### Стандартная обработка в API

```typescript
export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const user = await requireAuth(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// ... ваша логика ...

		return json({ success: true });
	} catch (error: any) {
		// Автоматически возвращаем правильный статус
		return json({ error: error.message }, { status: error.status || 500 });
	}
};
```

### Обработка в server load function

```typescript
export const load: PageServerLoad = async ({ request, platform }) => {
	try {
		const user = await requireAuth(request, platform!.env.DB, platform!.env.JWT_SECRET);
		return { user };
	} catch (err: any) {
		// SvelteKit автоматически покажет страницу ошибки
		throw error(err.status || 500, err.message);
	}
};
```

---

## 🔍 Отладка

### Проверка токена в консоли

```typescript
import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, platform }) => {
	const token = extractTokenFromRequest(request);
	console.log('Token:', token);

	if (token) {
		const payload = await verifyToken(token, platform!.env.JWT_SECRET);
		console.log('Payload:', payload);
	}

	return json({ debug: 'check console' });
};
```

### Проверка IP адреса

```typescript
import { getClientIP } from '$lib/server/middleware/auth';

export const GET: RequestHandler = async ({ request }) => {
	const ip = getClientIP(request);
	console.log('Client IP:', ip);

	return json({ ip });
};
```

---

## ✅ Checklist для новых endpoints

Перед созданием нового endpoint проверьте:

- [ ] **Определили уровень доступа:**
  - Публичный → без middleware
  - Авторизованные пользователи → `requireAuth()`
  - Только админы → `requireAdmin()`
- [ ] **Обрабатываете ошибки:**
  - API: `catch` блок с `error.status`
  - Pages: `throw error(status, message)`
- [ ] **Логируете критичные операции:**
  - Используете `getClientIP()` для получения IP
  - Сохраняете в `activity_log` через `logActivity()`
- [ ] **Проверили TypeScript типы:**
  - `platform!.env.DB` для доступа к D1
  - `platform!.env.JWT_SECRET` для JWT

---

[← Назад к документации middleware](./MIDDLEWARE.md)
