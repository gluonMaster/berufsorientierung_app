# Мультиязычность - Инструкция по использованию

## ✅ Что создано

1. **Language Store** (`src/lib/stores/language.ts`)
   - Инициализация i18n
   - Управление текущим языком
   - Сохранение в localStorage
   - Автоопределение языка браузера
   - Загрузка переводов

2. **LanguageSwitcher Component** (`src/lib/components/layout/LanguageSwitcher.svelte`)
   - Dropdown с флагами и названиями языков
   - Мобильная адаптация (только флаги на <640px)
   - Клавиатурная навигация (Escape)
   - Click outside для закрытия
   - Accessibility (ARIA labels)

3. **Header Component** (`src/lib/components/layout/Header.svelte`)
   - Навигация с интеграцией LanguageSwitcher
   - Адаптивное меню (бургер на мобильных)
   - Поддержка аутентификации и админ-прав

4. **Переводы** (`static/translations/`)
   - `de.json` - Немецкий (по умолчанию)
   - `en.json` - Английский
   - `ru.json` - Русский
   - `uk.json` - Украинский

5. **Утилиты**
   - `src/lib/utils/clickOutside.ts` - Svelte action для закрытия dropdown
   - Тесты для language store

## 🚀 Запуск проекта

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск dev сервера

```bash
npm run dev
```

Откройте браузер на `http://localhost:5173`

### 3. Тестирование

```bash
# Запустить все тесты
npm test

# Запустить тесты в watch режиме
npm run test:watch

# Запустить тесты с UI
npm run test:ui
```

## 📖 Использование

### В компонентах Svelte

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<h1>{$_('common.welcome')}</h1>
<button>{$_('common.login')}</button>
```

### С параметрами

```svelte
<p>{$_('events.spotsLeft', { values: { count: 5 } })}</p>
```

### Добавление LanguageSwitcher

```svelte
<script lang="ts">
	import LanguageSwitcher from '$lib/components/layout/LanguageSwitcher.svelte';
</script>

<LanguageSwitcher />
```

### Программное изменение языка

```svelte
<script lang="ts">
	import { changeLanguage } from '$lib/stores/language';

	async function switchLanguage(lang: 'de' | 'en' | 'ru' | 'uk') {
		await changeLanguage(lang);
	}
</script>

<button onclick={() => switchLanguage('de')}>Deutsch</button>
```

## 🌍 Поддерживаемые языки

| Код | Язык       | Название   | Флаг |
| --- | ---------- | ---------- | ---- |
| de  | Deutsch    | Немецкий   | 🇩🇪   |
| en  | English    | Английский | 🇬🇧   |
| ru  | Русский    | Русский    | 🇷🇺   |
| uk  | Українська | Украинский | 🇺🇦   |

## 📱 Мобильная адаптация

LanguageSwitcher автоматически адаптируется:

- **< 640px**: только флаги в кнопке
- **≥ 640px**: флаги + названия
- **Dropdown**: всегда полные названия

## ♿ Accessibility

- Все кнопки имеют `aria-label`
- Dropdown с `role="menu"` и `role="menuitem"`
- Клавиатурная навигация (Tab, Escape)
- Минимальная высота 44px для touch

## 🎨 Стилизация

Компоненты используют:

- Utility-first подход с inline стилями
- Tailwind-подобные значения цветов и отступов
- Поддержка dark mode (через media query)
- Плавные transitions

## 🔧 Конфигурация

### Изменение языка по умолчанию

В `src/lib/stores/language.ts`:

```typescript
const DEFAULT_LANGUAGE: LanguageCode = 'de'; // Измените на нужный
```

### Добавление нового языка

1. Создайте `static/translations/[code].json`
2. Добавьте в `SUPPORTED_LANGUAGES`:

```typescript
export const SUPPORTED_LANGUAGES = {
	// ...existing languages
	fr: { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
} as const;
```

3. Обновите тип:

```typescript
export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;
```

## 🐛 Troubleshooting

### Переводы не загружаются

Проверьте:

1. Файлы существуют в `static/translations/`
2. JSON валиден
3. Путь к переводам правильный (`/translations/${lang}.json`)

### localStorage не работает

- localStorage работает только в браузере
- В SSR (server-side) localStorage недоступен
- Store автоматически обрабатывает это через `browser` flag

### Переводы не обновляются

1. Перезапустите dev сервер
2. Очистите кеш браузера
3. Проверьте Network tab в DevTools

## 📝 Структура переводов

```json
{
  "common": { ... },      // Общие элементы UI
  "form": { ... },        // Поля форм
  "validation": { ... },  // Валидация
  "auth": { ... },        // Аутентификация
  "events": { ... },      // Мероприятия
  "profile": { ... },     // Профиль
  "gdpr": { ... },        // GDPR
  "email": { ... },       // Email шаблоны
  "admin": { ... },       // Админ-панель
  "errors": { ... },      // Ошибки
  "nav": { ... }          // Навигация
}
```

## 🎯 Следующие шаги

1. ✅ Мультиязычность настроена
2. ⏭️ Создать базу данных (D1)
3. ⏭️ Настроить аутентификацию
4. ⏭️ Создать API endpoints
5. ⏭️ Создать UI компоненты

## 📚 Документация

- [svelte-i18n](https://github.com/kaisermann/svelte-i18n)
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)

## 💡 Tips

1. **Всегда используйте переводы**, даже для одного языка
2. **Группируйте связанные переводы** по смыслу
3. **Используйте параметры** для динамического контента
4. **Тестируйте на всех языках** перед деплоем
5. **Fallback на немецкий** работает автоматически
