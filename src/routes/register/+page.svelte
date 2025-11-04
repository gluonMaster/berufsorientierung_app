<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, FormField } from '$lib/components/ui';
	import { userRegistrationSchema, calculateAge } from '$lib/validation/schemas';
	import type { UserRegistrationData } from '$lib/types/user';
	import { setUser } from '$lib/stores/user';
	import { locale, _ } from 'svelte-i18n';

	// Состояние формы
	let formData: UserRegistrationData = {
		email: '',
		password: '',
		password_confirm: '',
		first_name: '',
		last_name: '',
		birth_date: '',
		address_street: '',
		address_number: '',
		address_zip: '',
		address_city: '',
		phone: '',
		whatsapp: '',
		telegram: '',
		photo_video_consent: false,
		parental_consent: false,
		gdpr_consent: false,
		preferred_language: ($locale as 'de' | 'en' | 'ru' | 'uk') || 'de',
	};

	// Состояние валидации
	let errors: Record<string, string> = {};
	let isSubmitting = false;
	let errorMessage = '';
	let showPassword = false;
	let showPasswordConfirm = false;

	// Вычисляемое свойство: возраст пользователя
	let userAge = -1;
	$: {
		if (formData.birth_date) {
			userAge = calculateAge(formData.birth_date);
		} else {
			userAge = -1;
		}
	}

	// Вычисляемое свойство: нужно ли согласие родителей
	$: needsParentalConsent = userAge >= 0 && userAge < 18;

	/**
	 * Валидация поля на клиенте
	 */
	function validateField(fieldName: keyof UserRegistrationData) {
		try {
			// Валидируем всю форму, но показываем ошибку только для конкретного поля
			userRegistrationSchema.parse(formData);
			// Если валидация прошла, удаляем ошибку для этого поля
			delete errors[fieldName];
			errors = errors;
		} catch (err: any) {
			// Извлекаем ошибки для конкретного поля
			const fieldErrors = err.issues.filter((issue: any) => issue.path[0] === fieldName);
			if (fieldErrors.length > 0) {
				// Маппим i18n ключ через $_ с fallback на сам ключ
				const errorKey = fieldErrors[0].message;
				errors[fieldName] = $_(errorKey, { default: errorKey });
			} else {
				delete errors[fieldName];
			}
			errors = errors;
		}
	}

	/**
	 * Обработка отправки формы
	 */
	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Сбрасываем предыдущие ошибки
		errors = {};
		errorMessage = '';
		isSubmitting = true;

		try {
			// Валидация на клиенте
			const validatedData = userRegistrationSchema.parse(formData);

			// Отправляем запрос на сервер
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(validatedData),
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
								const currentLang = $locale as 'de' | 'en' | 'ru' | 'uk';
								errors[err.field] =
									err.message[currentLang] || err.message.de || err.message;
							}
						}
					});
					errors = errors;
				} else if (result.error) {
					errorMessage = result.error;
				} else {
					errorMessage = 'Регистрация не удалась. Попробуйте снова.';
				}
				return;
			}

			// Успешная регистрация
			if (result.user) {
				setUser(result.user);
			}

			// Редирект в профиль
			await goto('/profile');
		} catch (err: any) {
			if (err.errors) {
				// Ошибки валидации Zod
				err.errors.forEach((error: any) => {
					if (error.path && error.path.length > 0) {
						// Маппим i18n ключ через $_ с fallback на сам ключ
						const errorKey = error.message;
						errors[error.path[0]] = $_(errorKey, { default: errorKey });
					}
				});
				errors = errors;
			} else {
				errorMessage = err.message || 'Произошла ошибка при регистрации';
			}
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Переключение видимости пароля
	 */
	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function togglePasswordConfirmVisibility() {
		showPasswordConfirm = !showPasswordConfirm;
	}
</script>

<svelte:head>
	<title>{$_('auth.registerTitle')} | Berufsorientierung</title>
	<meta name="description" content={$_('auth.registerTitle') + ' - Berufsorientierung'} />
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-3xl mx-auto">
		<!-- Заголовок -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">{$_('auth.registerTitle')}</h1>
			<p class="text-gray-600">
				{$_('auth.registerSubtitle', {
					default: 'Создайте аккаунт для участия в мероприятиях Berufsorientierung',
				})}
			</p>
		</div>

		<!-- Форма регистрации -->
		<div class="bg-white rounded-lg shadow-md p-6 sm:p-8">
			<form on:submit={handleSubmit} novalidate>
				<!-- Общее сообщение об ошибке -->
				{#if errorMessage}
					<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
						<p class="text-sm text-red-800">{errorMessage}</p>
					</div>
				{/if}

				<!-- Секция: Аутентификация -->
				<fieldset class="mb-8">
					<legend class="text-lg font-semibold text-gray-900 mb-4">
						{$_('auth.loginCredentials', { default: 'Данные для входа' })}
					</legend>

					<div class="space-y-4">
						<FormField
							label={$_('form.email')}
							type="email"
							name="email"
							bind:value={formData.email}
							error={errors.email}
							required
							autocomplete="email"
							on:blur={() => validateField('email')}
							placeholder="beispiel@email.de"
						/>

						<div class="relative">
							<FormField
								label={$_('form.password')}
								type={showPassword ? 'text' : 'password'}
								name="password"
								bind:value={formData.password}
								error={errors.password}
								required
								autocomplete="new-password"
								on:blur={() => validateField('password')}
								placeholder={$_('validation.passwordTooShort')}
							/>
							<button
								type="button"
								class="absolute right-3 top-11 text-gray-500 hover:text-gray-700"
								on:click={togglePasswordVisibility}
								aria-label={showPassword
									? $_('auth.hidePassword', { default: 'Скрыть пароль' })
									: $_('auth.showPassword', { default: 'Показать пароль' })}
							>
								{#if showPassword}
									<svg
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
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
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
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

						<div class="relative">
							<FormField
								label={$_('form.passwordConfirm')}
								type={showPasswordConfirm ? 'text' : 'password'}
								name="password_confirm"
								bind:value={formData.password_confirm}
								error={errors.password_confirm}
								required
								autocomplete="new-password"
								on:blur={() => validateField('password_confirm')}
								placeholder={$_('auth.repeatPassword', {
									default: 'Повторите пароль',
								})}
							/>
							<button
								type="button"
								class="absolute right-3 top-11 text-gray-500 hover:text-gray-700"
								on:click={togglePasswordConfirmVisibility}
								aria-label={showPasswordConfirm
									? $_('auth.hidePassword', { default: 'Скрыть пароль' })
									: $_('auth.showPassword', { default: 'Показать пароль' })}
							>
								{#if showPasswordConfirm}
									<svg
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
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
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
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
				</fieldset>

				<!-- Секция: Личные данные -->
				<fieldset class="mb-8">
					<legend class="text-lg font-semibold text-gray-900 mb-4">
						{$_('profile.personalData')}
					</legend>

					<div class="space-y-4">
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<FormField
								label={$_('form.firstName')}
								type="text"
								name="first_name"
								bind:value={formData.first_name}
								error={errors.first_name}
								required
								autocomplete="given-name"
								on:blur={() => validateField('first_name')}
								placeholder="Max"
							/>

							<FormField
								label={$_('form.lastName')}
								type="text"
								name="last_name"
								bind:value={formData.last_name}
								error={errors.last_name}
								required
								autocomplete="family-name"
								on:blur={() => validateField('last_name')}
								placeholder="Mustermann"
							/>
						</div>

						<FormField
							label={$_('form.birthDate')}
							type="date"
							name="birth_date"
							bind:value={formData.birth_date}
							error={errors.birth_date}
							required
							autocomplete="bday"
							on:blur={() => validateField('birth_date')}
							on:change={() => validateField('birth_date')}
						/>

						{#if needsParentalConsent}
							<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
								<p class="text-sm text-yellow-800">
									⚠️ {$_('gdpr.parentalConsentRequired')}
								</p>
							</div>
						{/if}
					</div>
				</fieldset>

				<!-- Секция: Адрес -->
				<fieldset class="mb-8">
					<legend class="text-lg font-semibold text-gray-900 mb-4">
						{$_('form.address')}
					</legend>

					<div class="space-y-4">
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div class="sm:col-span-2">
								<FormField
									label={$_('form.addressStreet')}
									type="text"
									name="address_street"
									bind:value={formData.address_street}
									error={errors.address_street}
									required
									autocomplete="address-line1"
									on:blur={() => validateField('address_street')}
									placeholder="Hauptstraße"
								/>
							</div>

							<FormField
								label={$_('form.addressNumber')}
								type="text"
								name="address_number"
								bind:value={formData.address_number}
								error={errors.address_number}
								required
								autocomplete="address-line2"
								on:blur={() => validateField('address_number')}
								placeholder="12A"
							/>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<FormField
								label={$_('form.addressZip')}
								type="text"
								name="address_zip"
								bind:value={formData.address_zip}
								error={errors.address_zip}
								required
								autocomplete="postal-code"
								on:blur={() => validateField('address_zip')}
								placeholder="01067"
								maxlength="5"
							/>

							<div class="sm:col-span-2">
								<FormField
									label={$_('form.addressCity')}
									type="text"
									name="address_city"
									bind:value={formData.address_city}
									error={errors.address_city}
									required
									autocomplete="address-level2"
									on:blur={() => validateField('address_city')}
									placeholder="Dresden"
								/>
							</div>
						</div>
					</div>
				</fieldset>

				<!-- Секция: Контакты -->
				<fieldset class="mb-8">
					<legend class="text-lg font-semibold text-gray-900 mb-4">
						{$_('profile.contactData')}
					</legend>

					<div class="space-y-4">
						<FormField
							label={$_('form.phone')}
							type="tel"
							name="phone"
							bind:value={formData.phone}
							error={errors.phone}
							required
							autocomplete="tel"
							on:blur={() => validateField('phone')}
							placeholder="+49 123 456789"
						/>

						<FormField
							label="{$_('form.whatsapp')} ({$_('form.optional')})"
							type="tel"
							name="whatsapp"
							bind:value={formData.whatsapp}
							error={errors.whatsapp}
							autocomplete="tel"
							on:blur={() => validateField('whatsapp')}
							placeholder="+49 123 456789"
						/>

						<FormField
							label="{$_('form.telegram')} ({$_('form.optional')})"
							type="text"
							name="telegram"
							bind:value={formData.telegram}
							error={errors.telegram}
							on:blur={() => validateField('telegram')}
							placeholder="@username"
						/>
					</div>
				</fieldset>

				<!-- Секция: Согласия (GDPR) -->
				<fieldset class="mb-8">
					<legend class="text-lg font-semibold text-gray-900 mb-4"
						>{$_('auth.consents', { default: 'Согласия' })}</legend
					>

					<div class="space-y-4">
						<!-- GDPR Consent (обязательно) -->
						<div class="flex items-start">
							<div class="flex items-center h-5">
								<input
									id="gdpr_consent"
									name="gdpr_consent"
									type="checkbox"
									bind:checked={formData.gdpr_consent}
									class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
									required
									aria-describedby="gdpr_consent_description"
								/>
							</div>
							<div class="ml-3">
								<label for="gdpr_consent" class="text-sm font-medium text-gray-900">
									{$_('gdpr.dataProcessing')} <span class="text-red-500">*</span>
								</label>
								<p id="gdpr_consent_description" class="text-xs text-gray-600 mt-1">
									{$_('auth.gdprConsentDescription', {
										default:
											'Я соглашаюсь с обработкой моих персональных данных в соответствии с',
									})}
									<a
										href="/privacy"
										class="text-blue-600 hover:underline"
										target="_blank">{$_('gdpr.privacyPolicy')}</a
									>.
								</p>
								{#if errors.gdpr_consent}
									<p class="text-xs text-red-600 mt-1" role="alert">
										{errors.gdpr_consent}
									</p>
								{/if}
							</div>
						</div>

						<!-- Photo/Video Consent (опционально) -->
						<div class="flex items-start">
							<div class="flex items-center h-5">
								<input
									id="photo_video_consent"
									name="photo_video_consent"
									type="checkbox"
									bind:checked={formData.photo_video_consent}
									class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
									aria-describedby="photo_video_consent_description"
								/>
							</div>
							<div class="ml-3">
								<label
									for="photo_video_consent"
									class="text-sm font-medium text-gray-900"
								>
									{$_('gdpr.photoConsent')}
								</label>
								<p
									id="photo_video_consent_description"
									class="text-xs text-gray-600 mt-1"
								>
									{$_('auth.photoConsentDescription', {
										default:
											'Я разрешаю делать фотографии и видеозаписи с моим участием на мероприятиях и публиковать их в информационных материалах проекта Berufsorientierung',
									})}.
								</p>
							</div>
						</div>

						<!-- Parental Consent (обязательно если < 18 лет) -->
						{#if needsParentalConsent}
							<div
								class="flex items-start bg-yellow-50 p-4 rounded-lg border border-yellow-200"
							>
								<div class="flex items-center h-5">
									<input
										id="parental_consent"
										name="parental_consent"
										type="checkbox"
										bind:checked={formData.parental_consent}
										class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
										required
										aria-describedby="parental_consent_description"
									/>
								</div>
								<div class="ml-3">
									<label
										for="parental_consent"
										class="text-sm font-medium text-gray-900"
									>
										{$_('gdpr.parentalConsent')}
										<span class="text-red-500">*</span>
									</label>
									<p
										id="parental_consent_description"
										class="text-xs text-gray-600 mt-1"
									>
										{$_('auth.parentalConsentDescription', {
											default:
												'Я подтверждаю, что мои родители/законные представители согласны с моим участием в мероприятиях Berufsorientierung и обработкой моих персональных данных',
										})}.
									</p>
									{#if errors.parental_consent}
										<p class="text-xs text-red-600 mt-1" role="alert">
											{errors.parental_consent}
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</fieldset>

				<!-- Кнопки действий -->
				<div class="flex flex-col sm:flex-row gap-4">
					<Button
						type="submit"
						variant="primary"
						loading={isSubmitting}
						disabled={isSubmitting}
						class="flex-1"
					>
						{isSubmitting ? $_('common.loading') : $_('common.register')}
					</Button>

					<Button
						type="button"
						variant="secondary"
						on:click={() => goto('/login')}
						disabled={isSubmitting}
						class="flex-1 sm:flex-none"
					>
						{$_('common.cancel')}
					</Button>
				</div>

				<!-- Ссылка на вход -->
				<div class="mt-6 text-center">
					<p class="text-sm text-gray-600">
						{$_('auth.alreadyHaveAccount')}
						<a
							href="/login"
							class="font-medium text-blue-600 hover:text-blue-500 hover:underline"
						>
							{$_('common.login')}
						</a>
					</p>
				</div>
			</form>
		</div>

		<!-- Дополнительная информация -->
		<div class="mt-8 text-center text-xs text-gray-500">
			<p>
				{$_('auth.termsAgreement', { default: 'При регистрации вы соглашаетесь с нашими' })}
				<a href="/terms" class="text-blue-600 hover:underline" target="_blank"
					>{$_('auth.termsOfUse', { default: 'условиями использования' })}</a
				>
				{$_('common.and', { default: 'и' })}
				<a href="/privacy" class="text-blue-600 hover:underline" target="_blank"
					>{$_('gdpr.privacyPolicy')}</a
				>.
			</p>
		</div>
	</div>
</div>
