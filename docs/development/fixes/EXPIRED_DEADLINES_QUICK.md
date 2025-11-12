# Quick Reference: Проверка истёкших дедлайнов

**Модуль:** Events  
**Функции:** `closeExpiredRegistrations()`, `isRegistrationOpen()`

## Быстрый старт

### Проверка в API endpoint

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const event = await DB.events.getEventById(db, eventId);

// Проверить, открыта ли регистрация
const isOpen = DB.events.isRegistrationOpen(event, event.current_participants);

if (!isOpen) {
	return json({ error: 'Registration closed' }, { status: 400 });
}
```

### Проверка в load функции

```typescript
export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDB(platform);
	const event = await DB.events.getEventById(db, parseInt(params.id));

	const isRegistrationOpen = DB.events.isRegistrationOpen(event, event.current_participants);

	return { event, isRegistrationOpen };
};
```

### Использование в UI

```svelte
<script lang="ts">
	export let data: PageData;
	$: ({ event, isRegistrationOpen } = data);
</script>

{#if isRegistrationOpen}
	<button on:click={register}>Записаться</button>
{:else}
	<p>Регистрация закрыта</p>
{/if}
```

## Cron интеграция

Автоматически запускается каждый день в 02:00 UTC:

```typescript
// src/worker.ts или /api/cron/delete-users
const expiredCount = await DB.events.closeExpiredRegistrations(db);
console.log(`Found ${expiredCount} events with expired deadline`);
```

## API Response

```json
{
	"success": true,
	"deleted": 0,
	"expiredRegistrations": 2,
	"timestamp": "2025-11-12T02:00:00.000Z"
}
```

## Условия закрытия регистрации

Регистрация закрыта если:

1. ❌ Мероприятие не в статусе `active`
2. ❌ Дедлайн истёк (`registration_deadline < NOW()`)
3. ❌ Достигнут лимит участников (`current_participants >= max_participants`)

## Примечание

⚠️ **Контроль на уровне приложения**, не в БД  
⚠️ **НЕ требуется** поле `registration_closed`  
⚠️ **НЕ требуется** отдельный Cron триггер

---

**Полная документация:** [EXPIRED_DEADLINES.md](EXPIRED_DEADLINES.md)
