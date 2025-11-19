<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, FormField } from '$lib/components/ui';
	import Turnstile from '$lib/components/security/Turnstile.svelte';
	import { _ } from 'svelte-i18n';

	// Данные из server load функции (включая CSRF токен и Turnstile site key)
	let { data }: { data: { csrfToken?: string; turnstileSiteKey?: string } } = $props();

	// Состояние формы
	let formData = $state({
		email: '',
	});

	// Состояние валидации и UI
	let errors = $state<Record<string, string>>({});
	let isSubmitting = $state(false);
	let successMessage = $state('');
	let errorMessage = $state('');

	/**
	 * Простая валидация email на клиенте
	 */
	function validateEmail() {
		if (!formData.email.trim()) {
			errors.email = $_('validation.email_required', { default: 'Email обязателен' });
			return false;
		}

		// Базовая проверка формата email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(formData.email)) {
			errors.email = $_('validation.email_invalid', { default: 'Некорректный email адрес' });
			return false;
		}

		delete errors.email;
		errors = errors;
		return true;
	}

	/**
	 * Валидация поля при потере фокуса
	 */
	function handleBlur() {
		if (formData.email.trim()) {
			validateEmail();
		}
	}

	/**
	 * Обработка отправки формы
	 */
	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Сбрасываем предыдущие сообщения
		errors = {};
		errorMessage = '';
		successMessage = '';
		isSubmitting = true;

		try {
			// Валидация на клиенте
			if (!validateEmail()) {
				isSubmitting = false;
				return;
			}

			// Извлекаем Turnstile токен из формы
			const form = event.target as HTMLFormElement;
			const turnstileToken =
				form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
					?.value || '';

			// Проверяем наличие Turnstile токена
			if (!turnstileToken) {
				errorMessage = $_('validation.turnstile_required', {
					default: 'Подтвердите, что вы не робот',
				});
				isSubmitting = false;
				return;
			}

			// Отправляем запрос на сервер
			const response = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Добавляем CSRF токен в заголовок для защиты от атак
					...(data.csrfToken && { 'X-CSRF-Token': data.csrfToken }),
				},
				body: JSON.stringify({
					email: formData.email.trim(),
					// Добавляем CSRF токен в тело запроса как fallback
					csrfToken: data.csrfToken,
					// Добавляем Turnstile токен для верификации на сервере
					turnstileToken,
				}),
			});

			const result = await response.json();

			if (!response.ok) {
				// Обработка ошибок с сервера
				if (result.errors && Array.isArray(result.errors)) {
					// Ошибки валидации
					result.errors.forEach((err: any) => {
						if (err.field && err.message) {
							// Если сообщение - строка (i18n ключ), переводим его
							if (typeof err.message === 'string') {
								errors[err.field] = $_(err.message, { default: err.message });
							} else {
								// Используем сообщение на текущем языке (старый формат)
								errors[err.field] = err.message.de || err.message.en || err.message;
							}
						}
					});
					errors = errors;
				} else if (result.error) {
					errorMessage = result.error;
				} else {
					errorMessage = $_('auth.forgotPasswordError', {
						default: 'Произошла ошибка. Попробуйте позже.',
					});
				}
				return;
			}

			// Успешная отправка
			// Показываем общее сообщение (из соображений безопасности не раскрываем, существует ли email)
			successMessage = $_('auth.forgotPasswordSuccess', {
				default:
					'Если такой email зарегистрирован, мы отправили инструкцию по восстановлению пароля.',
			});

			// Очищаем форму
			formData.email = '';
		} catch (err: any) {
			console.error('Forgot password error:', err);
			errorMessage = $_('auth.forgotPasswordError', {
				default: 'Произошла ошибка. Попробуйте позже.',
			});
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title
		>{$_('auth.forgotPasswordTitle', { default: 'Восстановление пароля' })} | Berufsorientierung</title
	>
	<meta
		name="description"
		content={$_('auth.forgotPasswordTitle', { default: 'Восстановление пароля' }) +
			' - Berufsorientierung'}
	/>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full">
		<!-- Заголовок -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">
				{$_('auth.forgotPasswordTitle', { default: 'Восстановление пароля' })}
			</h1>
			<p class="text-gray-600">
				{$_('auth.forgotPasswordSubtitle', {
					default: 'Введите ваш email, и мы отправим инструкцию по восстановлению пароля',
				})}
			</p>
		</div>

		<!-- Форма восстановления пароля -->
		<div class="bg-white rounded-lg shadow-md p-8">
			{#if successMessage}
				<!-- Сообщение об успешной отправке -->
				<div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg" role="alert">
					<div class="flex">
						<div class="shrink-0">
							<svg
								class="h-5 w-5 text-green-400"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-green-800">{successMessage}</p>
						</div>
					</div>
				</div>

				<!-- Ссылки после успешной отправки -->
				<div class="space-y-3">
					<Button
						type="button"
						variant="primary"
						on:click={() => goto('/login')}
						class="w-full"
					>
						{$_('auth.backToLogin', { default: 'Вернуться к входу' })}
					</Button>
					<Button
						type="button"
						variant="secondary"
						on:click={() => {
							successMessage = '';
						}}
						class="w-full"
					>
						{$_('auth.tryAnotherEmail', { default: 'Попробовать другой email' })}
					</Button>
				</div>
			{:else}
				<form onsubmit={handleSubmit} novalidate>
					<!-- CSRF токен для защиты от атак -->
					{#if data.csrfToken}
						<input type="hidden" name="_csrf" value={data.csrfToken} />
					{/if}

					<!-- Общее сообщение об ошибке -->
					{#if errorMessage}
						<div
							class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
							role="alert"
						>
							<div class="flex">
								<div class="shrink-0">
									<svg
										class="h-5 w-5 text-red-400"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<div class="ml-3">
									<p class="text-sm text-red-800">{errorMessage}</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- Поле email -->
					<div class="mb-6">
						<FormField
							label={$_('form.email', { default: 'Email' })}
							type="email"
							name="email"
							bind:value={formData.email}
							error={errors.email}
							required
							autocomplete="email"
							on:blur={handleBlur}
							placeholder={$_('form.emailPlaceholder', {
								default: 'beispiel@email.de',
							})}
						/>
					</div>

					<!-- Cloudflare Turnstile (защита от ботов) -->
					{#if data.turnstileSiteKey}
						<div class="mb-6">
							<Turnstile siteKey={data.turnstileSiteKey} action="forgot-password" />
						</div>
					{/if}

					<!-- Кнопка отправки -->
					<Button
						type="submit"
						variant="primary"
						loading={isSubmitting}
						disabled={isSubmitting}
						class="w-full"
					>
						{isSubmitting
							? $_('auth.forgotPasswordSubmitting', { default: 'Отправка...' })
							: $_('auth.forgotPasswordSubmit', {
									default: 'Отправить инструкцию',
								})}
					</Button>
				</form>

				<!-- Разделитель -->
				<div class="mt-6">
					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-gray-300"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="px-2 bg-white text-gray-500">
								{$_('auth.or', { default: 'или' })}
							</span>
						</div>
					</div>
				</div>

				<!-- Ссылка на вход -->
				<div class="mt-6">
					<Button
						type="button"
						variant="secondary"
						on:click={() => goto('/login')}
						disabled={isSubmitting}
						class="w-full"
					>
						{$_('auth.backToLogin', { default: 'Вернуться к входу' })}
					</Button>
				</div>
			{/if}
		</div>

		<!-- Дополнительная информация -->
		<div class="mt-8 text-center">
			<p class="text-sm text-gray-600">
				{$_('auth.needHelp', { default: 'Нужна помощь?' })}
				<a
					href="/support"
					class="font-medium text-blue-600 hover:text-blue-500 hover:underline"
				>
					{$_('auth.contactUs', { default: 'Свяжитесь с нами' })}
				</a>
			</p>
		</div>
	</div>
</div>

<style>
	/* Анимация появления */
	form {
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
