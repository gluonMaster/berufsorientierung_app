# TypeScript Types Documentation

## Обзор системы типов

Полная система TypeScript типов для приложения Berufsorientierung.

## Файлы типов

### 0. `lib/types/common.ts` - Общие типы

**Основные типы:**

- `LanguageCode` - поддерживаемые языки интерфейса ('de' | 'en' | 'ru' | 'uk')
- `LanguageCodeOrAll` - языки с опцией "все" ('de' | 'en' | 'ru' | 'uk' | 'all')

**Использование:**

```typescript
import type { LanguageCode, LanguageCodeOrAll } from '$lib/types';

// Для полей пользователя
const userLang: LanguageCode = 'de';

// Для фильтров и рассылок
const filterLang: LanguageCodeOrAll = 'all';
```

### 1. `lib/types/user.ts` - Типы пользователей

**Основные интерфейсы:**

- `User` - полная информация о пользователе (включая password_hash)
- `UserProfile` - публичный профиль без конфиденциальных данных
- `UserRegistrationData` - данные для регистрации
- `UserUpdateData` - данные для обновления профиля
- `UserLoginData` - данные для входа
- `UserListItem` - минимальная информация для списков

**Использование:**

```typescript
import { User, UserProfile, UserRegistrationData } from '$lib/types';

// При работе с БД
const user: User = await db.getUser(id);

// При отправке клиенту
const profile: UserProfile = {
	id: user.id,
	email: user.email,
	// ... без password_hash
};

// При регистрации
const registrationData: UserRegistrationData = {
	email: 'user@example.com',
	password: 'securePassword123',
	password_confirm: 'securePassword123',
	// ...
};
```

### 2. `lib/types/event.ts` - Типы мероприятий

**Основные интерфейсы:**

- `Event` - полная информация о мероприятии
- `EventTranslations` - мультиязычные переводы
- `EventAdditionalField` - дополнительные поля для регистрации
- `EventStatus` - статус мероприятия ('draft' | 'active' | 'cancelled')
- `FieldType` - типы полей (text, textarea, select, checkbox, radio, number, date, email, tel)
- `EventCreateData` - данные для создания
- `EventUpdateData` - данные для обновления
- `EventWithFields` - мероприятие с дополнительными полями
- `EventListItem` - минимальная информация для списков

**Использование:**

```typescript
import { Event, EventCreateData, EventStatus } from '$lib/types';

// Создание мероприятия
const eventData: EventCreateData = {
	title_de: 'Programmierkurs',
	description_de: 'Lerne Python programmieren',
	location_de: 'Dresden Neustadt',
	date: '2025-11-15T10:00:00Z',
	registration_deadline: '2025-11-10T23:59:59Z',
	max_participants: 20,
	status: 'draft',
	additional_fields: [
		{
			field_key: 'experience',
			field_type: 'select',
			field_options: JSON.stringify(['Anfaenger', 'Fortgeschritten']),
			required: true,
			label_de: 'Erfahrungsstufe',
			// ...
		},
	],
};
```

### 3. `lib/types/registration.ts` - Типы регистраций

**Основные интерфейсы:**

- `Registration` - регистрация на мероприятие
- `RegistrationWithUser` - с данными пользователя
- `RegistrationWithEvent` - с данными мероприятия
- `RegistrationWithDetails` - полная информация
- `RegistrationCreateData` - данные для создания
- `RegistrationCancelData` - данные для отмены
- `RegistrationListItem` - для списков

**Использование:**

```typescript
import { RegistrationCreateData, RegistrationWithDetails } from '$lib/types';

// Создание регистрации
const regData: RegistrationCreateData = {
	event_id: 123,
	additional_data: {
		experience: 'Anfaenger',
		dietary_restrictions: 'vegetarisch',
	},
	profile_confirmed: true,
};

// Получение с деталями
const registration: RegistrationWithDetails = await db.getRegistrationWithDetails(id);
```

### 4. `lib/types/admin.ts` - Типы администрирования

**Основные интерфейсы:**

- `Admin` - запись администратора
- `AdminWithUser` - с данными пользователя
- `ActivityLog` - лог действий
- `ActivityLogAction` - типы действий
- `ActivityLogWithUser` - лог с пользователем
- `DeletedUserArchive` - архив удаленных пользователей
- `PendingDeletion` - запланированное удаление
- `PendingDeletionWithUser` - с данными пользователя
- `AdminGrantData` - данные для выдачи прав
- `AdminRevokeData` - данные для отзыва прав
- `ActivityLogCreateData` - данные для логирования

**Использование:**

```typescript
import { ActivityLogCreateData, ActivityLogAction } from '$lib/types';

// Логирование действия
const logData: ActivityLogCreateData = {
	user_id: 123,
	action_type: 'event_register',
	details: {
		event_id: 456,
		event_title: 'Programmierkurs',
	},
	ip_address: request.headers.get('cf-connecting-ip'),
};

await db.createActivityLog(logData);
```

### 5. `lib/types/api.ts` - Типы API

**Основные интерфейсы:**

- `ApiResponse<T>` - успешный ответ API
- `ApiErrorResponse` - ошибочный ответ
- `ApiResult<T>` - объединенный тип
- `ApiError` - информация об ошибке
- `PaginatedResponse<T>` - пагинированный ответ
- `PaginationParams` - параметры пагинации
- `LoginRequest` / `LoginResponse` - данные входа
- `EventStatistics` - статистика мероприятий
- `UserStatistics` - статистика пользователей
- `SystemStatistics` - общая статистика
- `NewsletterRequest` / `NewsletterResponse` - массовая рассылка
- `ExportRequest` - экспорт данных
- `ImportEventsRequest` / `ImportEventsResponse` - импорт мероприятий
- Фильтры: `EventFilterParams`, `UserFilterParams`, `RegistrationFilterParams`

**Использование:**

```typescript
import { ApiResponse, ApiErrorResponse, PaginatedResponse } from '$lib/types';

// Успешный ответ
export const GET = async () => {
	const events = await db.getEvents();
	const response: ApiResponse<Event[]> = {
		success: true,
		data: events,
		message: 'Events retrieved successfully',
	};
	return json(response);
};

// Ошибочный ответ
export const POST = async () => {
	const error: ApiErrorResponse = {
		success: false,
		error: 'Invalid email format',
		code: 'VALIDATION_ERROR',
		statusCode: 400,
	};
	return json(error, { status: 400 });
};

// Пагинированный ответ
const paginatedEvents: PaginatedResponse<Event> = {
	items: events,
	total: 100,
	page: 1,
	page_size: 20,
	total_pages: 5,
	has_next: true,
	has_prev: false,
};
```

## Именование полей

### Правила:

1. **Поля БД (snake_case)**: `user_id`, `first_name`, `created_at`
2. **Переменные JS/TS (camelCase)**: `userId`, `firstName`, `createdAt`
3. **Компоненты (PascalCase)**: `UserProfile`, `EventCard`
4. **Константы (UPPER_SNAKE_CASE)**: `MAX_PARTICIPANTS`, `API_BASE_URL`

### Важно:

- Все интерфейсы типов используют **snake_case** для соответствия с БД
- При передаче данных из БД в клиентский код конвертация НЕ требуется
- Это упрощает работу с D1 и избегает проблем с маппингом

## Мультиязычность

Поля с переводами имеют суффикс языка: `_de`, `_en`, `_ru`, `_uk`

```typescript
interface Event {
	title_de: string; // обязательно
	title_en?: string | null; // опционально
	title_ru?: string | null;
	title_uk?: string | null;
}
```

**Fallback логика:** Если перевод для текущего языка отсутствует, используется немецкий вариант (`*_de`).

## Nullable поля

Используется `string | null` вместо `string | undefined` для полей БД, которые могут быть NULL:

```typescript
interface User {
	whatsapp: string | null; // NULL в БД
	telegram: string | null; // NULL в БД
}
```

## Типы для форм

Для форм используются отдельные интерфейсы с суффиксом `Data`:

- `UserRegistrationData` - для регистрации
- `UserUpdateData` - для обновления профиля
- `EventCreateData` - для создания мероприятия
- `RegistrationCreateData` - для записи на мероприятие

Эти типы включают дополнительные поля валидации (например, `password_confirm`, `gdpr_consent`).

## JSON поля

Поля, хранящиеся как JSON в БД:

```typescript
interface Registration {
	additional_data: string | null; // JSON string в БД
}

// При работе в коде:
const parsedData: Record<string, unknown> = JSON.parse(registration.additional_data || '{}');
```

## Импорт типов

Все типы можно импортировать из центрального файла:

```typescript
import type {
	User,
	UserProfile,
	Event,
	Registration,
	Admin,
	ApiResponse,
	PaginatedResponse,
	LanguageCode,
} from '$lib/types';
```

Или из конкретных файлов:

```typescript
import type { User, UserProfile } from '$lib/types/user';
import type { Event, EventStatus } from '$lib/types/event';
import type { LanguageCode } from '$lib/types/common';
```

## Общие типы (LanguageCode)

Для унификации языковых кодов создан тип `LanguageCode`:

```typescript
// lib/types/common.ts
export type LanguageCode = 'de' | 'en' | 'ru' | 'uk';
export type LanguageCodeOrAll = LanguageCode | 'all';

// Использование
const userLang: LanguageCode = 'de';
const filterLang: LanguageCodeOrAll = 'all';
```

Этот тип используется везде:

- `User.preferred_language`
- `LoginResponse.user.preferred_language`
- `NewsletterRequest.target_language`

## Type Guards

Для проверки типов API ответов:

```typescript
function isApiError(response: ApiResult): response is ApiErrorResponse {
	return response.success === false;
}

const result = await fetch('/api/events');
const data: ApiResult<Event[]> = await result.json();

if (isApiError(data)) {
	console.error(data.error);
} else {
	console.log(data.data); // Event[]
}
```

## Строгая типизация

Все типы строго типизированы, использование `any` запрещено.

Исключения:

- `Record<string, unknown>` для динамических JSON данных
- `unknown` в generic типах с последующим narrowing

## Дополнительная информация

Все интерфейсы содержат JSDoc комментарии на русском языке для удобства разработки.
