# Events Database Utilities

Утилиты для работы с мероприятиями в базе данных.

## Функции

### createEvent

Создаёт новое мероприятие со статусом `draft` по умолчанию.

```typescript
import { createEvent } from '$lib/server/db';

const event = await createEvent(
	db,
	{
		title_de: 'Karrieretag',
		title_en: 'Career Day',
		description_de: 'Ein Tag voller Möglichkeiten',
		location_de: 'Dresden, Hauptstraße 1',
		date: '2025-12-01T10:00:00Z',
		registration_deadline: '2025-11-25T23:59:59Z',
		max_participants: 30,
		telegram_link: 'https://t.me/joinchat/...',
		additional_fields: [
			{
				field_key: 'dietary_preferences',
				field_type: 'select',
				field_options: JSON.stringify(['vegetarian', 'vegan', 'none']),
				required: false,
				label_de: 'Ernährungspräferenzen',
				label_en: 'Dietary Preferences',
			},
		],
	},
	adminUserId
);
```

### updateEvent

Обновляет существующее мероприятие (частичное обновление).

```typescript
import { updateEvent } from '$lib/server/db';

const updatedEvent = await updateEvent(db, eventId, {
	max_participants: 50,
	description_en: 'Updated description',
});
```

### deleteEvent

Удаляет мероприятие. Автоматически удаляет связанные QR-коды из R2, если передан bucket.

```typescript
import { deleteEvent } from '$lib/server/db';

// С автоматическим удалением QR-кодов из R2
await deleteEvent(db, eventId, platform.env.QR_CODES_BUCKET);

// Без удаления QR-кодов (не рекомендуется)
await deleteEvent(db, eventId);
```

### getEventById

Получает мероприятие по ID с количеством участников.

```typescript
import { getEventById } from '$lib/server/db';

const event = await getEventById(db, eventId);
if (!event) {
	throw new Error('Event not found');
}
console.log(event.current_participants); // количество активных регистраций
```

### getAllEvents

Получает все мероприятия с фильтрацией и пагинацией.

```typescript
import { getAllEvents } from '$lib/server/db';

const { events, total } = await getAllEvents(db, {
	status: 'active',
	dateFrom: '2025-01-01',
	dateTo: '2025-12-31',
	limit: 20,
	offset: 0,
});
```

### getActiveEvents

Получает только активные и предстоящие мероприятия (ближайшие первыми).

```typescript
import { getActiveEvents } from '$lib/server/db';

const activeEvents = await getActiveEvents(db);
```

### getPastEvents

Получает прошедшие мероприятия (новые первыми).

```typescript
import { getPastEvents } from '$lib/server/db';

const pastEvents = await getPastEvents(db);
```

### publishEvent

Публикует мероприятие (переводит из `draft` в `active`). Валидирует обязательные поля.

```typescript
import { publishEvent } from '$lib/server/db';

const publishedEvent = await publishEvent(db, eventId);
```

### cancelEvent

Отменяет мероприятие с указанием причины. Автоматически логирует действие администратора.

```typescript
import { cancelEvent } from '$lib/server/db';

const cancelledEvent = await cancelEvent(db, eventId, 'Insufficient registrations', adminUserId);
// Автоматически создаётся запись в activity_log с информацией об отмене
```

### getEventWithFields

Получает мероприятие вместе с его дополнительными полями.

```typescript
import { getEventWithFields } from '$lib/server/db';

const eventWithFields = await getEventWithFields(db, eventId);
if (eventWithFields) {
	console.log(eventWithFields.additionalFields); // массив дополнительных полей
}
```

## Обработка ошибок

Все функции бросают ошибки при проблемах:

```typescript
try {
	const event = await createEvent(db, data, adminId);
} catch (error) {
	console.error('Failed to create event:', error);
	// Обработка ошибки
}
```

## Важные замечания

1. **QR-коды**: При удалении мероприятия через `deleteEvent()` QR-коды автоматически удаляются из R2, если передан параметр `r2Bucket`

2. **Дополнительные поля**: При обновлении `additional_fields` старые поля полностью заменяются новыми

3. **Валидация**: Функция `publishEvent` проверяет обязательные поля перед публикацией

4. **Каскадное удаление**: При удалении мероприятия дополнительные поля удаляются автоматически (ON DELETE CASCADE)

5. **Подсчёт участников**: В поле `current_participants` учитываются только активные регистрации (где `cancelled_at IS NULL`)

6. **Обновление updated_at**: Поле `updated_at` обновляется при каждом вызове `updateEvent()`, даже если меняются только дополнительные поля

7. **Аудит отмены**: При отмене мероприятия через `cancelEvent()` автоматически создаётся запись в `activity_log` для аудита действий администратора

## Типы

Основные типы импортируются из `$lib/types/event`:

- `Event` - полная информация о мероприятии
- `EventCreateData` - данные для создания
- `EventUpdateData` - данные для обновления (частичные)
- `EventStatus` - 'draft' | 'active' | 'cancelled'
- `EventAdditionalField` - дополнительное поле формы
- `EventWithFields` - мероприятие с дополнительными полями
