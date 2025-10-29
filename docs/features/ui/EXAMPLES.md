# UI Components - Примеры использования

Быстрые примеры использования UI компонентов в реальных сценариях.

---

## 🔐 Форма регистрации

```svelte
<script lang="ts">
	import { Button, FormField } from '$lib/components/ui';

	let formData = {
		firstName: '',
		lastName: '',
		email: '',
		password: '',
		birthDate: '',
	};

	let errors = {
		email: '',
		password: '',
	};

	let loading = false;

	async function handleSubmit() {
		// Сброс ошибок
		errors = { email: '', password: '' };

		// Валидация
		if (!formData.email.includes('@')) {
			errors.email = 'Неверный формат email';
			return;
		}

		if (formData.password.length < 8) {
			errors.password = 'Пароль должен содержать минимум 8 символов';
			return;
		}

		// Отправка данных
		loading = true;
		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				// Успешная регистрация
				window.location.href = '/profile';
			} else {
				const data = await response.json();
				errors.email = data.message || 'Ошибка регистрации';
			}
		} catch (error) {
			errors.email = 'Ошибка соединения с сервером';
		} finally {
			loading = false;
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4 max-w-md mx-auto">
	<h1 class="text-2xl font-bold mb-6">Регистрация</h1>

	<FormField
		label="Имя"
		name="firstName"
		type="text"
		placeholder="Введите ваше имя"
		required
		bind:value={formData.firstName}
	/>

	<FormField
		label="Фамилия"
		name="lastName"
		type="text"
		placeholder="Введите вашу фамилию"
		required
		bind:value={formData.lastName}
	/>

	<FormField
		label="Email"
		name="email"
		type="email"
		placeholder="example@mail.com"
		required
		error={errors.email}
		bind:value={formData.email}
		autocomplete="email"
	/>

	<FormField
		label="Пароль"
		name="password"
		type="password"
		placeholder="Минимум 8 символов"
		required
		error={errors.password}
		bind:value={formData.password}
		autocomplete="new-password"
	/>

	<FormField
		label="Дата рождения"
		name="birthDate"
		type="date"
		required
		bind:value={formData.birthDate}
	/>

	<Button type="primary" fullWidth {loading}>
		{loading ? 'Регистрация...' : 'Зарегистрироваться'}
	</Button>
</form>
```

---

## ✅ Модал подтверждения действия

```svelte
<script lang="ts">
	import { Modal, Button } from '$lib/components/ui';

	let isDeleteModalOpen = false;
	let isDeleting = false;

	async function handleDelete() {
		isDeleting = true;

		try {
			const response = await fetch('/api/profile/delete', {
				method: 'POST',
			});

			if (response.ok) {
				window.location.href = '/';
			}
		} catch (error) {
			alert('Ошибка при удалении профиля');
		} finally {
			isDeleting = false;
			isDeleteModalOpen = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto p-6">
	<h1 class="text-2xl font-bold mb-4">Настройки профиля</h1>

	<div class="bg-red-50 border border-red-200 rounded-lg p-4">
		<h2 class="text-lg font-semibold text-red-900 mb-2">Опасная зона</h2>
		<p class="text-red-700 mb-4">Удаление профиля необратимо. Все ваши данные будут удалены.</p>
		<Button type="danger" on:click={() => (isDeleteModalOpen = true)}>Удалить профиль</Button>
	</div>
</div>

<!-- Модал подтверждения -->
<Modal
	isOpen={isDeleteModalOpen}
	onClose={() => (isDeleteModalOpen = false)}
	title="Подтверждение удаления"
>
	<div class="space-y-4">
		<p class="text-gray-700">
			Вы уверены, что хотите удалить свой профиль? Это действие <strong>нельзя отменить</strong>.
		</p>

		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
			<p class="text-sm text-yellow-800">
				⚠️ Все ваши данные и регистрации на мероприятия будут удалены.
			</p>
		</div>

		<div class="flex gap-4 pt-4">
			<Button type="secondary" fullWidth on:click={() => (isDeleteModalOpen = false)}>
				Отмена
			</Button>
			<Button type="danger" fullWidth loading={isDeleting} on:click={handleDelete}>
				{isDeleting ? 'Удаление...' : 'Удалить навсегда'}
			</Button>
		</div>
	</div>
</Modal>
```

---

## 📢 Toast система уведомлений

### Вариант 1: Простое использование

```svelte
<script lang="ts">
	import { Toast } from '$lib/components/ui';

	let showToast = false;
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';

	async function saveSettings() {
		try {
			const response = await fetch('/api/settings', {
				method: 'PUT',
				body: JSON.stringify(settings),
			});

			if (response.ok) {
				showToast = true;
				toastMessage = 'Настройки сохранены!';
				toastType = 'success';
			} else {
				showToast = true;
				toastMessage = 'Ошибка при сохранении';
				toastType = 'error';
			}
		} catch (error) {
			showToast = true;
			toastMessage = 'Ошибка соединения';
			toastType = 'error';
		}
	}
</script>

{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={() => (showToast = false)} />
{/if}
```

### Вариант 2: Store-based (рекомендуется)

**1. Создать store:**

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

export function showToast(
	message: string,
	type: 'success' | 'error' | 'info' = 'info',
	duration = 3000
) {
	const id = Math.random().toString(36).substr(2, 9);
	toasts.update((t) => [...t, { id, message, type, duration }]);
}

export function dismissToast(id: string) {
	toasts.update((t) => t.filter((toast) => toast.id !== id));
}
```

**2. Добавить в layout:**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/toast';
	import { Toast } from '$lib/components/ui';
</script>

<slot />

<!-- Рендерим все активные toast'ы -->
<div class="fixed top-4 right-4 z-50 space-y-4">
	{#each $toasts as toast (toast.id)}
		<Toast
			message={toast.message}
			type={toast.type}
			duration={toast.duration}
			onClose={() => dismissToast(toast.id)}
		/>
	{/each}
</div>
```

**3. Использовать в любом компоненте:**

```svelte
<script lang="ts">
	import { showToast } from '$lib/stores/toast';
	import { Button } from '$lib/components/ui';

	async function handleAction() {
		try {
			await someApiCall();
			showToast('Действие выполнено успешно!', 'success');
		} catch (error) {
			showToast('Произошла ошибка', 'error');
		}
	}
</script>

<Button on:click={handleAction}>Выполнить действие</Button>
```

---

## 📋 Форма с динамическими полями

```svelte
<script lang="ts">
	import { Button, FormField } from '$lib/components/ui';

	let eventData = {
		title: '',
		date: '',
		maxParticipants: '',
		requirements: '',
	};

	let additionalFields = [{ id: 1, label: '', type: 'text', required: false }];

	function addField() {
		const newId = Math.max(...additionalFields.map((f) => f.id), 0) + 1;
		additionalFields = [
			...additionalFields,
			{ id: newId, label: '', type: 'text', required: false },
		];
	}

	function removeField(id: number) {
		additionalFields = additionalFields.filter((f) => f.id !== id);
	}

	async function handleSubmit() {
		// Отправка данных
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6 max-w-2xl mx-auto">
	<h1 class="text-2xl font-bold">Создание мероприятия</h1>

	<!-- Основные поля -->
	<FormField
		label="Название мероприятия"
		name="title"
		type="text"
		placeholder="Введите название"
		required
		bind:value={eventData.title}
	/>

	<FormField label="Дата проведения" name="date" type="date" required bind:value={eventData.date} />

	<FormField
		label="Максимум участников"
		name="maxParticipants"
		type="text"
		placeholder="50"
		bind:value={eventData.maxParticipants}
	/>

	<FormField
		label="Требования"
		name="requirements"
		type="textarea"
		placeholder="Опишите требования к участникам..."
		bind:value={eventData.requirements}
	/>

	<!-- Динамические дополнительные поля -->
	<div class="border-t pt-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold">Дополнительные поля</h2>
			<Button size="sm" on:click={addField}>+ Добавить поле</Button>
		</div>

		<div class="space-y-4">
			{#each additionalFields as field (field.id)}
				<div class="flex gap-4 items-start">
					<div class="flex-1">
						<FormField
							label="Название поля"
							name="field-{field.id}"
							type="text"
							placeholder="Например: Размер футболки"
							bind:value={field.label}
						/>
					</div>

					<div class="flex-1">
						<label class="block text-sm font-medium text-gray-700 mb-2"> Тип поля </label>
						<select
							bind:value={field.type}
							class="w-full px-4 py-3 border border-gray-300 rounded-lg"
						>
							<option value="text">Текст</option>
							<option value="textarea">Текстовая область</option>
							<option value="date">Дата</option>
						</select>
					</div>

					<Button type="danger" size="sm" on:click={() => removeField(field.id)}>Удалить</Button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Кнопки действий -->
	<div class="flex gap-4 pt-6">
		<Button type="secondary" fullWidth>Сохранить как черновик</Button>
		<Button type="primary" fullWidth>Опубликовать</Button>
	</div>
</form>
```

---

## 🎨 Responsive grid с карточками

```svelte
<script lang="ts">
	import { Button, Modal } from '$lib/components/ui';

	let events = [
		{ id: 1, title: 'Мероприятие 1', date: '2025-11-15', participants: 23 },
		{ id: 2, title: 'Мероприятие 2', date: '2025-11-20', participants: 45 },
		// ... больше мероприятий
	];

	let selectedEvent = null;
	let isModalOpen = false;

	function viewEvent(event) {
		selectedEvent = event;
		isModalOpen = true;
	}
</script>

<!-- Grid с адаптивными колонками -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
	{#each events as event (event.id)}
		<div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
			<h3 class="text-lg font-semibold mb-2">{event.title}</h3>
			<p class="text-gray-600 text-sm mb-4">{event.date}</p>

			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-500">
					{event.participants} участников
				</span>
				<Button size="sm" on:click={() => viewEvent(event)}>Подробнее</Button>
			</div>
		</div>
	{/each}
</div>

<!-- Модал с деталями -->
{#if selectedEvent}
	<Modal {isModalOpen} onClose={() => (isModalOpen = false)} title={selectedEvent.title}>
		<div class="space-y-4">
			<p><strong>Дата:</strong> {selectedEvent.date}</p>
			<p><strong>Участников:</strong> {selectedEvent.participants}</p>

			<div class="flex gap-4 pt-4">
				<Button type="primary" fullWidth>Записаться</Button>
				<Button type="secondary" fullWidth on:click={() => (isModalOpen = false)}>Закрыть</Button>
			</div>
		</div>
	</Modal>
{/if}
```

---

## 📚 Связанные документы

- [UI Components README](./README.md) - Полная документация
- [Tailwind Config](../../../tailwind.config.js)
- [i18n Setup](../i18n/SETUP.md)
