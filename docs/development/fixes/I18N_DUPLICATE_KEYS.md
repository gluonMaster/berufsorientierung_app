# I18n Duplicate Keys Fix

**Дата:** 11 ноября 2025  
**Категория:** i18n / Translations  
**Статус:** ✅ Исправлено

---

## 🐛 Проблема

В JSON-файлах переводов (`static/translations/*.json`) существовали **дублирующие ключи**:

### Конфликтующая структура:

```json
{
	"admin": {
		"registrations": "Registrations", // ❌ Простая строка (затирается)
		"newsletter": "Newsletter", // ❌ Простая строка (затирается)
		"nav": {
			"registrations": "Registrations", // ✓ Для навигации
			"newsletter": "Newsletter" // ✓ Для навигации
		},
		"registrations": {
			// ✓ Объект побеждает!
			"title": "...",
			"description": "..."
		},
		"newsletter": {
			// ✓ Объект побеждает!
			"title": "...",
			"step1_title": "..."
		}
	}
}
```

### Почему это проблема?

В JavaScript/JSON **последнее значение ключа перезаписывает предыдущие**. Если в одном объекте есть:

1. `"registrations": "Registrations"` (строка)
2. `"registrations": { ... }` (объект)

То объект **затирает** строку, и ссылки на простой ключ `$_('admin.registrations')` возвращают объект вместо строки.

---

## ✅ Решение

### Удалены дублирующие простые ключи

Из всех 4 языков (de, en, ru, uk) **удалены** простые строковые ключи:

```json
// УДАЛЕНО:
"registrations": "Registrations",
"newsletter": "Newsletter",
```

### Оставлена правильная структура:

```json
{
	"admin": {
		"nav": {
			"registrations": "Registrations", // ✓ Для навигационного меню
			"newsletter": "Newsletter" // ✓ Для навигационного меню
		},
		"registrations": {
			// ✓ Для страницы /admin/registrations
			"title": "Manage Registrations",
			"description": "...",
			"filters": "..."
			// ... все ключи контента страницы
		},
		"newsletter": {
			// ✓ Для страницы /admin/newsletter
			"title": "Newsletter",
			"description": "...",
			"step1_title": "..."
			// ... все ключи контента страницы
		}
	}
}
```

---

## 📦 Изменённые файлы

1. **`static/translations/de.json`**
   - Удалены: `admin.registrations` (строка), `admin.newsletter` (строка)
   - Оставлены: `admin.nav.registrations`, `admin.nav.newsletter`, объекты `admin.registrations {...}`, `admin.newsletter {...}`

2. **`static/translations/en.json`**
   - Аналогично

3. **`static/translations/ru.json`**
   - Аналогично

4. **`static/translations/uk.json`**
   - Аналогично

---

## 🔍 Использование в коде

### Навигация (Layout)

**Файл:** `src/routes/admin/+layout.svelte`

```svelte
const navItems = [
  { path: '/admin/registrations', label: 'admin.nav.registrations', ... },
  { path: '/admin/newsletter', label: 'admin.nav.newsletter', ... },
];
```

✅ **Правильно:** Используется `admin.nav.registrations` и `admin.nav.newsletter`

### Контент страниц

**Файл:** `src/routes/admin/registrations/+page.svelte`

```svelte
<h1>{$_('admin.registrations.title')}</h1><p>{$_('admin.registrations.description')}</p>
```

✅ **Правильно:** Используются вложенные ключи `admin.registrations.*`

**Файл:** `src/routes/admin/newsletter/+page.svelte`

```svelte
<h1>{$_('admin.newsletter.title')}</h1><p>{$_('admin.newsletter.step1_title')}</p>
```

✅ **Правильно:** Используются вложенные ключи `admin.newsletter.*`

---

## ✅ Проверка исправления

После исправления выполнена проверка всех 4 языков:

```
DE:
  admin.nav.registrations: "Anmeldungen" ✓
  admin.nav.newsletter: "Newsletter" ✓
  admin.registrations: OBJECT ✓
  admin.newsletter: OBJECT ✓

EN:
  admin.nav.registrations: "Registrations" ✓
  admin.nav.newsletter: "Newsletter" ✓
  admin.registrations: OBJECT ✓
  admin.newsletter: OBJECT ✓

RU:
  admin.nav.registrations: "Регистрации" ✓
  admin.nav.newsletter: "Рассылка" ✓
  admin.registrations: OBJECT ✓
  admin.newsletter: OBJECT ✓

UK:
  admin.nav.registrations: "Реєстрації" ✓
  admin.nav.newsletter: "Розсилка" ✓
  admin.registrations: OBJECT ✓
  admin.newsletter: OBJECT ✓
```

---

## 🎯 Результат

### Преимущества:

✅ **Нет конфликтов ключей** - каждый ключ имеет единственное значение  
✅ **Чёткое разделение** - навигация (`admin.nav.*`) отдельно от контента (`admin.registrations.*`)  
✅ **Консистентность** - одинаковая структура во всех 4 языках  
✅ **Предсказуемость** - `$_('admin.registrations.title')` всегда возвращает строку, не объект

### Правила использования:

📌 **Для навигационного меню:**

```svelte
$_('admin.nav.registrations') $_('admin.nav.newsletter')
```

📌 **Для контента страницы registrations:**

```svelte
$_('admin.registrations.title') $_('admin.registrations.description')
$_('admin.registrations.filters') // и т.д.
```

📌 **Для контента страницы newsletter:**

```svelte
$_('admin.newsletter.title') $_('admin.newsletter.step1_title') $_('admin.newsletter.confirm_send')
// и т.д.
```

---

## 📚 Связанные документы

- [i18n Setup](../../features/i18n/SETUP.md)
- [Translation Store](../../features/i18n/STORE.md)
- [Admin Feature Documentation](../../features/admin/README.md)

---

## 💡 Рекомендации для будущего

1. **Избегайте дублирующих ключей** в одном объекте JSON
2. **Используйте вложенность** для логической группировки:
   - `admin.nav.*` - для навигации
   - `admin.[page].*` - для контента конкретной страницы
3. **Проверяйте структуру** после добавления новых переводов:
   ```bash
   node -p "JSON.parse(require('fs').readFileSync('static/translations/en.json','utf8')).admin.newKey"
   ```
