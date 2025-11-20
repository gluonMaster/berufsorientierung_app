# Validation Schemas

Этот модуль содержит все Zod схемы валидации для приложения.

## Использование

### Базовая валидация

```typescript
import { userRegistrationSchema, validateWithLocalization } from '$lib/server/validation/schemas';

const result = validateWithLocalization(userRegistrationSchema, formData);

if (!result.success) {
	// Ошибки с переводами на все языки
	console.log(result.errors);
	// [
	//   {
	//     field: 'email',
	//     message: {
	//       de: 'E-Mail ist erforderlich',
	//       en: 'Email is required',
	//       ru: 'Email обязателен',
	//       uk: 'Email обов'язковий'
	//     }
	//   }
	// ]
}

// result.data содержит валидированные данные с правильными типами
const user = result.data;
```

### Прямое использование схем

```typescript
import { userLoginSchema } from '$lib/server/validation/schemas';

const result = userLoginSchema.safeParse(data);

if (result.success) {
	// result.data типизирован
	const { email, password } = result.data;
}
```

## Доступные схемы

### Пользователи

- `userRegistrationSchema` - регистрация (включает проверку возраста для parental_consent)
- `userLoginSchema` - вход в систему
- `userUpdateSchema` - обновление профиля (с поддержкой смены пароля)

### Мероприятия

- `eventCreateSchema` - создание мероприятия
- `eventUpdateSchema` - обновление мероприятия
- `eventCreateWithFieldsSchema` - создание с доп. полями
- `eventUpdateWithFieldsSchema` - обновление с доп. полями
- `additionalFieldSchema` - дополнительное поле

### Регистрации

- `registrationCreateSchema` - запись на мероприятие
- `registrationCancelSchema` - отмена записи

### Админские операции

- `eventCancelSchema` - отмена мероприятия
- `bulkEmailSchema` - массовая рассылка

## Особенности

### Автоматические проверки

1. **Возраст и согласие родителей**: Если пользователю < 18 лет, `parental_consent` должен быть `true`
2. **Данные опекуна для несовершеннолетних**: Если пользователю < 18 лет, обязательны:
   - `guardian_first_name` (имя опекуна)
   - `guardian_last_name` (фамилия опекуна)
   - `guardian_phone` (телефон опекуна, расширенная валидация: +49..., +380..., +7..., и другие страны ЕС)
   - `guardian_consent` (согласие опекуна)
3. **Совпадение паролей**: `password` и `password_confirm` должны совпадать
4. **Даты мероприятия**: `registration_deadline` должен быть раньше `date`
5. **Дополнительные поля**: Для `select` обязательны `field_options`
6. **Мультиязычность мероприятий**: Только `title_de` обязателен, `description_*` и `location_*` опциональны

### Форматы

- **Email**: стандартная валидация + lowercase + trim
- **Телефон**: немецкий и международный формат (+49..., +380..., +7..., 0..., и другие E.164)
- **Телефон опекуна**: расширенная валидация для поддержки мигрантов (Германия, Украина, Россия, ЕС)
- **ZIP**: 5 цифр
- **Дата рождения**: YYYY-MM-DD, не в будущем, возраст 10-100 лет
- **URL**: валидная структура URL
- **Пароль**: минимум 8 символов, буквы + цифры
- **Типы дополнительных полей**: только `text`, `select`, `checkbox`, `date`, `number`

### Локализация ошибок

Все ошибки автоматически переводятся на 4 языка (de, en, ru, uk).

Добавить новый перевод:

```typescript
const errorTranslations: Record<string, { de: string; en: string; ru: string; uk: string }> = {
	'Your error message': {
		de: 'German translation',
		en: 'Your error message',
		ru: 'Russian translation',
		uk: 'Ukrainian translation',
	},
};
```

## TypeScript типы

Все схемы экспортируют соответствующие TypeScript типы:

```typescript
import type {
	UserRegistrationInput,
	UserLoginInput,
	EventCreateInput,
	RegistrationCreateInput,
} from '$lib/server/validation/schemas';
```
