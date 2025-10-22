# GDPR Module - Examples

Практические примеры использования модуля GDPR Compliance.

## 📋 Содержание

1. [Базовые примеры](#базовые-примеры)
2. [API Endpoints](#api-endpoints)
3. [Cloudflare Cron](#cloudflare-cron)
4. [Админ-панель](#админ-панель)
5. [Email уведомления](#email-уведомления)
6. [Обработка ошибок](#обработка-ошибок)

---

## Базовые примеры

### Пример 1: Простая проверка возможности удаления

```typescript
import { canDeleteUser } from '$lib/server/db';

async function checkDeletion(db: D1Database, userId: number) {
	const result = await canDeleteUser(db, userId);

	if (result.canDelete) {
		console.log('✅ Пользователь может быть удален немедленно');
	} else {
		console.log('❌ Удаление невозможно');
		console.log(`Причина: ${result.reason}`);
		console.log(`Можно удалить после: ${result.deleteDate}`);
	}

	return result;
}
```

### Пример 2: Полный цикл удаления

```typescript
import {
	canDeleteUser,
	deleteUserCompletely,
	scheduleUserDeletion,
	blockUser,
	logActivity,
} from '$lib/server/db';

async function handleUserDeletionRequest(db: D1Database, userId: number, ipAddress: string) {
	try {
		// 1. Проверяем возможность удаления
		const check = await canDeleteUser(db, userId);

		if (check.canDelete) {
			// 2a. Удаляем немедленно
			await deleteUserCompletely(db, userId);

			// 3a. Логируем
			await logActivity(db, {
				user_id: userId,
				action_type: 'user_deleted',
				details: { immediate: true },
				ip_address: ipAddress,
			});

			return {
				success: true,
				message: 'Ваш аккаунт успешно удален',
				immediate: true,
			};
		} else {
			// 2b. Планируем удаление (автоматически блокирует аккаунт)
			const deleteDate = await scheduleUserDeletion(db, userId);

			// 3b. Логируем (блокировка уже выполнена в scheduleUserDeletion)
			await logActivity(db, {
				user_id: userId,
				action_type: 'user_delete_request',
				details: {
					scheduled: true,
					deleteDate,
					reason: check.reason,
				},
				ip_address: ipAddress,
			});

			return {
				success: true,
				message: `Ваш аккаунт заблокирован и будет удален ${new Date(deleteDate).toLocaleDateString('de-DE')}`,
				deleteDate,
				reason: check.reason,
				immediate: false,
			};
		}
				success: true,
				message: `Ваш аккаунт будет удален ${new Date(deleteDate).toLocaleDateString('de-DE')}`,
				deleteDate,
				reason: check.reason,
				immediate: false,
			};
		}
	} catch (error) {
		console.error('Error handling deletion request:', error);
		throw error;
	}
}
```

---

## API Endpoints

### Endpoint: Запрос на удаление аккаунта

**Файл:** `src/routes/api/profile/delete/+server.ts`

```typescript
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
	canDeleteUser,
	deleteUserCompletely,
	scheduleUserDeletion,
	blockUser,
	logActivity,
} from '$lib/server/db';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	// 1. Проверяем аутентификацию
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const userId = locals.user.id;
	const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';

	try {
		// 2. Проверяем, не запланировано ли уже удаление
		const existingDeletion = await db
			.prepare('SELECT deletion_date FROM pending_deletions WHERE user_id = ?')
			.bind(userId)
			.first<{ deletion_date: string }>();

		if (existingDeletion) {
			return json({
				success: false,
				message: 'Удаление уже запланировано',
				deleteDate: existingDeletion.deletion_date,
			});
		}

		// 3. Проверяем возможность удаления
		const check = await canDeleteUser(db, userId);

		if (check.canDelete) {
			// Удаляем немедленно
			await deleteUserCompletely(db, userId);

			await logActivity(db, {
				user_id: userId,
				action_type: 'user_deleted',
				details: { immediate: true },
				ip_address: ipAddress,
			});

			// Очищаем сессию
			// TODO: Удалить JWT cookie

			return json({
				success: true,
				immediate: true,
				message: 'Ваш аккаунт успешно удален',
			});
		} else {
			// Планируем удаление (автоматически блокирует аккаунт)
			const deleteDate = await scheduleUserDeletion(db, userId);

			await logActivity(db, {
				user_id: userId,
				action_type: 'user_delete_request',
				details: {
					scheduled: true,
					deleteDate,
					reason: check.reason,
				},
				ip_address: ipAddress,
			});

			return json({
				success: true,
				immediate: false,
				deleteDate,
				message: `Ваш аккаунт заблокирован и будет удален ${new Date(deleteDate).toLocaleDateString('de-DE')}`,
				reason: check.reason,
			});
		}
	} catch (err) {
		console.error('Error in delete endpoint:', err);
		throw error(500, 'Failed to process deletion request');
	}
};
```

### Endpoint: Отмена запланированного удаления (опционально)

**Файл:** `src/routes/api/profile/cancel-deletion/+server.ts`

```typescript
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { logActivity, blockUser } from '$lib/server/db';

export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const userId = locals.user.id;

	try {
		// 1. Проверяем наличие запланированного удаления
		const pending = await db
			.prepare('SELECT id FROM pending_deletions WHERE user_id = ?')
			.bind(userId)
			.first<{ id: number }>();

		if (!pending) {
			return json({
				success: false,
				message: 'Запланированного удаления не найдено',
			});
		}

		// 2. Удаляем из pending_deletions
		await db.prepare('DELETE FROM pending_deletions WHERE user_id = ?').bind(userId).run();

		// 3. Разблокируем пользователя
		await blockUser(db, userId, false); // false = unblock

		// 4. Логируем
		await logActivity(db, {
			user_id: userId,
			action_type: 'user_delete_request',
			details: { cancelled: true },
		});

		return json({
			success: true,
			message: 'Запрос на удаление отменен',
		});
	} catch (err) {
		console.error('Error cancelling deletion:', err);
		throw error(500, 'Failed to cancel deletion');
	}
};
```

---

## Cloudflare Cron

### Настройка в wrangler.toml

```toml
# wrangler.toml

name = "berufsorientierung-app"
main = "src/index.ts"
compatibility_date = "2025-10-22"

# Cron trigger: каждый день в 02:00 UTC
[triggers]
crons = ["0 2 * * *"]

[[d1_databases]]
binding = "DB"
database_name = "berufsorientierung_db"
database_id = "your-database-id"
```

### Worker с Cron handler

**Файл:** `src/index.ts` (для SvelteKit adapter-cloudflare-workers)

```typescript
import { processScheduledDeletions, logActivity } from '$lib/server/db';

export default {
	/**
	 * Cron trigger для автоматического удаления пользователей
	 * Запускается каждый день в 02:00 UTC
	 */
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('[CRON] Starting scheduled user deletions...');

		try {
			// Обрабатываем все запланированные удаления
			const deletedCount = await processScheduledDeletions(env.DB);

			console.log(`[CRON] Successfully deleted ${deletedCount} accounts`);

			if (deletedCount > 0) {
				// Логируем автоматическое удаление
				await logActivity(env.DB, {
					action_type: 'user_deleted',
					details: {
						automated: true,
						count: deletedCount,
						timestamp: new Date().toISOString(),
					},
				});

				// Опционально: отправляем уведомление администраторам
				// await sendAdminNotification(env, deletedCount);
			}
		} catch (error) {
			console.error('[CRON] Error processing scheduled deletions:', error);

			// Логируем ошибку
			await logActivity(env.DB, {
				action_type: 'user_deleted',
				details: {
					automated: true,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			});
		}
	},
};
```

### Тестирование Cron локально

```bash
# Запустить Cron вручную
wrangler dev --test-scheduled

# Или через curl
curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"
```

---

## Админ-панель

### Страница: Список запланированных удалений

**Файл:** `src/routes/admin/users/deletions/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';
import { getScheduledDeletions } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, locals }) => {
	// Проверка прав администратора
	if (!locals.user || !locals.isAdmin) {
		throw error(403, 'Forbidden');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const scheduledDeletions = await getScheduledDeletions(db);

		// Вычисляем дополнительные данные для UI
		const now = new Date();
		const enrichedDeletions = scheduledDeletions.map((item) => ({
			...item,
			daysUntilDeletion: Math.ceil(
				(new Date(item.deletion_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			),
			isOverdue: new Date(item.deletion_date) <= now,
			formattedDeleteDate: new Date(item.deletion_date).toLocaleDateString('de-DE'),
			formattedLastEvent: item.last_event_date
				? new Date(item.last_event_date).toLocaleDateString('de-DE')
				: 'Keine',
		}));

		return {
			scheduledDeletions: enrichedDeletions,
			total: enrichedDeletions.length,
			overdue: enrichedDeletions.filter((d) => d.isOverdue).length,
		};
	} catch (err) {
		console.error('Error loading scheduled deletions:', err);
		throw error(500, 'Failed to load data');
	}
};
```

**Файл:** `src/routes/admin/users/deletions/+page.svelte`

```svelte
<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	$: ({ scheduledDeletions, total, overdue } = data);
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-6">Запланированные удаления</h1>

	<!-- Статистика -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
		<div class="bg-blue-100 p-4 rounded-lg">
			<div class="text-2xl font-bold text-blue-800">{total}</div>
			<div class="text-sm text-blue-600">Всего запланировано</div>
		</div>

		<div class="bg-red-100 p-4 rounded-lg">
			<div class="text-2xl font-bold text-red-800">{overdue}</div>
			<div class="text-sm text-red-600">Просрочено (требует обработки)</div>
		</div>

		<div class="bg-green-100 p-4 rounded-lg">
			<div class="text-2xl font-bold text-green-800">{total - overdue}</div>
			<div class="text-sm text-green-600">В очереди</div>
		</div>
	</div>

	<!-- Таблица -->
	{#if scheduledDeletions.length > 0}
		<div class="overflow-x-auto">
			<table class="min-w-full bg-white border rounded-lg">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-2 text-left">Email</th>
						<th class="px-4 py-2 text-left">Имя</th>
						<th class="px-4 py-2 text-left">Дата удаления</th>
						<th class="px-4 py-2 text-left">Последнее мероприятие</th>
						<th class="px-4 py-2 text-left">Статус</th>
					</tr>
				</thead>
				<tbody>
					{#each scheduledDeletions as deletion}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-2">{deletion.user_email}</td>
							<td class="px-4 py-2">
								{deletion.user_first_name}
								{deletion.user_last_name}
							</td>
							<td class="px-4 py-2">
								<span class:text-red-600={deletion.isOverdue}>
									{deletion.formattedDeleteDate}
								</span>
							</td>
							<td class="px-4 py-2 text-gray-600">
								{deletion.formattedLastEvent}
							</td>
							<td class="px-4 py-2">
								{#if deletion.isOverdue}
									<span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
										Просрочено
									</span>
								{:else}
									<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
										Через {deletion.daysUntilDeletion} дней
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="text-center py-12 bg-gray-50 rounded-lg">
			<p class="text-gray-600">Нет запланированных удалений</p>
		</div>
	{/if}
</div>
```

---

## Email уведомления

### Уведомление пользователю при запросе удаления

```typescript
import { sendEmail } from '$lib/server/email';

async function sendDeletionScheduledEmail(
	user: { email: string; first_name: string; preferred_language: string },
	deleteDate: string
) {
	const locale = user.preferred_language || 'de';

	const messages = {
		de: {
			subject: 'Ihr Konto wird gelöscht',
			body: `Hallo ${user.first_name},

Ihr Antrag auf Löschung Ihres Kontos wurde angenommen.

Ihr Konto wird automatisch am ${new Date(deleteDate).toLocaleDateString('de-DE')} gelöscht.

Bis dahin ist Ihr Konto gesperrt und Sie können sich nicht mehr anmelden.

Falls Sie Ihre Meinung ändern, können Sie die Löschung bis zum Löschtermin abbrechen, indem Sie sich an uns wenden.

Mit freundlichen Grüßen,
Kolibri Dresden Team`,
		},
		en: {
			subject: 'Your account will be deleted',
			body: `Hello ${user.first_name},

Your account deletion request has been accepted.

Your account will be automatically deleted on ${new Date(deleteDate).toLocaleDateString('en-US')}.

Until then, your account is blocked and you cannot log in.

If you change your mind, you can cancel the deletion until the deletion date by contacting us.

Best regards,
Kolibri Dresden Team`,
		},
	};

	const message = messages[locale as keyof typeof messages] || messages.de;

	await sendEmail({
		to: user.email,
		subject: message.subject,
		text: message.body,
	});
}
```

### Уведомление админам после автоматического удаления

```typescript
async function sendAdminDeletionReport(
	env: Env,
	deletedCount: number,
	deletedUsers: Array<{ email: string; name: string }>
) {
	const usersList = deletedUsers.map((u) => `- ${u.name} (${u.email})`).join('\n');

	await sendEmail({
		to: 'admin@kolibri-dresden.de',
		subject: `[GDPR] ${deletedCount} Konten automatisch gelöscht`,
		text: `Automatischer GDPR-Bericht

Datum: ${new Date().toLocaleDateString('de-DE')}
Anzahl gelöschter Konten: ${deletedCount}

Gelöschte Benutzer:
${usersList}

Diese Aktion wurde automatisch durch den Cron-Job ausgeführt.

---
Berufsorientierung System
Kolibri Dresden`,
	});
}
```

---

## Обработка ошибок

### Централизованная обработка ошибок

```typescript
import { error as svelteError } from '@sveltejs/kit';

export async function handleDeletionWithErrorHandling(
	db: D1Database,
	userId: number
): Promise<{ success: boolean; message: string; data?: any }> {
	try {
		const result = await handleUserDeletionRequest(db, userId, 'unknown');

		return {
			success: true,
			message: result.message,
			data: result,
		};
	} catch (err) {
		console.error('[GDPR Error]', err);

		if (err instanceof Error) {
			// Специфичные ошибки
			if (err.message.includes('not found')) {
				throw svelteError(404, 'Пользователь не найден');
			}

			if (err.message.includes('already scheduled')) {
				return {
					success: false,
					message: 'Удаление уже запланировано',
				};
			}

			if (err.message.includes('database')) {
				throw svelteError(500, 'Ошибка базы данных');
			}
		}

		// Общая ошибка
		throw svelteError(500, 'Не удалось обработать запрос');
	}
}
```

### Валидация перед удалением

```typescript
async function validateDeletion(db: D1Database, userId: number): Promise<void> {
	// 1. Проверка существования пользователя
	const user = await getUserById(db, userId);
	if (!user) {
		throw new Error('User not found');
	}

	// 2. Проверка блокировки
	if (user.is_blocked) {
		throw new Error('User is already blocked (deletion may be scheduled)');
	}

	// 3. Проверка активных администраторов
	const isAdmin = await db.prepare('SELECT id FROM admins WHERE user_id = ?').bind(userId).first();

	if (isAdmin) {
		const adminCount = await db
			.prepare('SELECT COUNT(*) as count FROM admins')
			.first<{ count: number }>();

		if (adminCount && adminCount.count <= 1) {
			throw new Error('Cannot delete the last admin');
		}
	}
}
```

---

## 🔗 Связанные материалы

- **Основная документация:** `docs/database/gdpr/README.md`
- **Quick Reference:** `docs/database/gdpr/QUICK_REFERENCE.md`
- **Changelog:** `docs/database/gdpr/CHANGELOG.md`
