# Проверка статуса регистрации на мероприятие

Документация по использованию функции `isRegistrationOpen` для контроля доступности регистрации на мероприятия.

## Обзор

Функция `isRegistrationOpen` проверяет, может ли пользователь зарегистрироваться на мероприятие. Она учитывает:

1. Статус мероприятия (должен быть `active`)
2. Дедлайн регистрации (не должен быть истёкшим)
3. Лимит участников (если задан)

## Использование на сервере

### В API endpoint'ах

```typescript
// src/routes/api/events/register/+server.ts
import { DB, getDB } from '$lib/server/db';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, platform, locals }: RequestEvent) {
	const db = getDB(platform);
	const { eventId } = await request.json();

	// Получить мероприятие
	const event = await DB.events.getEventById(db, eventId);
	if (!event) {
		return json({ success: false, error: 'Event not found' }, { status: 404 });
	}

	// Проверить, открыта ли регистрация
	const isOpen = DB.events.isRegistrationOpen(event, event.current_participants);

	if (!isOpen) {
		return json(
			{
				success: false,
				error: 'Registration is closed',
				reason: getClosureReason(event),
			},
			{ status: 400 }
		);
	}

	// Продолжить регистрацию...
	// ...
}

function getClosureReason(event: Event): string {
	if (event.status !== 'active') {
		return 'event_not_active';
	}

	const now = new Date();
	const deadline = new Date(event.registration_deadline);
	if (deadline < now) {
		return 'deadline_expired';
	}

	if (event.max_participants !== null && event.current_participants >= event.max_participants) {
		return 'max_participants_reached';
	}

	return 'unknown';
}
```

### В load функциях

```typescript
// src/routes/events/[id]/register/+page.server.ts
import { DB, getDB } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDB(platform);
	const eventId = parseInt(params.id);

	const event = await DB.events.getEventById(db, eventId);
	if (!event) {
		throw error(404, 'Event not found');
	}

	// Проверяем, открыта ли регистрация
	const isRegistrationOpen = DB.events.isRegistrationOpen(event, event.current_participants);

	return {
		event,
		isRegistrationOpen,
		closureReason: !isRegistrationOpen ? getClosureReason(event) : null,
	};
};
```

## Использование в UI

### В Svelte компонентах

```svelte
<!-- src/routes/events/[id]/register/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';
	import { _ } from 'svelte-i18n';

	export let data: PageData;

	$: ({ event, isRegistrationOpen, closureReason } = data);
</script>

<div class="event-details">
	<h1>{event.title_de}</h1>
	<p>{event.description_de}</p>

	{#if isRegistrationOpen}
		<button class="btn btn-primary" on:click={handleRegister}>
			{$_('events.register')}
		</button>
	{:else}
		<div class="alert alert-warning">
			{#if closureReason === 'deadline_expired'}
				<p>{$_('events.registration_deadline_expired')}</p>
			{:else if closureReason === 'max_participants_reached'}
				<p>{$_('events.registration_full')}</p>
			{:else if closureReason === 'event_not_active'}
				<p>{$_('events.event_not_active')}</p>
			{:else}
				<p>{$_('events.registration_closed')}</p>
			{/if}
		</div>
	{/if}
</div>
```

### В компоненте карточки мероприятия

```svelte
<!-- src/lib/components/events/EventCard.svelte -->
<script lang="ts">
	import type { Event } from '$lib/types/event';
	import { _ } from 'svelte-i18n';

	export let event: Event;
	export let isRegistrationOpen: boolean;

	$: spotsLeft = event.max_participants
		? event.max_participants - (event.current_participants || 0)
		: null;
</script>

<div class="event-card">
	<h3>{event.title_de}</h3>
	<p class="date">{new Date(event.date).toLocaleDateString()}</p>

	<div class="registration-status">
		{#if isRegistrationOpen}
			<span class="badge badge-success">
				{$_('events.registration_open')}
			</span>

			{#if spotsLeft !== null}
				<span class="spots-left">
					{$_('events.spots_left', { values: { count: spotsLeft } })}
				</span>
			{/if}
		{:else}
			<span class="badge badge-danger">
				{$_('events.registration_closed')}
			</span>
		{/if}
	</div>

	<a
		href="/events/{event.id}"
		class="btn btn-sm"
		class:btn-primary={isRegistrationOpen}
		class:btn-secondary={!isRegistrationOpen}
	>
		{isRegistrationOpen ? $_('events.view_and_register') : $_('events.view_details')}
	</a>
</div>

<style>
	.event-card {
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 16px;
		transition: box-shadow 0.2s;
	}

	.event-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.badge {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge-success {
		background-color: #10b981;
		color: white;
	}

	.badge-danger {
		background-color: #ef4444;
		color: white;
	}

	.spots-left {
		margin-left: 8px;
		font-size: 14px;
		color: var(--text-secondary);
	}
</style>
```

## Client-side проверка (дополнительно)

Для дополнительного UX можно добавить client-side проверку:

```typescript
// src/lib/utils/registration.ts
import type { Event } from '$lib/types/event';

/**
 * Client-side проверка доступности регистрации
 * ВАЖНО: Это только для UI! Всегда проверяйте на сервере!
 */
export function isRegistrationOpenClient(
	event: Event,
	currentRegistrations?: number
): { isOpen: boolean; reason?: string } {
	// Проверка 1: Статус
	if (event.status !== 'active') {
		return { isOpen: false, reason: 'event_not_active' };
	}

	// Проверка 2: Дедлайн
	const now = new Date();
	const deadline = new Date(event.registration_deadline);
	if (deadline < now) {
		return { isOpen: false, reason: 'deadline_expired' };
	}

	// Проверка 3: Лимит участников
	if (event.max_participants !== null && currentRegistrations !== undefined) {
		if (currentRegistrations >= event.max_participants) {
			return { isOpen: false, reason: 'max_participants_reached' };
		}
	}

	return { isOpen: true };
}
```

## Переводы для i18n

Добавьте в `static/translations/{lang}.json`:

```json
{
	"events": {
		"registration_open": "Регистрация открыта",
		"registration_closed": "Регистрация закрыта",
		"registration_deadline_expired": "Срок регистрации истёк",
		"registration_full": "Все места заняты",
		"event_not_active": "Мероприятие неактивно",
		"spots_left": "{count, plural, =1 {Осталось 1 место} other {Осталось # мест}}",
		"view_and_register": "Посмотреть и записаться",
		"view_details": "Подробнее"
	}
}
```

## Тестирование

```typescript
// tests/unit/registration-status.test.ts
import { describe, it, expect } from 'vitest';
import { isRegistrationOpen } from '$lib/server/db/events';
import type { Event } from '$lib/types/event';

describe('isRegistrationOpen', () => {
	it('should return true for open registration', () => {
		const event: Event = {
			id: 1,
			status: 'active',
			registration_deadline: new Date(Date.now() + 86400000).toISOString(), // завтра
			max_participants: 30,
			current_participants: 10,
			// ... другие поля
		};

		expect(isRegistrationOpen(event, 10)).toBe(true);
	});

	it('should return false if deadline expired', () => {
		const event: Event = {
			id: 1,
			status: 'active',
			registration_deadline: new Date(Date.now() - 86400000).toISOString(), // вчера
			max_participants: 30,
			current_participants: 10,
			// ... другие поля
		};

		expect(isRegistrationOpen(event, 10)).toBe(false);
	});

	it('should return false if max participants reached', () => {
		const event: Event = {
			id: 1,
			status: 'active',
			registration_deadline: new Date(Date.now() + 86400000).toISOString(),
			max_participants: 30,
			current_participants: 30,
			// ... другие поля
		};

		expect(isRegistrationOpen(event, 30)).toBe(false);
	});

	it('should return false if event not active', () => {
		const event: Event = {
			id: 1,
			status: 'cancelled',
			registration_deadline: new Date(Date.now() + 86400000).toISOString(),
			max_participants: 30,
			current_participants: 10,
			// ... другие поля
		};

		expect(isRegistrationOpen(event, 10)).toBe(false);
	});
});
```

## Best Practices

1. **Всегда проверяйте на сервере**: Client-side проверка только для UX, security проверка на сервере
2. **Показывайте причину закрытия**: Пользователь должен понимать почему он не может зарегистрироваться
3. **Обновляйте UI в реальном времени**: Если используете polling/websockets, обновляйте статус регистрации
4. **Логируйте попытки**: Записывайте попытки регистрации на закрытые мероприятия для аналитики
5. **Graceful fallback**: Если проверка не удалась, лучше показать кнопку регистрации чем скрыть её

---

**См. также:**

- [Events Database Utilities](README.md)
- [Event Additional Fields](EVENTFIELDS.md)
- [Registrations Module](../registrations/README.md)
