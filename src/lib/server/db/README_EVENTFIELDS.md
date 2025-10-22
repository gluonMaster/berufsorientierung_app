# EventFields Database Utilities

Утилиты для работы с дополнительными полями мероприятий (`event_additional_fields`).

**ВАЖНО:** Все функции автоматически обрабатывают сериализацию/десериализацию JSON для `field_options`.

## Функции

### `setEventFields(db, eventId, fields)`

Заменяет все дополнительные поля для мероприятия. Использует транзакцию для атомарности.

**Параметры:**

- `db: D1Database` - База данных D1
- `eventId: number` - ID мероприятия
- `fields: EventAdditionalFieldInput[]` - Массив новых полей

**Поведение:**

- Если `fields` пустой массив → удаляет все существующие поля
- Если `fields` содержит элементы → удаляет старые и вставляет новые
- Все операции выполняются в одной транзакции (атомарно)
- **Автоматически сериализует** `field_options` из массива в JSON строку

**Пример:**

```typescript
await setEventFields(db, 1, [
	{
		field_key: 'dietary_requirements',
		field_type: 'select',
		field_options: ['vegetarisch', 'vegan', 'keine'], // Передаём как массив!
		required: false,
		label_de: 'Ernährungseinschränkungen',
		label_en: 'Dietary requirements',
		label_ru: 'Диетические требования',
		label_uk: 'Дієтичні вимоги',
		placeholder_de: 'Bitte auswählen',
		placeholder_en: 'Please select',
		placeholder_ru: 'Пожалуйста, выберите',
		placeholder_uk: 'Будь ласка, оберіть',
	},
]);
```

---

### `getEventFields(db, eventId)`

Получает все дополнительные поля для мероприятия, отсортированные по ID.

**Параметры:**

- `db: D1Database` - База данных D1
- `eventId: number` - ID мероприятия

**Возвращает:**

- `Promise<EventAdditionalField[]>` - Массив полей (может быть пустым)

**Особенности:**

- **Автоматически парсит** `field_options` из JSON строки в массив строк
- `required` преобразуется из SQLite integer (0/1) в boolean
- Поля сортируются по ID (порядок добавления)
- Безопасная обработка: если JSON битый → возвращает `null` вместо падения

**Пример:**

```typescript
const fields = await getEventFields(db, 1);
// [
//   {
//     id: 1,
//     event_id: 1,
//     field_key: 'dietary_requirements',
//     field_type: 'select',
//     field_options: ['vegetarisch', 'vegan', 'keine'], // Уже распарсенный массив!
//     required: false,
//     label_de: 'Ernährungseinschränkungen',
//     ...
//   }
// ]
```

---

### `deleteEventFields(db, eventId)`

Удаляет все дополнительные поля для мероприятия.

**Параметры:**

- `db: D1Database` - База данных D1
- `eventId: number` - ID мероприятия

**Использование:**

- При удалении мероприятия
- При необходимости полностью очистить все дополнительные поля

**Пример:**

```typescript
await deleteEventFields(db, 1);
// Все поля для мероприятия с ID=1 удалены
```

---

## Важные замечания

### Работа с `field_options`

#### ✅ Новая версия (после рефакторинга):

**При сохранении (setEventFields):**

```typescript
// Передаём как массив строк
field_options: ['option1', 'option2', 'option3'];
// Автоматически сериализуется в: '["option1","option2","option3"]'
```

**При получении (getEventFields):**

```typescript
// Возвращается как массив строк
field_options: ['option1', 'option2', 'option3'];
// Автоматически распарсено из: '["option1","option2","option3"]'
```

**Типы:**

```typescript
// Input тип (для setEventFields)
type EventAdditionalFieldInput = {
	field_options: string[] | null; // Массив или null
	// ...
};

// Output тип (из getEventFields)
interface EventAdditionalField {
	field_options: string[] | null; // Уже распарсенный массив
	// ...
}
```

### Безопасность парсинга JSON

`getEventFields` использует `try/catch` при парсинге JSON:

```typescript
try {
	const parsed = JSON.parse(field.field_options);
	if (Array.isArray(parsed)) {
		parsedOptions = parsed;
	}
} catch (error) {
	console.error('Failed to parse field_options:', error);
	parsedOptions = null; // Возвращаем null вместо падения
}
```

**Поведение при ошибках:**

- Битый JSON → `field_options = null`
- Пустая строка → `field_options = null`
- `null` в БД → `field_options = null`
- Не массив → `field_options = null`

### Транзакции

`setEventFields` использует `db.batch()` для выполнения всех операций атомарно:

1. Удаляет все существующие поля
2. Вставляет новые поля

Если любая операция провалится → все изменения откатываются.

### Типы полей

Поддерживаемые типы (`FieldType`):

- `text` - Текстовое поле (`field_options: null`)
- `select` - Выпадающий список (`field_options: string[]`)
- `checkbox` - Чекбокс группа (`field_options: string[]`)
- `date` - Поле для даты (`field_options: null`)
- `number` - Числовое поле (`field_options: null`)

### Мультиязычность

Все текстовые поля имеют 4 языковые версии:

- `label_de` - обязательно
- `label_en`, `label_ru`, `label_uk` - опционально
- `placeholder_de`, `placeholder_en`, `placeholder_ru`, `placeholder_uk` - опционально

---

## Интеграция с events.ts

Эти утилиты используются в:

```typescript
// ✅ Правильно: используем setEventFields
import { setEventFields, getEventFields } from './eventFields';

// В createEvent()
if (data.additional_fields && data.additional_fields.length > 0) {
	await setEventFields(db, eventId, data.additional_fields);
}

// В updateEvent()
if (data.additional_fields) {
	await setEventFields(db, id, data.additional_fields);
}

// В getEventWithFields()
const additionalFields = await getEventFields(db, id);
return {
	...event,
	additional_fields: additionalFields,
};
```

**Преимущества:**

- ✅ Консистентная обработка JSON во всём приложении
- ✅ Один источник правды для сериализации/парсинга
- ✅ Автоматическая валидация типов через TypeScript
- ✅ Безопасная обработка ошибок парсинга
- ✅ Меньше дублирования кода

---

## Тесты

Тесты находятся в `tests/unit/db-eventFields.test.ts`.

Запуск тестов:

```bash
npm test -- db-eventFields
```

### Покрытие:

- ✅ Добавление новых полей
- ✅ Замена существующих полей
- ✅ Удаление через пустой массив
- ✅ Получение полей
- ✅ Изоляция между мероприятиями
- ✅ **JSON round-trip** (сериализация → хранение → десериализация)
- ✅ Обработка битого JSON
- ✅ Обработка пустой строки

### JSON Round-Trip тест:

```typescript
it('должна корректно сериализовать и десериализовать field_options', async () => {
	const inputOptions = ['vegetarisch', 'vegan', 'keine Einschränkungen'];

	// Сохраняем
	await setEventFields(db, 1, [
		{
			field_options: inputOptions, // Массив
			// ...
		},
	]);

	// Проверяем storage (JSON строка)
	expect(storedField.field_options).toBe(JSON.stringify(inputOptions));

	// Проверяем получение (массив)
	const fields = await getEventFields(db, 1);
	expect(fields[0].field_options).toEqual(inputOptions);
});
```

---

## Миграция со старой версии

### До (старая версия):

```typescript
// field_options оставался как строка
field_options: string | null;

// Клиент должен был парсить вручную:
const options = field.field_options ? JSON.parse(field.field_options) : null;
```

### После (новая версия):

```typescript
// field_options автоматически парсится
field_options: string[] | null;

// Готово к использованию:
const options = field.field_options; // Уже массив!
```

**Миграция не требуется** - БД структура не изменилась, только логика обработки в коде.
