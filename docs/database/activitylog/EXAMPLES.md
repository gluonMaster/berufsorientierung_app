# Примеры использования Admin и Activity Log

## 1. Проверка прав администратора в middleware

```typescript
// src/routes/admin/+layout.server.ts
import { redirect, error } from '@sveltejs/kit';
import { DB, getDB } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform, locals }) => {
	const userId = locals.user?.id;

	// Проверка авторизации
	if (!userId) {
		throw redirect(302, '/login');
	}

	const db = getDB(platform);
	// Проверка прав администратора
	const userIsAdmin = await DB.admin.isAdmin(db, userId);

	if (!userIsAdmin) {
		throw error(403, 'Доступ запрещен. Требуются права администратора.');
	}

	return {
		user: locals.user,
		isAdmin: true,
	};
};
```

---

## 2. Выдача прав администратора

```typescript
// src/routes/api/admin/users/grant-admin/+server.ts
import { json, error } from '@sveltejs/kit';
import { isAdmin, addAdmin, logActivity } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const currentUserId = locals.user?.id;

	if (!currentUserId) {
		throw error(401, 'Требуется авторизация');
	}

	// Проверка: является ли текущий пользователь админом
	const userIsAdmin = await isAdmin(platform.env.DB, currentUserId);
	if (!userIsAdmin) {
		throw error(403, 'Доступ запрещен');
	}

	try {
		const { userId } = await request.json();

		if (!userId || typeof userId !== 'number') {
			throw error(400, 'Некорректный ID пользователя');
		}

		// Добавляем пользователя в администраторы
		const admin = await addAdmin(platform.env.DB, userId, currentUserId);

		// Логируем действие
		await logActivity(
			platform.env.DB,
			currentUserId,
			'admin_add',
			JSON.stringify({ added_user_id: userId }),
			request.headers.get('cf-connecting-ip') || undefined
		);

		return json({
			success: true,
			admin,
		});
	} catch (err) {
		console.error('Ошибка при выдаче прав администратора:', err);
		throw error(500, err instanceof Error ? err.message : 'Внутренняя ошибка сервера');
	}
};
```

---

## 3. Отзыв прав администратора

```typescript
// src/routes/api/admin/users/revoke-admin/+server.ts
import { json, error } from '@sveltejs/kit';
import { isAdmin, removeAdmin, logActivity } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const currentUserId = locals.user?.id;

	if (!currentUserId) {
		throw error(401, 'Требуется авторизация');
	}

	// Проверка: является ли текущий пользователь админом
	const userIsAdmin = await isAdmin(platform.env.DB, currentUserId);
	if (!userIsAdmin) {
		throw error(403, 'Доступ запрещен');
	}

	try {
		const { userId } = await request.json();

		if (!userId || typeof userId !== 'number') {
			throw error(400, 'Некорректный ID пользователя');
		}

		// Нельзя убрать права у самого себя
		if (userId === currentUserId) {
			throw error(400, 'Нельзя убрать права у самого себя');
		}

		// Убираем права администратора
		await removeAdmin(platform.env.DB, userId);

		// Логируем действие
		await logActivity(
			platform.env.DB,
			currentUserId,
			'admin_remove',
			JSON.stringify({ removed_user_id: userId }),
			request.headers.get('cf-connecting-ip') || undefined
		);

		return json({
			success: true,
		});
	} catch (err) {
		console.error('Ошибка при отзыве прав администратора:', err);
		throw error(500, err instanceof Error ? err.message : 'Внутренняя ошибка сервера');
	}
};
```

---

## 4. Логирование при регистрации пользователя

```typescript
// src/routes/api/auth/register/+server.ts
import { json } from '@sveltejs/kit';
import { createUser, logActivity } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const userData = await request.json();

		// Создаём пользователя
		const newUser = await createUser(platform.env.DB, userData);

		// Логируем регистрацию
		await logActivity(
			platform.env.DB,
			newUser.id,
			'user_register',
			JSON.stringify({
				email: newUser.email,
				registration_method: 'email',
			}),
			request.headers.get('cf-connecting-ip') || undefined
		);

		return json({
			success: true,
			userId: newUser.id,
		});
	} catch (error) {
		// Обработка ошибок...
	}
};
```

---

## 5. Логирование при входе/выходе

```typescript
// src/routes/api/auth/login/+server.ts
import { json, error } from '@sveltejs/kit';
import { getUserByEmail, logActivity } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const { email, password } = await request.json();

	// Получаем пользователя
	const user = await getUserByEmail(platform.env.DB, email);

	if (!user) {
		throw error(401, 'Неверный email или пароль');
	}

	// Проверяем пароль
	const isPasswordValid = await bcrypt.compare(password, user.password_hash);

	if (!isPasswordValid) {
		throw error(401, 'Неверный email или пароль');
	}

	// Создаём JWT токен...
	// cookies.set('token', token, { ... });

	// Логируем успешный вход
	await logActivity(
		platform.env.DB,
		user.id,
		'user_login',
		null,
		request.headers.get('cf-connecting-ip') || undefined
	);

	return json({ success: true });
};

// src/routes/api/auth/logout/+server.ts
export const POST: RequestHandler = async ({ request, platform, locals, cookies }) => {
	const userId = locals.user?.id;

	// Удаляем токен
	cookies.delete('token', { path: '/' });

	// Логируем выход (если пользователь был авторизован)
	if (userId) {
		await logActivity(
			platform.env.DB,
			userId,
			'user_logout',
			null,
			request.headers.get('cf-connecting-ip') || undefined
		);
	}

	return json({ success: true });
};
```

---

## 6. Логирование при записи на мероприятие

```typescript
// src/routes/api/events/register/+server.ts
import { json, error } from '@sveltejs/kit';
import { registerUserForEvent, getEventById, logActivity } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Требуется авторизация');
	}

	try {
		const { eventId, additionalData } = await request.json();

		// Регистрируем пользователя на мероприятие
		const registration = await registerUserForEvent(
			platform.env.DB,
			userId,
			eventId,
			additionalData
		);

		// Получаем информацию о мероприятии для лога
		const event = await getEventById(platform.env.DB, eventId);

		// Логируем запись
		await logActivity(
			platform.env.DB,
			userId,
			'registration_create',
			JSON.stringify({
				event_id: eventId,
				event_title: event?.title_de,
				event_date: event?.date,
			}),
			request.headers.get('cf-connecting-ip') || undefined
		);

		return json({
			success: true,
			registration,
		});
	} catch (err) {
		// Обработка ошибок...
	}
};
```

---

## 7. Получение логов для админской панели

```typescript
// src/routes/admin/logs/+page.server.ts
import { getActivityLog } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
	// Получаем параметры из URL
	const page = parseInt(url.searchParams.get('page') || '1');
	const userId = url.searchParams.get('user_id');
	const actionType = url.searchParams.get('action_type');
	const dateFrom = url.searchParams.get('date_from');
	const dateTo = url.searchParams.get('date_to');

	const limit = 50;
	const offset = (page - 1) * limit;

	// Получаем логи с фильтрами
	const result = await getActivityLog(platform.env.DB, {
		userId: userId ? parseInt(userId) : undefined,
		actionType: actionType || undefined,
		dateFrom: dateFrom || undefined,
		dateTo: dateTo || undefined,
		limit,
		offset,
	});

	return {
		logs: result.logs,
		total: result.total,
		page,
		totalPages: Math.ceil(result.total / limit),
		filters: {
			userId,
			actionType,
			dateFrom,
			dateTo,
		},
	};
};
```

---

## 8. Статистика для админской панели

```typescript
// src/routes/admin/stats/+page.server.ts
import { getActivityStats, getRecentActivity } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	// Последние 7 дней
	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);

	// Последние 30 дней
	const monthAgo = new Date();
	monthAgo.setMonth(monthAgo.getMonth() - 1);

	// Получаем статистику
	const [weekStats, monthStats, recentActivity] = await Promise.all([
		getActivityStats(platform.env.DB, weekAgo.toISOString()),
		getActivityStats(platform.env.DB, monthAgo.toISOString()),
		getRecentActivity(platform.env.DB, 20),
	]);

	return {
		weekStats,
		monthStats,
		recentActivity,
	};
};
```

---

## 9. Автоматическая очистка логов через Cloudflare Cron

```typescript
// src/routes/api/cron/cleanup/+server.ts
import { cleanOldLogs } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, request }) => {
	// Проверка Cloudflare Cron secret
	const authHeader = request.headers.get('Authorization');
	const expectedAuth = `Bearer ${platform.env.CRON_SECRET}`;

	if (authHeader !== expectedAuth) {
		return new Response('Unauthorized', { status: 401 });
	}

	try {
		// Удалить логи старше 365 дней
		const deletedCount = await cleanOldLogs(platform.env.DB, 365);

		return new Response(
			JSON.stringify({
				success: true,
				deleted_logs: deletedCount,
				timestamp: new Date().toISOString(),
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		console.error('Ошибка при очистке логов:', error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
};
```

**wrangler.toml:**

```toml
[triggers]
crons = ["0 2 * * *"]  # Каждый день в 02:00

[[env.production.vars]]
CRON_SECRET = "your-secret-key-here"
```

---

## 10. Системные действия (userId = null)

```typescript
// Массовая рассылка (системное действие)
import { logActivity } from '$lib/server/db';

async function sendBulkEmail(db: D1Database, recipients: string[]) {
	// Отправка писем...

	// Логируем системное действие (userId = null)
	await logActivity(
		db,
		null, // системное действие
		'bulk_email_sent',
		JSON.stringify({
			recipients_count: recipients.length,
			timestamp: new Date().toISOString(),
		})
	);
}
```

---

## Рекомендации

1. **Всегда логируйте критические действия:** регистрация, вход, запись на мероприятия, админские действия
2. **Используйте JSON для details:** структурированные данные легче анализировать
3. **Включайте IP адрес:** `request.headers.get('cf-connecting-ip')`
4. **Не логируйте чувствительные данные:** пароли, токены, полные адреса
5. **Проверяйте права перед действиями:** используйте `isAdmin` в middleware
6. **Настройте автоматическую очистку:** Cloudflare Cron для соблюдения GDPR
7. **Используйте пагинацию:** при получении большого количества логов
8. **Фильтруйте по датам:** для анализа активности за определенный период
