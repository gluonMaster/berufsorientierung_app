# Registrations Database Utilities

Утилиты для работы с записями пользователей на мероприятия в базе данных D1.

## 📋 Обзор

Модуль `registrations.ts` предоставляет функции для:

- ✅ Регистрации пользователей на мероприятия с комплексной валидацией
- ❌ Отмены записей с проверкой временных ограничений
- 📊 Получения списков записей пользователей и мероприятий
- 🔢 Подсчёта активных участников
- ✔️ Проверки статуса регистрации

## 🔑 Основные функции

### 1. `registerUserForEvent()`

Создаёт запись пользователя на мероприятие с полной валидацией или реактивирует отменённую.

**🔄 ВАЖНО: Реактивация отменённых записей**

Из-за UNIQUE constraint на `(user_id, event_id)` в БД, если пользователь ранее отменил запись и хочет записаться снова, функция **автоматически реактивирует** существующую запись вместо создания новой:

- Сбрасывает `cancelled_at = NULL`
- Очищает `cancellation_reason = NULL`
- Обновляет `registered_at` на текущее время
- Обновляет `additional_data` если переданы новые данные

**Проверки при регистрации:**

1. ✅ Пользователь существует и не заблокирован
2. ✅ Мероприятие существует и активно (status = 'active')
3. ✅ Есть свободные места (current_participants < max_participants)
4. ✅ Дедлайн регистрации не истёк (now <= registration_deadline)
5. ✅ Пользователь не имеет активной записи (cancelled_at IS NULL)

**Пример использования:**

```typescript
import { registerUserForEvent } from '$lib/server/db/registrations';

// Первая регистрация
const registration = await registerUserForEvent(db, 123, 456, {
	dietary_restrictions: 'vegetarian',
	experience_level: 'beginner',
});

// Отменяем
await cancelRegistration(db, 123, 456, 'Changed my mind');

// Регистрируемся снова - произойдёт РЕАКТИВАЦИЯ той же записи
const reactivated = await registerUserForEvent(db, 123, 456, {
	dietary_restrictions: 'vegan', // Новые данные заменят старые
});
// reactivated.id === registration.id (тот же ID!)
```

**Возможные ошибки:**

- `User not found` - Пользователь не существует
- `User account is blocked` - Аккаунт заблокирован
- `Event not found` - Мероприятие не существует
- `Event is not active (status: draft)` - Мероприятие не активно
- `Registration deadline has passed` - Дедлайн истёк
- `Event is full, no available spots` - Нет свободных мест
- `User is already registered for this event` - Уже записан

### 2. `cancelRegistration()`

Отменяет запись на мероприятие (soft delete).

**Важно:**

- ❌ НЕ удаляет запись из БД
- ✅ Устанавливает `cancelled_at` и `cancellation_reason`
- ⏰ Можно отменить только за **>3 дней** до мероприятия

**Пример использования:**

```typescript
import { cancelRegistration } from '$lib/server/db/registrations';

const cancelled = await cancelRegistration(db, 123, 456, 'Personal reasons');
```

**Возможные ошибки:**

- `Active registration not found` - Нет активной записи
- `Event not found` - Мероприятие не существует
- `Cannot cancel registration less than 3 days before the event` - Слишком поздно

### 3. `getUserRegistrations()`

Получает все записи пользователя с информацией о мероприятиях.

**Особенности:**

- ✅ Включает как активные, так и отменённые записи
- 📅 Сортировка: предстоящие мероприятия первыми, потом прошедшие
- 🔗 JOIN с таблицей `events` для получения деталей

**Пример использования:**

```typescript
import { getUserRegistrations } from '$lib/server/db/registrations';

const registrations = await getUserRegistrations(db, 123);

registrations.forEach((reg) => {
	console.log(`Event: ${reg.event_title_de}`);
	console.log(`Date: ${reg.event_date}`);
	console.log(`Status: ${reg.cancelled_at ? 'Cancelled' : 'Active'}`);
});
```

**Возвращаемый тип: `RegistrationWithEvent[]`**

```typescript
interface RegistrationWithEvent extends Registration {
	event_title_de: string; // Название мероприятия
	event_date: string; // Дата мероприятия
	event_location_de: string; // Место проведения
	event_status: 'draft' | 'active' | 'cancelled'; // Статус
}
```

### 4. `getEventRegistrations()`

Получает все **активные** записи на мероприятие с данными участников.

**Особенности:**

- ✅ Только активные записи (`cancelled_at IS NULL`)
- 👤 JOIN с таблицей `users` для получения данных
- 🔒 **НЕ возвращает `password_hash`** (безопасность!)
- 📅 Сортировка: по дате регистрации (раньше зарегистрированные первыми)

**Пример использования:**

```typescript
import { getEventRegistrations } from '$lib/server/db/registrations';

const participants = await getEventRegistrations(db, 456);

participants.forEach((reg) => {
	console.log(`${reg.user_first_name} ${reg.user_last_name} (${reg.user_email})`);
	console.log(`Phone: ${reg.user_phone}`);
	console.log(`WhatsApp: ${reg.user_whatsapp || 'N/A'}`);

	// Дополнительные данные
	if (reg.additional_data) {
		const data = JSON.parse(reg.additional_data);
		console.log('Additional:', data);
	}
});
```

**Возвращаемый тип: `RegistrationWithUser[]`**

```typescript
interface RegistrationWithUser extends Registration {
	user_first_name: string;
	user_last_name: string;
	user_email: string;
	user_phone: string;
	user_whatsapp: string | null;
	user_telegram: string | null;
}
```

### 5. `getRegistrationCount()`

Подсчитывает активные записи на мероприятие.

**Пример использования:**

```typescript
import { getRegistrationCount } from '$lib/server/db/registrations';

const count = await getRegistrationCount(db, 456);
const event = await getEventById(db, 456);

console.log(`${count} / ${event.max_participants} участников`);

if (count >= event.max_participants) {
	console.log('Мероприятие заполнено!');
}
```

### 6. `isUserRegistered()`

Проверяет, записан ли пользователь на мероприятие.

**Пример использования:**

```typescript
import { isUserRegistered } from '$lib/server/db/registrations';

const isRegistered = await isUserRegistered(db, 123, 456);

if (isRegistered) {
	console.log('Пользователь уже записан');
} else {
	console.log('Можно записаться');
}
```

### 7. `getRegistrationById()`

Получает запись по ID.

**Пример использования:**

```typescript
import { getRegistrationById } from '$lib/server/db/registrations';

const registration = await getRegistrationById(db, 789);

if (registration) {
	console.log('Запись найдена');
} else {
	console.log('Запись не существует');
}
```

### 8. `parseAdditionalData()`

Безопасно парсит дополнительные данные из JSON строки с проверкой типов.

**Особенности:**

- ✅ Безопасный парсинг с try-catch
- ✅ Проверка что результат - объект (не массив, не примитив)
- ✅ Возвращает `null` при ошибке парсинга
- 🔒 Type-safe: возвращает `Record<string, unknown> | null`

**Пример использования:**

```typescript
import { getRegistrationById, parseAdditionalData } from '$lib/server/db/registrations';

const registration = await getRegistrationById(db, 789);

// additional_data это JSON строка в БД
console.log(typeof registration.additional_data); // 'string'

// Парсим безопасно
const data = parseAdditionalData(registration.additional_data);

if (data) {
	console.log(data.dietary_restrictions); // Type-safe доступ
	console.log(data.experience_level);
	console.log(data.special_needs);
}
```

## 📊 Типы данных

### Registration

Базовый тип записи (соответствует таблице `registrations`):

```typescript
interface Registration {
	id: number;
	user_id: number;
	event_id: number;
	additional_data: string | null; // JSON строка
	registered_at: string; // ISO 8601
	cancelled_at: string | null; // ISO 8601
	cancellation_reason: string | null;
}
```

### RegistrationWithUser

Запись с информацией о пользователе:

```typescript
interface RegistrationWithUser extends Registration {
	user_first_name: string;
	user_last_name: string;
	user_email: string;
	user_phone: string;
	user_whatsapp: string | null;
	user_telegram: string | null;
}
```

### RegistrationWithEvent

Запись с информацией о мероприятии:

```typescript
interface RegistrationWithEvent extends Registration {
	event_title_de: string;
	event_date: string;
	event_location_de: string;
	event_status: 'draft' | 'active' | 'cancelled';
}
```

## 🔒 Бизнес-правила

### 1. Регистрация на мероприятие

**Условия успешной регистрации:**

```
✅ Пользователь существует
✅ Пользователь не заблокирован (is_blocked = false)
✅ Мероприятие существует
✅ Мероприятие активно (status = 'active')
✅ Дедлайн не истёк (now <= registration_deadline)
✅ Есть свободные места (current_participants < max_participants)
✅ Пользователь не записан (no active registration)
```

### 2. Отмена регистрации

**Условия успешной отмены:**

```
✅ Активная запись существует (cancelled_at IS NULL)
✅ До мероприятия больше 3 дней
```

**Формула расчёта:**

```typescript
const daysUntilEvent = (eventDate - now) / (1000 * 60 * 60 * 24);
if (daysUntilEvent <= 3) {
	throw new Error('Too late to cancel');
}
```

### 3. Дополнительные данные

**Формат additional_data:**

```typescript
// При создании
const additionalData = {
	dietary_restrictions: 'vegetarian',
	experience_level: 'beginner',
	special_needs: 'wheelchair access',
	emergency_contact: '+49123456789',
};

// В БД хранится как JSON строка
additional_data: '{"dietary_restrictions":"vegetarian",...}';

// При чтении
const data = JSON.parse(registration.additional_data);
```

## 🎯 Типичные сценарии использования

### Сценарий 1: Регистрация пользователя

```typescript
import {
	registerUserForEvent,
	isUserRegistered,
	getRegistrationCount,
} from '$lib/server/db/registrations';
import { getEventById } from '$lib/server/db/events';

async function registerUser(db, userId, eventId, formData) {
	try {
		// 1. Проверяем что не записан (опционально, функция сама проверит)
		const alreadyRegistered = await isUserRegistered(db, userId, eventId);
		if (alreadyRegistered) {
			return { success: false, error: 'Already registered' };
		}

		// 2. Проверяем наличие мест
		const event = await getEventById(db, eventId);
		const count = await getRegistrationCount(db, eventId);

		if (count >= event.max_participants) {
			return { success: false, error: 'Event is full' };
		}

		// 3. Регистрируем
		const registration = await registerUserForEvent(db, userId, eventId, formData);

		// 4. Отправляем email подтверждение (см. email/templates.ts)
		// await sendEventRegistrationEmail(...)

		return { success: true, registration };
	} catch (error) {
		return { success: false, error: error.message };
	}
}
```

### Сценарий 2: Отображение "Мои записи"

```typescript
import { getUserRegistrations } from '$lib/server/db/registrations';

async function loadUserDashboard(db, userId) {
	const registrations = await getUserRegistrations(db, userId);

	// Разделяем на предстоящие и прошедшие
	const now = new Date();

	const upcoming = registrations.filter((r) => {
		return new Date(r.event_date) >= now && !r.cancelled_at;
	});

	const past = registrations.filter((r) => {
		return new Date(r.event_date) < now || r.cancelled_at;
	});

	return { upcoming, past };
}
```

### Сценарий 3: Список участников для админа

```typescript
import { getEventRegistrations } from '$lib/server/db/registrations';

async function exportParticipants(db, eventId) {
	const participants = await getEventRegistrations(db, eventId);

	// Формируем CSV
	const csv = participants.map((p) => {
		const additionalData = p.additional_data ? JSON.parse(p.additional_data) : {};

		return [
			p.user_first_name,
			p.user_last_name,
			p.user_email,
			p.user_phone,
			p.user_whatsapp || '',
			p.registered_at,
			additionalData.dietary_restrictions || '',
		].join(',');
	});

	return ['Name,Surname,Email,Phone,WhatsApp,Registered,Diet', ...csv].join('\n');
}
```

## ⚠️ Важные замечания

### 1. Реактивация отменённых записей

**UNIQUE constraint и повторная регистрация:**

В БД есть `UNIQUE(user_id, event_id)`, поэтому пользователь не может иметь две записи на одно мероприятие. При попытке повторной регистрации после отмены:

```typescript
// 1. Пользователь регистрируется
const reg1 = await registerUserForEvent(db, 123, 456);
// INSERT → id: 1, cancelled_at: null

// 2. Пользователь отменяет запись
await cancelRegistration(db, 123, 456, 'Reason');
// UPDATE → id: 1, cancelled_at: '2025-10-22T10:00:00'

// 3. Пользователь регистрируется снова
const reg2 = await registerUserForEvent(db, 123, 456);
// UPDATE (реактивация) → id: 1, cancelled_at: null
// reg2.id === reg1.id ✅ (тот же ID!)

// ❌ БЕЗ реактивации было бы:
// INSERT → UNIQUE constraint failed!
```

**Преимущества реактивации:**

- ✅ Нет ошибок UNIQUE constraint
- ✅ Сохраняется история (ID не меняется)
- ✅ Логичное поведение для пользователя
- ✅ Простая аналитика (один ряд = один участник)

### 2. Soft Delete

Записи **НЕ удаляются** из БД при отмене:

```sql
-- ❌ НЕ делаем
DELETE FROM registrations WHERE id = ?

-- ✅ Делаем
UPDATE registrations
SET cancelled_at = ?, cancellation_reason = ?
WHERE id = ?
```

### 2. Временные ограничения

Правило **"3 дня до мероприятия"**:

```typescript
// Можно отменить
eventDate = "2025-11-01"
now = "2025-10-28" // 4 дня до
✅ daysUntilEvent = 4 > 3

// Нельзя отменить
eventDate = "2025-11-01"
now = "2025-10-30" // 2 дня до
❌ daysUntilEvent = 2 <= 3
```

### 3. Возвращаемые типы с JOIN

**Уточнение**: Некоторые функции возвращают расширенные типы (не базовый `Registration`):

```typescript
// getUserRegistrations возвращает RegistrationWithEvent[]
const userRegs = await getUserRegistrations(db, 123);
userRegs[0].event_title_de; // ✅ Доступно через JOIN
userRegs[0].event_date; // ✅ Доступно через JOIN

// getEventRegistrations возвращает RegistrationWithUser[]
const participants = await getEventRegistrations(db, 456);
participants[0].user_first_name; // ✅ Доступно через JOIN
participants[0].user_email; // ✅ Доступно через JOIN
participants[0].password_hash; // ❌ НЕ доступно (безопасность!)
```

Это **улучшение** по сравнению со спецификацией - JOIN даёт больше данных для UI без дополнительных запросов.

### 4. Дополнительные данные и парсинг

`additional_data` в БД - это **JSON строка**, но используйте `parseAdditionalData()` для безопасного парсинга:

```typescript
// ✅ Правильно - передаём объект
await registerUserForEvent(db, userId, eventId, {
	field1: 'value1',
	field2: 'value2',
});

// ✅ Правильно - безопасный парсинг
import { getRegistrationById, parseAdditionalData } from '$lib/server/db/registrations';

const reg = await getRegistrationById(db, 123);
const data = parseAdditionalData(reg.additional_data);
if (data) {
	console.log(data.field1); // Type-safe!
}

// ❌ Неправильно - ручной JSON.parse без проверок
const unsafeData = JSON.parse(reg.additional_data); // Может упасть!

// ❌ Неправильно - не передавайте уже JSON строку
await registerUserForEvent(db, userId, eventId, JSON.stringify(data));
```

### 4. Безопасность

При работе с данными пользователей:

```typescript
// ✅ getEventRegistrations НЕ возвращает password_hash
const participants = await getEventRegistrations(db, eventId);
// participants[0].password_hash = undefined

// ❌ Никогда не отправляйте полный User объект клиенту
// Используйте UserProfile тип вместо User
```

## 📝 Changelog

### 2025-10-22

- ✅ Создан модуль `registrations.ts`
- ✅ Реализованы все 7 функций согласно Prompt 2.5
- ✅ Добавлена полная валидация при регистрации
- ✅ Добавлена проверка временных ограничений при отмене
- ✅ Добавлены функции для получения списков с JOIN
- ✅ Экспортировано в `index.ts`

## 🔗 См. также

- [README_USERS.md](./README_USERS.md) - Утилиты для работы с пользователями
- [README_EVENTS.md](./README_EVENTS.md) - Утилиты для работы с мероприятиями
- [README_EVENTFIELDS.md](./README_EVENTFIELDS.md) - Дополнительные поля мероприятий
- [CHANGELOG_EVENTS.md](./CHANGELOG_EVENTS.md) - История изменений events
