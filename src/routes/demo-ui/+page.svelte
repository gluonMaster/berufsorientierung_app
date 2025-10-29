<script lang="ts">
	// Демонстрационная страница для тестирования UI компонентов
	import { Button, FormField, Modal, Toast } from '$lib/components/ui';

	// Состояния для демонстрации
	let buttonLoading = false;
	let formValues = {
		text: '',
		email: '',
		password: '',
		date: '',
		tel: '',
		textarea: '',
	};
	let formErrors = {
		email: '',
		password: '',
	};

	// Модал
	let isModalOpen = false;

	// Toast
	let showToast = false;
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';

	// Обработчики
	function handleButtonClick() {
		buttonLoading = true;
		setTimeout(() => {
			buttonLoading = false;
			showToastNotification('Действие выполнено успешно!', 'success');
		}, 2000);
	}

	function validateEmail() {
		if (formValues.email && !formValues.email.includes('@')) {
			formErrors.email = 'Неверный формат email';
		} else {
			formErrors.email = '';
		}
	}

	function validatePassword() {
		if (formValues.password && formValues.password.length < 8) {
			formErrors.password = 'Пароль должен содержать минимум 8 символов';
		} else {
			formErrors.password = '';
		}
	}

	function showToastNotification(message: string, type: 'success' | 'error' | 'info') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	function openModal() {
		isModalOpen = true;
	}

	function closeModal() {
		isModalOpen = false;
	}

	function handleModalAction() {
		showToastNotification('Действие в модале выполнено!', 'success');
		closeModal();
	}
</script>

<svelte:head>
	<title>UI Components Demo - Berufsorientierung</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">UI Components Demo</h1>

		<!-- Button Component -->
		<section class="bg-white rounded-lg shadow-md p-6 mb-8">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Button Component</h2>

			<div class="space-y-4">
				<!-- Типы кнопок -->
				<div>
					<h3 class="text-lg font-medium text-gray-700 mb-3">Типы:</h3>
					<div class="flex flex-wrap gap-4">
						<Button type="primary">Primary</Button>
						<Button type="secondary">Secondary</Button>
						<Button type="danger">Danger</Button>
					</div>
				</div>

				<!-- Размеры кнопок -->
				<div>
					<h3 class="text-lg font-medium text-gray-700 mb-3">Размеры:</h3>
					<div class="flex flex-wrap items-center gap-4">
						<Button size="sm">Small</Button>
						<Button size="md">Medium</Button>
						<Button size="lg">Large</Button>
					</div>
				</div>

				<!-- Состояния кнопок -->
				<div>
					<h3 class="text-lg font-medium text-gray-700 mb-3">Состояния:</h3>
					<div class="flex flex-wrap gap-4">
						<Button on:click={handleButtonClick} loading={buttonLoading}>
							{buttonLoading ? 'Загрузка...' : 'С загрузкой'}
						</Button>
						<Button disabled>Отключена</Button>
						<Button fullWidth>Полная ширина</Button>
					</div>
				</div>
			</div>
		</section>

		<!-- FormField Component -->
		<section class="bg-white rounded-lg shadow-md p-6 mb-8">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">FormField Component</h2>

			<div class="space-y-4">
				<FormField
					label="Текстовое поле"
					name="text"
					type="text"
					placeholder="Введите текст"
					bind:value={formValues.text}
				/>

				<FormField
					label="Email"
					name="email"
					type="email"
					placeholder="example@mail.com"
					required
					error={formErrors.email}
					bind:value={formValues.email}
					on:blur={validateEmail}
				/>

				<FormField
					label="Пароль"
					name="password"
					type="password"
					placeholder="Минимум 8 символов"
					required
					error={formErrors.password}
					bind:value={formValues.password}
					on:blur={validatePassword}
				/>

				<FormField label="Дата" name="date" type="date" bind:value={formValues.date} />

				<FormField
					label="Телефон"
					name="tel"
					type="tel"
					placeholder="+49 123 456789"
					bind:value={formValues.tel}
				/>

				<FormField
					label="Текстовая область"
					name="textarea"
					type="textarea"
					placeholder="Введите описание..."
					bind:value={formValues.textarea}
				/>

				<FormField
					label="Отключенное поле"
					name="disabled"
					type="text"
					value="Нельзя редактировать"
					disabled
				/>
			</div>
		</section>

		<!-- Modal Component -->
		<section class="bg-white rounded-lg shadow-md p-6 mb-8">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Modal Component</h2>

			<Button on:click={openModal}>Открыть модальное окно</Button>

			<Modal {isModalOpen} onClose={closeModal} title="Пример модального окна">
				<div class="space-y-4">
					<p class="text-gray-700">Это содержимое модального окна. Модал поддерживает:</p>
					<ul class="list-disc list-inside text-gray-700 space-y-2">
						<li>Закрытие по клавише ESC</li>
						<li>Закрытие по клику вне модала</li>
						<li>Focus trap (навигация Tab остается внутри)</li>
						<li>Блокировка скролла body</li>
						<li>Плавная анимация появления/исчезновения</li>
					</ul>

					<div class="flex gap-4 pt-4">
						<Button type="primary" on:click={handleModalAction}>Подтвердить</Button>
						<Button type="secondary" on:click={closeModal}>Отмена</Button>
					</div>
				</div>
			</Modal>
		</section>

		<!-- Toast Component -->
		<section class="bg-white rounded-lg shadow-md p-6 mb-8">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Toast Component</h2>

			<div class="flex flex-wrap gap-4">
				<Button on:click={() => showToastNotification('Успешно выполнено!', 'success')}>
					Success Toast
				</Button>
				<Button
					type="danger"
					on:click={() => showToastNotification('Произошла ошибка!', 'error')}
				>
					Error Toast
				</Button>
				<Button
					type="secondary"
					on:click={() => showToastNotification('Информационное сообщение', 'info')}
				>
					Info Toast
				</Button>
			</div>
		</section>
	</div>
</div>

<!-- Toast рендерится глобально -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={() => (showToast = false)} />
{/if}
