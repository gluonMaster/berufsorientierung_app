<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { locale, _ } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { EventAdditionalField } from '$lib/types/event';
	import type { User, Event } from '$lib/types';

	// Типы данных из +page.server.ts
	export let data: {
		event: Event;
		user: User;
		additionalFields: EventAdditionalField[];
		availableSpots: number;
	};

	// Интерфейс для результата успешной регистрации
	interface RegistrationResult {
		success: boolean;
		registration: {
			id: number;
			event_id: number;
			registered_at: string;
			additional_data: string | null;
		};
		event: {
			id: number;
			title_de: string;
			title_en: string | null;
			title_ru: string | null;
			title_uk: string | null;
			date: string;
			location_de: string | null;
			location_en: string | null;
			location_ru: string | null;
			location_uk: string | null;
		};
		telegramLink: string | null;
		whatsappLink: string | null;
		qrTelegram: string | null;
		qrWhatsapp: string | null;
	}

	// Состояние многошаговой формы
	let currentStep = 1;
	const totalSteps = data.additionalFields.length > 0 ? 3 : 2; // Пропускаем шаг 2 если нет доп. полей

	// Данные дополнительных полей
	let additionalData: Record<string, any> = {};

	// Флаг подтверждения профиля (выставляется при переходе с Шага 1)
	let profileConfirmed = false;

	// Состояние загрузки и ошибок
	let isSubmitting = false;
	let errorMessage = '';
	let showSuccessModal = false;
	let registrationResult: RegistrationResult | null = null;

	// Текущий язык для fallback (берём из svelte-i18n store)
	$: currentLang = ($locale || 'de') as 'de' | 'en' | 'ru' | 'uk';

	/**
	 * Получает локализованное значение поля мероприятия с fallback на немецкий
	 */
	function getLocalizedField(
		field: string,
		obj: any,
		lang: 'de' | 'en' | 'ru' | 'uk'
	): string | null {
		const value = obj[`${field}_${lang}`];
		if (value) return value;
		// Fallback на немецкий
		return obj[`${field}_de`] || null;
	}

	/**
	 * Получает локализованный label для дополнительного поля
	 */
	function getFieldLabel(field: EventAdditionalField, lang: 'de' | 'en' | 'ru' | 'uk'): string {
		const label = field[`label_${lang}`];
		if (label) return label;
		// Fallback на немецкий
		return field.label_de || field.field_key;
	}

	/**
	 * Получает локализованный placeholder для дополнительного поля
	 */
	function getFieldPlaceholder(
		field: EventAdditionalField,
		lang: 'de' | 'en' | 'ru' | 'uk'
	): string {
		const placeholder = field[`placeholder_${lang}`];
		if (placeholder) return placeholder;
		// Fallback на немецкий
		return field.placeholder_de || '';
	}

	/**
	 * Форматирует дату для отображения
	 */
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	/**
	 * Переход к следующему шагу
	 */
	function nextStep() {
		if (currentStep === 1) {
			// Подтверждаем профиль при переходе с Шага 1
			profileConfirmed = true;
			// Шаг 1 -> Шаг 2 (или 3 если нет доп. полей)
			currentStep = data.additionalFields.length > 0 ? 2 : 3;
		} else if (currentStep === 2) {
			// Валидация дополнительных полей
			if (!validateAdditionalFields()) {
				return;
			}
			currentStep = 3;
		}
	}

	/**
	 * Переход к предыдущему шагу
	 */
	function prevStep() {
		if (currentStep === 3) {
			currentStep = data.additionalFields.length > 0 ? 2 : 1;
		} else if (currentStep === 2) {
			currentStep = 1;
		}
	}

	/**
	 * Валидация дополнительных полей
	 */
	function validateAdditionalFields(): boolean {
		errorMessage = '';

		for (const field of data.additionalFields) {
			if (field.required) {
				const value = additionalData[field.field_key];

				if (value === undefined || value === null || value === '') {
					errorMessage = $_('eventRegister.errors.requiredField', {
						values: { field: getFieldLabel(field, currentLang) },
					});
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Отправка формы регистрации
	 */
	async function submitRegistration() {
		isSubmitting = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/events/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					event_id: data.event.id,
					additional_data:
						Object.keys(additionalData).length > 0 ? additionalData : undefined,
					profile_confirmed: profileConfirmed,
				}),
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Registration failed');
			}

			// Успешная регистрация
			registrationResult = result;
			showSuccessModal = true;
		} catch (error: any) {
			console.error('Registration error:', error);
			errorMessage = error.message || $_('eventRegister.errors.generic');
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Редирект на редактирование профиля
	 */
	function editProfile() {
		goto(`/profile?returnTo=${encodeURIComponent($page.url.pathname)}`);
	}

	/**
	 * Возврат на главную страницу после успешной регистрации
	 */
	function goToHome() {
		goto('/');
	}

	/**
	 * Рендер поля в зависимости от типа
	 */
	function renderFieldInput(field: EventAdditionalField): {
		type:
			| 'text'
			| 'textarea'
			| 'tel'
			| 'email'
			| 'date'
			| 'password'
			| 'number'
			| 'select'
			| 'checkbox';
		options?: string[];
	} {
		const label = getFieldLabel(field, currentLang);
		const placeholder = getFieldPlaceholder(field, currentLang);

		switch (field.field_type) {
			case 'select':
				return { type: 'select', options: field.field_options || [] };
			case 'checkbox':
				return { type: 'checkbox' };
			case 'date':
				return { type: 'date' };
			case 'number':
				return { type: 'number' };
			default:
				return { type: 'text' };
		}
	}
</script>

<svelte:head>
	<title
		>{$_('eventRegister.title')} - {getLocalizedField('title', data.event, currentLang)}</title
	>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-3xl mx-auto">
		<!-- Заголовок и прогресс -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
				{$_('eventRegister.title')}
			</h1>
			<p class="text-gray-600 mb-4">
				{getLocalizedField('title', data.event, currentLang)}
			</p>

			<!-- Прогресс-бар -->
			<div class="flex items-center justify-between mb-4">
				{#each Array(totalSteps) as _, i}
					<div class="flex items-center flex-1">
						<div
							class="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors {currentStep >
							i
								? 'bg-blue-600 border-blue-600 text-white'
								: currentStep === i + 1
									? 'border-blue-600 text-blue-600'
									: 'border-gray-300 text-gray-400'}"
						>
							{i + 1}
						</div>
						{#if i < totalSteps - 1}
							<div
								class="flex-1 h-1 mx-2 transition-colors {currentStep > i + 1
									? 'bg-blue-600'
									: 'bg-gray-300'}"
							></div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Названия шагов -->
			<div class="flex justify-between text-xs sm:text-sm text-center">
				<div class="flex-1">{$_('eventRegister.step1.title')}</div>
				{#if data.additionalFields.length > 0}
					<div class="flex-1">{$_('eventRegister.step2.title')}</div>
				{/if}
				<div class="flex-1">{$_('eventRegister.step3.title')}</div>
			</div>
		</div>

		<!-- Контент шагов -->
		<div class="bg-white rounded-lg shadow-md p-6">
			<!-- Шаг 1: Подтверждение данных профиля -->
			{#if currentStep === 1}
				<div class="space-y-6">
					<h2 class="text-xl font-semibold text-gray-900">
						{$_('eventRegister.step1.heading')}
					</h2>
					<p class="text-gray-600">
						{$_('eventRegister.step1.description')}
					</p>

					<!-- Таблица с данными пользователя -->
					<div class="border border-gray-200 rounded-lg overflow-hidden">
						<table class="min-w-full divide-y divide-gray-200">
							<tbody class="bg-white divide-y divide-gray-200">
								<tr>
									<td
										class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
									>
										{$_('eventRegister.step1.fields.name')}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700">
										{data.user.first_name}
										{data.user.last_name}
									</td>
								</tr>
								<tr>
									<td
										class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
									>
										{$_('eventRegister.step1.fields.email')}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700"
										>{data.user.email}</td
									>
								</tr>
								<tr>
									<td
										class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
									>
										{$_('eventRegister.step1.fields.birthDate')}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700">
										{new Date(data.user.birth_date).toLocaleDateString(
											currentLang
										)}
									</td>
								</tr>
								<tr>
									<td
										class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
									>
										{$_('eventRegister.step1.fields.address')}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700">
										{data.user.address_street}
										{data.user.address_number}, {data.user.address_zip}
										{data.user.address_city}
									</td>
								</tr>
								<tr>
									<td
										class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
									>
										{$_('eventRegister.step1.fields.phone')}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700"
										>{data.user.phone}</td
									>
								</tr>
								{#if data.user.whatsapp}
									<tr>
										<td
											class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
											>WhatsApp</td
										>
										<td class="px-4 py-3 text-sm text-gray-700"
											>{data.user.whatsapp}</td
										>
									</tr>
								{/if}
								{#if data.user.telegram}
									<tr>
										<td
											class="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50"
											>Telegram</td
										>
										<td class="px-4 py-3 text-sm text-gray-700"
											>{data.user.telegram}</td
										>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>

					<!-- Кнопки -->
					<div class="flex flex-col sm:flex-row gap-4">
						<Button variant="secondary" on:click={editProfile} class="flex-1">
							{$_('eventRegister.step1.editProfile')}
						</Button>
						<Button on:click={nextStep} class="flex-1">
							{$_('eventRegister.step1.confirmData')}
						</Button>
					</div>
				</div>
			{/if}

			<!-- Шаг 2: Дополнительные поля -->
			{#if currentStep === 2}
				<div class="space-y-6">
					<h2 class="text-xl font-semibold text-gray-900">
						{$_('eventRegister.step2.heading')}
					</h2>
					<p class="text-gray-600">
						{$_('eventRegister.step2.description')}
					</p>

					<!-- Динамические поля -->
					<div class="space-y-4">
						{#each data.additionalFields as field}
							{@const fieldConfig = renderFieldInput(field)}
							{@const label = getFieldLabel(field, currentLang)}
							{@const placeholder = getFieldPlaceholder(field, currentLang)}

							{#if fieldConfig.type === 'select'}
								<div>
									<label
										for={field.field_key}
										class="block text-sm font-medium text-gray-700 mb-2"
									>
										{label}
										{#if field.required}
											<span class="text-red-500">*</span>
										{/if}
									</label>
									<select
										id={field.field_key}
										bind:value={additionalData[field.field_key]}
										required={field.required}
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									>
										<option value=""
											>{placeholder ||
												$_('eventRegister.step2.selectOption')}</option
										>
										{#each fieldConfig.options as option}
											<option value={option}>{option}</option>
										{/each}
									</select>
								</div>
							{:else if fieldConfig.type === 'checkbox'}
								<div class="flex items-start">
									<input
										type="checkbox"
										id={field.field_key}
										bind:checked={additionalData[field.field_key]}
										required={field.required}
										class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
									/>
									<label for={field.field_key} class="ml-3 text-sm text-gray-700">
										{label}
										{#if field.required}
											<span class="text-red-500">*</span>
										{/if}
									</label>
								</div>
							{:else if fieldConfig.type === 'number'}
								<div>
									<label
										for={field.field_key}
										class="block text-sm font-medium text-gray-700 mb-2"
									>
										{label}
										{#if field.required}
											<span class="text-red-500">*</span>
										{/if}
									</label>
									<input
										type="number"
										id={field.field_key}
										bind:value={additionalData[field.field_key]}
										{placeholder}
										required={field.required}
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									/>
								</div>
							{:else}
								<FormField
									{label}
									type={fieldConfig.type as
										| 'text'
										| 'textarea'
										| 'tel'
										| 'email'
										| 'date'
										| 'password'}
									bind:value={additionalData[field.field_key]}
									{placeholder}
									required={field.required}
								/>
							{/if}
						{/each}
					</div>

					{#if errorMessage}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
							{errorMessage}
						</div>
					{/if}

					<!-- Кнопки -->
					<div class="flex flex-col sm:flex-row gap-4">
						<Button variant="secondary" on:click={prevStep} class="flex-1">
							{$_('eventRegister.back')}
						</Button>
						<Button on:click={nextStep} class="flex-1">
							{$_('eventRegister.next')}
						</Button>
					</div>
				</div>
			{/if}

			<!-- Шаг 3: Подтверждение -->
			{#if currentStep === 3}
				<div class="space-y-6">
					<h2 class="text-xl font-semibold text-gray-900">
						{$_('eventRegister.step3.heading')}
					</h2>
					<p class="text-gray-600">
						{$_('eventRegister.step3.description')}
					</p>

					<!-- Сводка данных -->
					<div class="space-y-4">
						<!-- Информация о мероприятии -->
						<div class="bg-gray-50 rounded-lg p-4">
							<h3 class="font-semibold text-gray-900 mb-2">
								{$_('eventRegister.step3.eventInfo')}
							</h3>
							<dl class="space-y-2 text-sm">
								<div>
									<dt class="font-medium text-gray-700">
										{$_('eventRegister.step3.eventTitle')}:
									</dt>
									<dd class="text-gray-600">
										{getLocalizedField('title', data.event, currentLang)}
									</dd>
								</div>
								<div>
									<dt class="font-medium text-gray-700">
										{$_('eventRegister.step3.eventDate')}:
									</dt>
									<dd class="text-gray-600">{formatDate(data.event.date)}</dd>
								</div>
								{#if getLocalizedField('location', data.event, currentLang)}
									<div>
										<dt class="font-medium text-gray-700">
											{$_('eventRegister.step3.location')}:
										</dt>
										<dd class="text-gray-600">
											{getLocalizedField('location', data.event, currentLang)}
										</dd>
									</div>
								{/if}
								<div>
									<dt class="font-medium text-gray-700">
										{$_('eventRegister.step3.availableSpots')}:
									</dt>
									<dd class="text-gray-600">{data.availableSpots}</dd>
								</div>
							</dl>
						</div>

						<!-- Ваши данные -->
						<div class="bg-gray-50 rounded-lg p-4">
							<h3 class="font-semibold text-gray-900 mb-2">
								{$_('eventRegister.step3.yourInfo')}
							</h3>
							<p class="text-sm text-gray-600">
								{data.user.first_name}
								{data.user.last_name}, {data.user.email}
							</p>
						</div>

						<!-- Дополнительные данные (если были) -->
						{#if Object.keys(additionalData).length > 0}
							<div class="bg-gray-50 rounded-lg p-4">
								<h3 class="font-semibold text-gray-900 mb-2">
									{$_('eventRegister.step3.additionalInfo')}
								</h3>
								<dl class="space-y-2 text-sm">
									{#each data.additionalFields as field}
										{#if additionalData[field.field_key] !== undefined && additionalData[field.field_key] !== null && additionalData[field.field_key] !== ''}
											<div>
												<dt class="font-medium text-gray-700">
													{getFieldLabel(field, currentLang)}:
												</dt>
												<dd class="text-gray-600">
													{#if field.field_type === 'checkbox'}
														{additionalData[field.field_key]
															? $_('common.yes')
															: $_('common.no')}
													{:else}
														{additionalData[field.field_key]}
													{/if}
												</dd>
											</div>
										{/if}
									{/each}
								</dl>
							</div>
						{/if}
					</div>

					{#if errorMessage}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
							{errorMessage}
						</div>
					{/if}

					<!-- Кнопки -->
					<div class="flex flex-col sm:flex-row gap-4">
						<Button
							variant="secondary"
							on:click={prevStep}
							disabled={isSubmitting}
							class="flex-1"
						>
							{$_('eventRegister.back')}
						</Button>
						<Button
							on:click={submitRegistration}
							disabled={isSubmitting}
							class="flex-1"
						>
							{#if isSubmitting}
								{$_('eventRegister.step3.submitting')}
							{:else}
								{$_('eventRegister.step3.confirm')}
							{/if}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Модальное окно успешной регистрации -->
{#if showSuccessModal}
	<Modal isOpen={showSuccessModal} title={$_('eventRegister.success.title')} on:close={goToHome}>
		<div class="space-y-4">
			<p class="text-gray-700">
				{$_('eventRegister.success.message')}
			</p>

			<!-- Ссылки на мессенджеры (используем актуальные данные из registrationResult) -->
			{#if registrationResult?.telegramLink || registrationResult?.whatsappLink}
				<div class="border-t border-gray-200 pt-4">
					<p class="text-sm font-medium text-gray-900 mb-3">
						{$_('eventRegister.success.joinMessengers')}
					</p>
					<div class="flex flex-col sm:flex-row gap-3">
						{#if registrationResult.telegramLink}
							<a
								href={registrationResult.telegramLink}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
							>
								<span>Telegram</span>
							</a>
						{/if}
						{#if registrationResult.whatsappLink}
							<a
								href={registrationResult.whatsappLink}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
							>
								<span>WhatsApp</span>
							</a>
						{/if}
					</div>
				</div>
			{/if}

			<!-- QR-коды (используем актуальные данные из registrationResult) -->
			{#if registrationResult?.qrTelegram || registrationResult?.qrWhatsapp}
				<div class="border-t border-gray-200 pt-4">
					<p class="text-sm font-medium text-gray-900 mb-3">
						{$_('eventRegister.success.scanQR')}
					</p>
					<div class="flex flex-col sm:flex-row gap-4 justify-center">
						{#if registrationResult.qrTelegram}
							<div class="text-center">
								<img
									src={registrationResult.qrTelegram}
									alt="Telegram QR Code"
									class="w-32 h-32 mx-auto mb-2"
								/>
								<p class="text-xs text-gray-600">Telegram</p>
							</div>
						{/if}
						{#if registrationResult.qrWhatsapp}
							<div class="text-center">
								<img
									src={registrationResult.qrWhatsapp}
									alt="WhatsApp QR Code"
									class="w-32 h-32 mx-auto mb-2"
								/>
								<p class="text-xs text-gray-600">WhatsApp</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Кнопка закрытия -->
			<div class="border-t border-gray-200 pt-4">
				<Button on:click={goToHome} class="w-full">
					{$_('eventRegister.success.goHome')}
				</Button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Toast для ошибок -->
{#if errorMessage && !showSuccessModal}
	<Toast message={errorMessage} type="error" on:close={() => (errorMessage = '')} />
{/if}
