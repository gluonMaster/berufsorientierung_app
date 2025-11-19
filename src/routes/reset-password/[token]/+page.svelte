<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button, FormField } from '$lib/components/ui';
	import Turnstile from '$lib/components/security/Turnstile.svelte';
	import { _ } from 'svelte-i18n';

	// Данные из server load функции
	let {
		data,
	}: { data: { csrfToken?: string; turnstileSiteKey?: string; invalidToken: boolean } } =
		$props();

	// Состояние формы
	let formData = $state({
		new_password: '',
		new_password_confirm: '',
	});

	// Состояние валидации и UI
	let errors = $state<Record<string, string>>({});
	let isSubmitting = $state(false);
	let successMessage = $state('');
	let errorMessage = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	/**
	 * Валидация пароля на клиенте
	 * Проверяет длину и наличие букв и цифр
	 */
	function validatePassword() {
		if (!formData.new_password.trim()) {
			errors.new_password = $_('validation.passwordRequired', {
				default: 'Пароль обязателен',
			});
			return false;
		}

		if (formData.new_password.length < 8) {
			errors.new_password = $_('validation.passwordMinLength', {
				default: 'Пароль должен содержать минимум 8 символов',
			});
			return false;
		}

		// Проверка на наличие букв и цифр
		const hasLetters = /[a-zA-Z]/.test(formData.new_password);
		const hasNumbers = /\d/.test(formData.new_password);

		if (!hasLetters || !hasNumbers) {
			errors.new_password = $_('validation.passwordComplexity', {
				default: 'Пароль должен содержать буквы и цифры',
			});
			return false;
		}

		delete errors.new_password;
		errors = errors;
		return true;
	}

	/**
	 * Валидация подтверждения пароля
	 */
	function validatePasswordConfirm() {
		if (!formData.new_password_confirm.trim()) {
			errors.new_password_confirm = $_('validation.passwordConfirmRequired', {
				default: 'Подтверждение пароля обязательно',
			});
			return false;
		}

		if (formData.new_password !== formData.new_password_confirm) {
			errors.new_password_confirm = $_('validation.passwordMismatch', {
				default: 'Пароли не совпадают',
			});
			return false;
		}

		delete errors.new_password_confirm;
		errors = errors;
		return true;
	}

	/**
	 * Обработка потери фокуса для полей
	 */
	function handleBlur(field: 'new_password' | 'new_password_confirm') {
		if (field === 'new_password' && formData.new_password.trim()) {
			validatePassword();
		} else if (field === 'new_password_confirm' && formData.new_password_confirm.trim()) {
			validatePasswordConfirm();
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
			const isPasswordValid = validatePassword();
			const isConfirmValid = validatePasswordConfirm();

			if (!isPasswordValid || !isConfirmValid) {
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

			// Получаем токен из URL
			const token = $page.params.token;

			// Отправляем запрос на сервер
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(data.csrfToken && { 'X-CSRF-Token': data.csrfToken }),
				},
				body: JSON.stringify({
					token,
					new_password: formData.new_password,
					new_password_confirm: formData.new_password_confirm,
					csrfToken: data.csrfToken,
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
							if (typeof err.message === 'string') {
								errors[err.field] = $_(err.message, { default: err.message });
							} else {
								errors[err.field] = err.message.de || err.message.en || err.message;
							}
						}
					});
					errors = errors;
				} else if (result.error) {
					errorMessage = result.error;
				} else {
					errorMessage = $_('auth.resetPasswordError', {
						default: 'Произошла ошибка. Попробуйте позже.',
					});
				}
				return;
			}

			// Успешная смена пароля
			successMessage = $_('auth.resetPasswordSuccess', {
				default:
					'Пароль успешно изменён! Сейчас вы будете перенаправлены на страницу входа.',
			});

			// Перенаправление на страницу входа через 3 секунды
			setTimeout(() => {
				goto('/login');
			}, 3000);
		} catch (err: any) {
			console.error('Reset password error:', err);
			errorMessage = $_('auth.resetPasswordError', {
				default: 'Произошла ошибка. Попробуйте позже.',
			});
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{$_('auth.resetPasswordTitle', { default: 'Сброс пароля' })} | Berufsorientierung</title>
	<meta
		name="description"
		content={$_('auth.resetPasswordTitle', { default: 'Сброс пароля' }) +
			' - Berufsorientierung'}
	/>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full">
		<!-- Заголовок -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">
				{$_('auth.resetPasswordTitle', { default: 'Сброс пароля' })}
			</h1>
			<p class="text-gray-600">
				{$_('auth.resetPasswordSubtitle', {
					default: 'Введите новый пароль для вашего аккаунта',
				})}
			</p>
		</div>

		<!-- Контент -->
		<div class="bg-white rounded-lg shadow-md p-8">
			{#if data.invalidToken}
				<!-- Токен невалиден или просрочен -->
				<div class="text-center">
					<div
						class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"
					>
						<svg
							class="h-6 w-6 text-red-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">
						{$_('auth.resetPasswordInvalidToken', {
							default: 'Ссылка недействительна или устарела',
						})}
					</h2>
					<p class="text-gray-600 mb-6">
						{$_('auth.resetPasswordInvalidTokenDescription', {
							default:
								'Срок действия ссылки истёк или она уже была использована. Запросите новую ссылку для сброса пароля.',
						})}
					</p>
					<div class="space-y-3">
						<Button
							type="button"
							variant="primary"
							on:click={() => goto('/forgot-password')}
							class="w-full"
						>
							{$_('auth.requestNewLink', { default: 'Запросить новую ссылку' })}
						</Button>
						<Button
							type="button"
							variant="secondary"
							on:click={() => goto('/login')}
							class="w-full"
						>
							{$_('auth.backToLogin', { default: 'Вернуться к входу' })}
						</Button>
					</div>
				</div>
			{:else if successMessage}
				<!-- Успешная смена пароля -->
				<div class="text-center">
					<div
						class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4"
					>
						<svg
							class="h-6 w-6 text-green-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">
						{$_('auth.resetPasswordSuccessTitle', { default: 'Пароль изменён!' })}
					</h2>
					<p class="text-gray-600 mb-6">{successMessage}</p>
					<Button
						type="button"
						variant="primary"
						on:click={() => goto('/login')}
						class="w-full"
					>
						{$_('auth.goToLogin', { default: 'Перейти к входу' })}
					</Button>
				</div>
			{:else}
				<!-- Форма смены пароля -->
				<form onsubmit={handleSubmit} novalidate>
					<!-- CSRF токен -->
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

					<!-- Поле нового пароля -->
					<div class="mb-6">
						<div class="relative">
							<FormField
								label={$_('auth.newPassword', { default: 'Новый пароль' })}
								type={showPassword ? 'text' : 'password'}
								name="new_password"
								bind:value={formData.new_password}
								error={errors.new_password}
								required
								autocomplete="new-password"
								on:blur={() => handleBlur('new_password')}
								placeholder={$_('auth.newPasswordPlaceholder', {
									default: 'Минимум 8 символов',
								})}
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute right-3 top-9 text-gray-500 hover:text-gray-700 focus:outline-none"
								aria-label={showPassword
									? $_('auth.hidePassword', { default: 'Скрыть пароль' })
									: $_('auth.showPassword', { default: 'Показать пароль' })}
							>
								{#if showPassword}
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
										/>
									</svg>
								{:else}
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								{/if}
							</button>
						</div>
						<p class="mt-1 text-sm text-gray-500">
							{$_('validation.passwordRequirements', {
								default: 'Минимум 8 символов, должен содержать буквы и цифры',
							})}
						</p>
					</div>

					<!-- Поле подтверждения пароля -->
					<div class="mb-6">
						<div class="relative">
							<FormField
								label={$_('auth.confirmNewPassword', {
									default: 'Подтвердите пароль',
								})}
								type={showConfirmPassword ? 'text' : 'password'}
								name="new_password_confirm"
								bind:value={formData.new_password_confirm}
								error={errors.new_password_confirm}
								required
								autocomplete="new-password"
								on:blur={() => handleBlur('new_password_confirm')}
								placeholder={$_('auth.confirmPasswordPlaceholder', {
									default: 'Повторите пароль',
								})}
							/>
							<button
								type="button"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								class="absolute right-3 top-9 text-gray-500 hover:text-gray-700 focus:outline-none"
								aria-label={showConfirmPassword
									? $_('auth.hidePassword', { default: 'Скрыть пароль' })
									: $_('auth.showPassword', { default: 'Показать пароль' })}
							>
								{#if showConfirmPassword}
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
										/>
									</svg>
								{:else}
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>

					<!-- Cloudflare Turnstile -->
					{#if data.turnstileSiteKey}
						<div class="mb-6">
							<Turnstile siteKey={data.turnstileSiteKey} action="reset-password" />
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
							? $_('auth.resettingPassword', { default: 'Изменение...' })
							: $_('auth.resetPasswordSubmit', { default: 'Изменить пароль' })}
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
