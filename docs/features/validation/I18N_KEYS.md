# Validation I18N Keys

## Обзор

Все сообщения об ошибках валидации Zod теперь используют i18n ключи вместо жёстко закодированных строк.

## Реализация

- **Схемы валидации**: `src/lib/validation/schemas.ts` - все message теперь содержат ключи вида `validation.*`
- **Маппинг в формах**:
  - **Клиентские ошибки**: В `validateField()` автоматически переводятся через `$_(errorKey, { default: errorKey })`
  - **Серверные ошибки**: В обработчиках `!response.ok` проверяется тип и переводятся i18n ключи
- **Fallback стратегия**: Если перевод отсутствует, отображается сам ключ (например, `validation.emailRequired`)

## Список всех ключей валидации

### Email валидация

- `validation.emailRequired` - Email обязателен
- `validation.emailInvalid` - Неверный формат email

### Пароль валидация

- `validation.passwordRequired` - Пароль обязателен
- `validation.passwordMinLength` - Пароль должен содержать минимум 8 символов
- `validation.passwordComplexity` - Пароль должен содержать буквы и цифры
- `validation.passwordConfirmRequired` - Подтверждение пароля обязательно
- `validation.passwordMismatch` - Пароли не совпадают

### Имя/Фамилия валидация

- `validation.fieldRequired` - Поле обязательно для заполнения
- `validation.nameMaxLength` - Имя слишком длинное (максимум 100 символов)
- `validation.nameOnlyLetters` - Имя должно содержать только буквы

### Дата рождения валидация

- `validation.dateFormat` - Дата должна быть в формате YYYY-MM-DD
- `validation.dateInvalid` - Неверная дата
- `validation.dateFuture` - Дата рождения не может быть в будущем
- `validation.ageRange` - Возраст должен быть от 10 до 100 лет

### Телефон валидация

- `validation.phoneRequired` - Номер телефона обязателен
- `validation.phoneInvalid` - Неверный формат номера телефона (используйте +49... или 0...)

### Адрес валидация

- `validation.streetRequired` - Улица обязательна
- `validation.houseNumberRequired` - Номер дома обязателен
- `validation.zipRequired` - Почтовый индекс обязателен
- `validation.zipInvalid` - Почтовый индекс должен состоять из 5 цифр
- `validation.cityRequired` - Город обязателен

### Согласия (GDPR, Parental)

- `validation.parentalConsentRequired` - Согласие родителей обязательно для пользователей младше 18 лет
- `validation.gdprConsentRequired` - Согласие с политикой обработки данных обязательно

### Обновление профиля

- `validation.currentPasswordRequired` - Текущий пароль обязателен для установки нового пароля
- `validation.newPasswordMismatch` - Новые пароли не совпадают

## Примеры использования

### В schemas.ts

```typescript
const emailSchema = z
	.string()
	.min(1, { message: 'validation.emailRequired' })
	.email({ message: 'validation.emailInvalid' });
```

### В компонентах форм

```typescript
function validateField(fieldName: string) {
	try {
		schema.parse(formData);
		delete errors[fieldName];
	} catch (err: any) {
		const fieldErrors = err.issues.filter((issue: any) => issue.path[0] === fieldName);
		if (fieldErrors.length > 0) {
			const errorKey = fieldErrors[0].message;
			errors[fieldName] = $_(errorKey, { default: errorKey });
		}
	}
}
```

### Обработка серверных ошибок валидации

```typescript
// В handleSubmit - обработка ошибок с сервера
result.errors.forEach((err: any) => {
	if (err.field && err.message) {
		// Если сообщение - строка (i18n ключ), переводим его
		if (typeof err.message === 'string') {
			errors[err.field] = $_(err.message, { default: err.message });
		} else {
			// Используем сообщение на текущем языке (старый формат)
			const currentLang = $locale as 'de' | 'en' | 'ru' | 'uk';
			errors[err.field] = err.message[currentLang] || err.message.de || err.message;
		}
	}
});
```

## TODO: Добавить переводы

Следующий шаг - добавить эти ключи в файлы переводов:

- `static/translations/de.json`
- `static/translations/en.json`
- `static/translations/ru.json`
- `static/translations/uk.json`

Пример структуры в JSON:

```json
{
  "validation": {
    "emailRequired": "E-Mail ist erforderlich",
    "emailInvalid": "Ungültiges E-Mail-Format",
    "passwordRequired": "Passwort ist erforderlich",
    ...
  }
}
```
