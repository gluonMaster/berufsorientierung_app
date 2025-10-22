# Мультиязычность (i18n)

Проект поддерживает 4 языка: немецкий (de), английский (en), русский (ru) и украинский (uk).

## Структура

- **`static/translations/`** - JSON файлы с переводами для каждого языка
- **`src/lib/stores/language.ts`** - Store управления языком
- **`src/lib/components/layout/LanguageSwitcher.svelte`** - Компонент переключения языка

## Использование в компонентах

### Базовое использование

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<h1>{$_('common.welcome')}</h1>
<button>{$_('common.login')}</button>
<p>{$_('events.spotsLeft', { values: { count: 5 } })}</p>
```

### Переключение языка

```svelte
<script lang="ts">
	import { changeLanguage } from '$lib/stores/language';

	async function switchToGerman() {
		await changeLanguage('de');
	}
</script>

<button onclick={switchToGerman}>Deutsch</button>
```

### Использование компонента LanguageSwitcher

```svelte
<script lang="ts">
	import LanguageSwitcher from '$lib/components/layout/LanguageSwitcher.svelte';
</script>

<LanguageSwitcher />
```

## Добавление новых переводов

1. Откройте файл перевода в `static/translations/[lang].json`
2. Добавьте ключ и значение в соответствующую секцию
3. Повторите для всех языков
4. Используйте новый ключ через `$_('your.new.key')`

### Пример с параметрами

```json
{
	"events": {
		"spotsLeft": "{count} места доступно"
	}
}
```

```svelte
{$_('events.spotsLeft', { values: { count: registeredCount } })}
```

## Инициализация

i18n инициализируется автоматически в главном `+layout.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { initializeI18n } from '$lib/stores/language';
	import { waitLocale } from 'svelte-i18n';

	onMount(async () => {
		await initializeI18n();
		await waitLocale();
	});
</script>
```

## Функции Store

### `initializeI18n()`

Инициализирует i18n, загружает переводы, определяет язык пользователя.

### `changeLanguage(lang: LanguageCode)`

Меняет текущий язык и сохраняет выбор в localStorage.

### `currentLanguage`

Svelte store с текущим языком.

### `currentLanguageInfo`

Derived store с полной информацией о языке (code, name, flag, nativeName).

### `SUPPORTED_LANGUAGES`

Объект с информацией обо всех поддерживаемых языках.

## Fallback переводов

Если для текущего языка не найден перевод, автоматически используется немецкий (de) как fallback.

Для полей событий в базе данных (title, description, requirements, location):

- Если значение для текущего языка (`title_ru`) пустое
- Отображается значение из немецкого варианта (`title_de`)

## Мобильная адаптация

LanguageSwitcher адаптивен:

- **< 640px**: показывает только флаги в кнопке
- **≥ 640px**: показывает флаги + названия языков
- **Dropdown**: всегда показывает полные названия

## Доступность (a11y)

- Все кнопки имеют `aria-label`
- Dropdown имеет `role="menu"` и `role="menuitem"`
- Клавиатурная навигация (Escape для закрытия)
- Минимальная высота 44px для touch-friendly интерфейса

## Примеры использования

### Header с переключателем языка

```svelte
<script lang="ts">
	import Header from '$lib/components/layout/Header.svelte';
</script>

<Header isAuthenticated={true} isAdmin={false} />
```

### Форма с переводами

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<form>
	<label>
		{$_('form.firstName')}
		<input type="text" required />
		<span class="hint">{$_('form.required')}</span>
	</label>

	<button type="submit">{$_('form.submit')}</button>
</form>
```

### Сообщения об ошибках

```svelte
<script lang="ts">
	import { _ } from 'svelte-i18n';

	let error = $state('');
</script>

{#if error}
	<div class="error">
		{$_('errors.generic')}: {error}
	</div>
{/if}
```

## Структура переводов

Все переводы организованы по категориям:

- `common` - общие элементы UI
- `form` - поля форм
- `validation` - валидация
- `auth` - аутентификация
- `events` - мероприятия
- `profile` - профиль
- `gdpr` - GDPR
- `email` - email шаблоны
- `admin` - админ-панель
- `errors` - ошибки
- `nav` - навигация

Каждая категория имеет вложенную структуру для организации связанных переводов.
