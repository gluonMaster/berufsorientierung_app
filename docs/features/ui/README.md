# UI Components - Базовые компоненты интерфейса

## 📋 Обзор

Набор переиспользуемых UI компонентов с полной поддержкой:

- ✅ Мобильной адаптации (mobile-first)
- ✅ Доступности (ARIA labels, focus management)
- ✅ Tailwind CSS styling
- ✅ TypeScript типизации
- ✅ Плавных анимаций

## 🎨 Компоненты

### 1. Button - Кнопка

**Расположение:** `src/lib/components/ui/Button.svelte`

#### Props:

```typescript
type: 'primary' | 'secondary' | 'danger' = 'primary'  // Визуальный тип
htmlType: 'button' | 'submit' | 'reset' = 'button'    // HTML-атрибут type
disabled: boolean = false
loading: boolean = false
size: 'sm' | 'md' | 'lg' = 'md'
fullWidth: boolean = false
```

#### Особенности:

- Минимальная высота **44px** для тач-экранов
- Спиннер загрузки при `loading={true}`
- **Автоматическая блокировка** при loading (disabled={disabled || loading})
- **aria-busy={loading}** для screen readers
- Плавные transition (200ms)
- Focus ring для accessibility
- Разграничение визуального типа (`type`) и HTML-типа (`htmlType`)

#### Примеры использования:

```svelte
<script>
	import { Button } from '$lib/components/ui';

	let loading = false;

	function handleClick() {
		loading = true;
		// ... выполнение действия
	}
</script>

<!-- Базовое использование -->
<Button on:click={handleClick}>Нажми меня</Button>

<!-- С загрузкой -->
<Button {loading} on:click={handleClick}>
	{loading ? 'Загрузка...' : 'Отправить'}
</Button>

<!-- Типы -->
<Button type="primary">Основная</Button>
<Button type="secondary">Второстепенная</Button>
<Button type="danger">Опасное действие</Button>

<!-- Размеры -->
<Button size="sm">Маленькая</Button>
<Button size="md">Средняя</Button>
<Button size="lg">Большая</Button>

<!-- Полная ширина -->
<Button fullWidth>Занимает всю ширину</Button>

<!-- Отключена -->
<Button disabled>Недоступна</Button>

<!-- Submit кнопка в форме -->
<form on:submit|preventDefault={handleSubmit}>
	<Button htmlType="submit" {loading}>Отправить форму</Button>
</form>
```

---

### 2. FormField - Поле формы

**Расположение:** `src/lib/components/ui/FormField.svelte`

#### Props:

```typescript
label: string                    // Обязательно
name: string                     // Обязательно (для связи с формой)
type: 'text' | 'email' | 'password' | 'date' | 'tel' | 'textarea' = 'text'
placeholder: string = ''
error: string = ''               // Сообщение об ошибке
required: boolean = false
value: string = ''
disabled: boolean = false
autocomplete: string | undefined
id: string | undefined           // Опциональный явный ID (по умолчанию: field-{name})
```

#### Особенности:

- **Детерминированная генерация ID** на основе `name` (без SSR mismatch)
- Возможность явно указать `id` prop для кастомного ID
- Связь label с input через `for`/`id`
- Валидация с отображением ошибок
- ARIA атрибуты для accessibility (`aria-invalid`, `aria-describedby`)
- Красная обводка при наличии ошибки
- Поддержка textarea
- Event forwarding через `$$restProps`

#### Примеры использования:

```svelte
<script>
	import { FormField } from '$lib/components/ui';

	let email = '';
	let emailError = '';

	function validateEmail() {
		if (!email.includes('@')) {
			emailError = 'Неверный формат email';
		} else {
			emailError = '';
		}
	}
</script>

<!-- Текстовое поле -->
<FormField
	label="Имя"
	name="firstName"
	type="text"
	placeholder="Введите ваше имя"
	bind:value={firstName}
/>

<!-- С валидацией -->
<FormField
	label="Email"
	name="email"
	type="email"
	placeholder="example@mail.com"
	required
	error={emailError}
	bind:value={email}
	on:blur={validateEmail}
/>

<!-- Пароль -->
<FormField
	label="Пароль"
	name="password"
	type="password"
	placeholder="Минимум 8 символов"
	required
	autocomplete="current-password"
	bind:value={password}
/>

<!-- Дата -->
<FormField label="Дата рождения" name="birthDate" type="date" required bind:value={birthDate} />

<!-- Телефон -->
<FormField
	label="Телефон"
	name="phone"
	type="tel"
	placeholder="+49 123 456789"
	bind:value={phone}
/>

<!-- Textarea -->
<FormField
	label="Описание"
	name="description"
	type="textarea"
	placeholder="Расскажите о себе..."
	bind:value={description}
/>

<!-- Отключенное поле -->
<FormField
	label="Email (верифицирован)"
	name="verifiedEmail"
	type="email"
	value={user.email}
	disabled
/>
```

---

### 3. Modal - Модальное окно

**Расположение:** `src/lib/components/ui/Modal.svelte`

#### Props:

```typescript
isOpen: boolean = false
onClose: () => void              // Обязательно
title: string                    // Обязательно
```

#### Особенности:

- **Backdrop** с blur эффектом
- Закрытие по **ESC** клавише
- Закрытие по клику **вне модала**
- **Focus trap** - Tab/Shift+Tab остаются внутри модала
- Блокировка скролла `body` при открытии
- Восстановление фокуса после закрытия
- Плавная анимация fade-in/scale
- **SSR-safe** - проверка `browser` перед DOM операциями
- **Локализованные ARIA labels** через i18n (`ui.modal.closeAriaLabel`)

#### Примеры использования:

```svelte
<script>
	import { Modal, Button } from '$lib/components/ui';

	let isOpen = false;

	function openModal() {
		isOpen = true;
	}

	function closeModal() {
		isOpen = false;
	}

	function handleConfirm() {
		// Выполнить действие
		closeModal();
	}
</script>

<Button on:click={openModal}>Открыть модал</Button>

<Modal {isOpen} onClose={closeModal} title="Подтверждение действия">
	<div class="space-y-4">
		<p>Вы уверены, что хотите выполнить это действие?</p>

		<div class="flex gap-4 justify-end">
			<Button type="secondary" on:click={closeModal}>Отмена</Button>
			<Button type="primary" on:click={handleConfirm}>Подтвердить</Button>
		</div>
	</div>
</Modal>
```

#### Accessibility:

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` для заголовка
- Focus trap для клавиатурной навигации
- Сохранение и восстановление фокуса

---

### 4. Toast - Уведомление

**Расположение:** `src/lib/components/ui/Toast.svelte`

#### Props:

```typescript
message: string                  // Обязательно
type: 'success' | 'error' | 'info' = 'info'
duration: number = 3000          // Миллисекунды (0 = без автозакрытия)
onClose: (() => void) | undefined
```

#### Особенности:

- Автоматическое закрытие через `duration` мс
- Анимация **slide-in** при появлении
- Прогресс-бар закрытия
- Позиция: **top-center** на mobile, **top-right** на desktop
- Иконки для каждого типа уведомления
- Ручное закрытие по кнопке X
- **Правильная ARIA семантика** в зависимости от типа:
  - `error` → `role="alert"` + `aria-live="assertive"` (критичное)
  - `success`/`info` → `role="status"` + `aria-live="polite"` (информационное)
- **Локализованные ARIA labels** через i18n (`ui.toast.closeAriaLabel`)

#### Примеры использования:

```svelte
<script>
	import { Toast } from '$lib/components/ui';

	let showToast = false;
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';

	function showNotification(message: string, type: 'success' | 'error' | 'info') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	async function saveData() {
		try {
			await api.save();
			showNotification('Данные успешно сохранены!', 'success');
		} catch (error) {
			showNotification('Ошибка при сохранении данных', 'error');
		}
	}
</script>

<!-- Toast рендерится условно -->
{#if showToast}
	<Toast
		message={toastMessage}
		type={toastType}
		duration={3000}
		onClose={() => (showToast = false)}
	/>
{/if}

<!-- Или прямое использование -->
<Toast message="Добро пожаловать!" type="success" duration={5000} />

<Toast message="Произошла ошибка" type="error" duration={0} onClose={handleClose} />
```

#### Управление через store (опционально):

```typescript
// src/lib/stores/toast.ts
import { writable } from 'svelte/store';

type ToastData = {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
	duration?: number;
};

export const toasts = writable<ToastData[]>([]);

export function showToast(message: string, type: 'success' | 'error' | 'info', duration = 3000) {
	const id = Math.random().toString(36).substr(2, 9);
	toasts.update((t) => [...t, { id, message, type, duration }]);

	if (duration > 0) {
		setTimeout(() => {
			toasts.update((t) => t.filter((toast) => toast.id !== id));
		}, duration);
	}
}
```

---

## 🎨 Дизайн-система

### Цвета:

```javascript
primary: blue-600 (#2563eb)
secondary: gray-200
danger: red-600
success: green-500
error: red-500
info: blue-500
```

### Spacing (отступы):

```javascript
4px, 8px, 16px, 24px, 32px
```

### Тени:

```javascript
shadow - md; // Для карточек
shadow - lg; // Для модалов
shadow - xl; // Для dropdown
```

### Скругления:

```javascript
rounded - lg; // 8px - стандарт для большинства элементов
rounded - full; // Для круглых элементов
```

### Transitions:

```javascript
duration - 200; // Быстрые (кнопки, hover)
duration - 300; // Средние (модалы, toast)
```

---

## 📱 Мобильная адаптация

### Брейкпоинты Tailwind:

```javascript
sm: 640px   // Планшет портрет
md: 768px   // Планшет ландшафт
lg: 1024px  // Desktop
xl: 1280px  // Wide desktop
```

### Правила:

1. **Минимальная высота кнопок: 44px** (Apple HIG рекомендация)
2. **Минимальный размер текста: 16px** (избежание авто-зума на iOS)
3. **Стэк вертикально на mobile**: flex-col → flex-row на md+
4. **Увеличенные touch targets**: padding минимум 12px
5. **Адаптивные модалы**: full-width на mobile, max-w-lg на desktop

### Примеры адаптивности:

```svelte
<!-- Кнопки в ряд на desktop, стэк на mobile -->
<div class="flex flex-col sm:flex-row gap-4">
	<Button>Кнопка 1</Button>
	<Button>Кнопка 2</Button>
</div>

<!-- Адаптивный padding -->
<div class="p-4 sm:p-6 md:p-8">
	<!-- Контент -->
</div>

<!-- Адаптивный текст -->
<h1 class="text-2xl sm:text-3xl md:text-4xl">Заголовок</h1>
```

---

## ♿ Accessibility (Доступность)

### Реализованные фичи:

1. **ARIA labels** для screen readers
2. **Focus management** (видимые focus rings)
3. **Keyboard navigation** (Tab, Shift+Tab, ESC)
4. **Focus trap** в модалах
5. **aria-invalid** для полей с ошибками
6. **aria-describedby** для связи ошибок с полями
7. **role="alert"** для toast уведомлений
8. **Сохранение/восстановление фокуса** при закрытии модалов

### Тестирование:

- ✅ Навигация только с клавиатуры
- ✅ Screen reader (NVDA/JAWS)
- ✅ Контрастность цветов (WCAG AA)
- ✅ Focus indicators видны

---

## 🧪 Демо и тестирование

### Демо страница:

```
http://localhost:5173/demo-ui
```

Файл: `src/routes/demo-ui/+page.svelte`

Содержит примеры использования всех компонентов с различными состояниями и конфигурациями.

---

## 📦 Импорт компонентов

```typescript
// Индивидуальный импорт
import Button from '$lib/components/ui/Button.svelte';
import FormField from '$lib/components/ui/FormField.svelte';

// Или через индексный файл
import { Button, FormField, Modal, Toast } from '$lib/components/ui';
```

---

## 🔄 Changelog

### v1.0.0 (2025-10-29)

- ✅ Создан компонент **Button** с поддержкой loading, размеров и типов
- ✅ Создан компонент **FormField** с валидацией и accessibility
- ✅ Создан компонент **Modal** с focus trap и backdrop
- ✅ Создан компонент **Toast** с автозакрытием и анимацией
- ✅ Добавлена демо страница `/demo-ui`
- ✅ Полная мобильная адаптация всех компонентов
- ✅ ARIA атрибуты и keyboard navigation

---

## 📚 Связанные документы

- [Tailwind Config](../../../tailwind.config.js)
- [Type System](../../development/TYPE_SYSTEM.md)
- [i18n Setup](../i18n/SETUP.md)
