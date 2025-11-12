# Events Database Utilities

Утилиты для работы с мероприятиями в базе данных.

## Связанная документация

- [EVENTFIELDS.md](EVENTFIELDS.md) - Работа с дополнительными полями мероприятий
- [REGISTRATION_STATUS.md](REGISTRATION_STATUS.md) - Проверка статуса регистрации
- [CHANGELOG.md](CHANGELOG.md) - История изменений модуля

## Функции

### createEvent

Создаёт новое мероприятие со статусом `draft` по умолчанию.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const event = await DB.events.createEvent(
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
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const updatedEvent = await DB.events.updateEvent(db, eventId, {
	max_participants: 50,
	description_en: 'Updated description',
});
```

### deleteEvent

Удаляет мероприятие. Автоматически удаляет связанные QR-коды из R2, если передан bucket.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
// С автоматическим удалением QR-кодов из R2
await DB.events.deleteEvent(db, eventId, platform.env.QR_CODES_BUCKET);

// Без удаления QR-кодов (не рекомендуется)
await deleteEvent(db, eventId);
```

### getEventById

Получает мероприятие по ID с количеством участников.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const event = await DB.events.getEventById(db, eventId);
if (!event) {
	throw new Error('Event not found');
}
console.log(event.current_participants); // количество активных регистраций
```

### getAllEvents

Получает все мероприятия с фильтрацией и пагинацией.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const { events, total } = await DB.events.getAllEvents(db, {
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
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const activeEvents = await DB.events.getActiveEvents(db);
```

### getPastEvents

Получает прошедшие мероприятия (новые первыми).

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const pastEvents = await DB.events.getPastEvents(db);
```

### publishEvent

Публикует мероприятие (переводит из `draft` в `active`). Валидирует обязательные поля.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const publishedEvent = await DB.events.publishEvent(db, eventId);
```

### cancelEvent

Отменяет мероприятие с указанием причины. Автоматически логирует действие администратора.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const cancelledEvent = await DB.events.cancelEvent(
	db,
	eventId,
	'Insufficient registrations',
	adminUserId
);
// Автоматически создаётся запись в activity_log с информацией об отмене
```

### getEventWithFields

Получает мероприятие вместе с его дополнительными полями.

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const eventWithFields = await DB.events.getEventWithFields(db, eventId);
if (eventWithFields) {
	console.log(eventWithFields.additionalFields); // массив дополнительных полей
}
```

### closeExpiredRegistrations

Проверяет и подсчитывает мероприятия с истёкшим дедлайном регистрации.

**Использование в Cron:**

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
const expiredCount = await DB.events.closeExpiredRegistrations(db);
console.log(`Found ${expiredCount} events with expired registration deadline`);
```

**Описание:**

- Находит все активные мероприятия где `registration_deadline < NOW()`
- Возвращает количество таких мероприятий
- Используется для статистики и логирования в Cron задачах

**Примечание:** В приложении регистрация контролируется на уровне UI - кнопка регистрации не показывается если дедлайн истёк.

### isRegistrationOpen

Проверяет, открыта ли регистрация на мероприятие.

```typescript
import { DB } from '$lib/server/db';

const event = await DB.events.getEventById(db, eventId);
const registrationsCount = 15;

const isOpen = DB.events.isRegistrationOpen(event, registrationsCount);

if (!isOpen) {
	// Регистрация закрыта
	console.log('Registration is closed');
}
```

**Проверки:**

1. Мероприятие должно быть в статусе `active`
2. Дедлайн регистрации не должен быть истёкшим
3. Не достигнут лимит участников (если `max_participants` задан)

**Параметры:**

- `event` - объект мероприятия
- `currentRegistrations` - текущее количество записавшихся (опционально)

**Возвращает:** `true` если регистрация открыта, `false` если закрыта

## Обработка ошибок

Все функции бросают ошибки при проблемах:

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform);
try {
	const event = await DB.events.createEvent(db, data, adminId);
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
