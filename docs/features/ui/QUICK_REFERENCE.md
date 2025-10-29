# UI Components - Быстрый справочник

Краткая шпаргалка по всем UI компонентам.

---

## Button

```svelte
import {Button} from '$lib/components/ui';

<Button
	type="primary|secondary|danger"
	htmlType="button|submit|reset"
	size="sm|md|lg"
	disabled={boolean}
	loading={boolean}
	fullWidth={boolean}
	on:click={handler}
>
	Текст кнопки
</Button>
```

**Ключевые особенности:**

- Минимум 44px для тач
- Спиннер при loading
- **Автоблокировка при loading**
- **aria-busy при loading**
- Разграничение `type` (визуальный) и `htmlType` (HTML-атрибут)

---

## FormField

```svelte
import {FormField} from '$lib/components/ui';

<FormField
	label="Метка поля"
	name="fieldName"
	type="text|email|password|date|tel|textarea"
	placeholder="Подсказка"
	required={boolean}
	disabled={boolean}
	error="Текст ошибки"
	autocomplete="on|off|email|..."
	id="custom-id"
	bind:value={variable}
/>
```

**Типы полей:**

- `text` - обычный текст
- `email` - с валидацией email
- `password` - скрытый текст
- `date` - выбор даты
- `tel` - телефон
- `textarea` - многострочный текст

**Ключевые особенности:**

- **Детерминированный ID** (без SSR mismatch)
- Event forwarding через `$$restProps`

---

## Modal

```svelte
import {Modal} from '$lib/components/ui';

<Modal isOpen={boolean} onClose={handler} title="Заголовок модала">
	<!-- Содержимое -->
</Modal>
```

**Автоматическое:**

- Закрытие по ESC
- Закрытие по клику на backdrop
- Focus trap (Tab остается внутри)
- Блокировка скролла body

---

## Toast

```svelte
import {Toast} from '$lib/components/ui';

{#if showToast}
	<Toast message="Текст уведомления" type="success|error|info" duration={3000} onClose={handler} />
{/if}
```

**Типы:**

- `success` - зеленый (успех)
- `error` - красный (ошибка)
- `info` - синий (информация)

**Duration:**

- `3000` - 3 секунды (по умолчанию)
- `0` - без автозакрытия

---

## Импорт

```typescript
// Все компоненты сразу
import { Button, FormField, Modal, Toast } from '$lib/components/ui';

// Или индивидуально
import Button from '$lib/components/ui/Button.svelte';
```

---

## Tailwind классы

### Spacing (отступы)

```html
p-4 → padding: 4px p-8 → padding: 8px p-16 → padding: 16px p-24 → padding: 24px p-32 → padding: 32px
gap-4 → gap: 4px (для flex/grid)
```

### Адаптивность

```html
<!-- Mobile-first -->
<div class="text-sm md:text-base lg:text-lg">Текст меняет размер на разных экранах</div>

<!-- Брейкпоинты -->
sm: 640px (планшет портрет) md: 768px (планшет ландшафт) lg: 1024px (desktop) xl: 1280px (wide
desktop)
```

### Layout

```html
<!-- Flex -->
<div class="flex flex-col sm:flex-row gap-4">Вертикально на mobile, горизонтально на планшете+</div>

<!-- Grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
	1 колонка mobile, 2 планшет, 3 desktop
</div>
```

### Цвета

```html
blue-600 → #2563eb (primary) gray-200 → #e5e7eb (secondary) red-600 → #dc2626 (danger) green-500 →
#10b981 (success)
```

---

## Паттерны использования

### Форма с валидацией

```svelte
<script lang="ts">
	let email = '';
	let emailError = '';

	function validate() {
		emailError = !email.includes('@') ? 'Неверный email' : '';
	}
</script>

<FormField
	label="Email"
	name="email"
	type="email"
	required
	error={emailError}
	bind:value={email}
	on:blur={validate}
/>
```

### Модал с подтверждением

```svelte
<script lang="ts">
	let isOpen = false;

	function confirm() {
		// Действие
		isOpen = false;
	}
</script>

<Button on:click={() => (isOpen = true)}>Открыть</Button>

<Modal {isOpen} onClose={() => (isOpen = false)} title="Подтвердите">
	<div class="space-y-4">
		<p>Вы уверены?</p>
		<div class="flex gap-4">
			<Button on:click={() => (isOpen = false)}>Отмена</Button>
			<Button type="danger" on:click={confirm}>Подтвердить</Button>
		</div>
	</div>
</Modal>
```

### Toast при API вызове

```svelte
<script lang="ts">
	let showToast = false;
	let toastMsg = '';
	let toastType: 'success' | 'error' = 'info';

	async function save() {
		try {
			await fetch('/api/save', { method: 'POST' });
			toastMsg = 'Сохранено!';
			toastType = 'success';
		} catch {
			toastMsg = 'Ошибка!';
			toastType = 'error';
		}
		showToast = true;
	}
</script>

{#if showToast}
	<Toast message={toastMsg} type={toastType} onClose={() => (showToast = false)} />
{/if}
```

---

## Accessibility чеклист

- ✅ Все кнопки имеют видимый `focus ring`
- ✅ FormField связывает label с input через `for`/`id`
- ✅ Ошибки связаны с полями через `aria-describedby`
- ✅ Modal имеет `role="dialog"` и `aria-modal="true"`
- ✅ Toast имеет `role="alert"` для screen readers
- ✅ Минимальный размер кнопок 44x44px для тач
- ✅ Контрастность текста соответствует WCAG AA

---

## Демо

Запустите dev сервер и откройте:

```
http://localhost:5173/demo-ui
```

---

## 📚 Полная документация

- [README.md](./README.md) - Детальная документация
- [EXAMPLES.md](./EXAMPLES.md) - Полные примеры использования
