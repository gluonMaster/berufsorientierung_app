<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import type { Event, EventAdditionalField } from '$lib/types';

	// Props
	export let isOpen: boolean = true;
	export let mode: 'create' | 'edit' = 'create';
	export let event: Event | null = null;
	export let onClose: () => void = () => {};
	export let onSave: (eventData: any) => Promise<void> = async () => {};

	const dispatch = createEventDispatcher();

	// Поддерживаемые языки
	const languages = ['de', 'en', 'ru', 'uk'] as const;
	let activeLanguage: (typeof languages)[number] = 'de';

	// Форма мероприятия
	let formData = {
		// Мультиязычные поля (вкладки)
		title: {
			de: event?.title_de || '',
			en: event?.title_en || '',
			ru: event?.title_ru || '',
			uk: event?.title_uk || '',
		},
		description: {
			de: event?.description_de || '',
			en: event?.description_en || '',
			ru: event?.description_ru || '',
			uk: event?.description_uk || '',
		},
		requirements: {
			de: event?.requirements_de || '',
			en: event?.requirements_en || '',
			ru: event?.requirements_ru || '',
			uk: event?.requirements_uk || '',
		},
		location: {
			de: event?.location_de || '',
			en: event?.location_en || '',
			ru: event?.location_ru || '',
			uk: event?.location_uk || '',
		},

		// Основные поля
		date: event?.date || '',
		registration_deadline: event?.registration_deadline || '',
		max_participants: event?.max_participants || null,

		// Ссылки на мессенджеры
		telegram_link: event?.telegram_link || '',
		whatsapp_link: event?.whatsapp_link || '',
	};

	// Дополнительные поля для формы регистрации
	interface AdditionalFieldUI {
		id: number;
		field_key: string;
		field_type: 'text' | 'select' | 'checkbox' | 'date' | 'number';
		field_options: string | string[] | null;
		required: boolean;
		label_de: string;
		label_en: string;
		label_ru: string;
		label_uk: string;
		placeholder_de: string;
		placeholder_en: string;
		placeholder_ru: string;
		placeholder_uk: string;
	}
	let additionalFields: AdditionalFieldUI[] = [];

	// Загрузка дополнительных полей при редактировании
	onMount(async () => {
		if (mode === 'edit' && event?.id) {
			await loadAdditionalFields();
		}
	});

	/**
	 * Загрузить дополнительные поля при редактировании
	 */
	async function loadAdditionalFields() {
		try {
			const response = await fetch(`/api/admin/events/${event!.id}/fields`);
			if (response.ok) {
				const data = await response.json();
				additionalFields = data.fields.map((field: EventAdditionalField) => ({
					id: field.id,
					field_key: field.field_key,
					field_type: field.field_type,
					field_options: field.field_options
						? Array.isArray(field.field_options)
							? field.field_options.join(', ')
							: field.field_options
						: null,
					required: field.required,
					label_de: field.label_de || '',
					label_en: field.label_en || '',
					label_ru: field.label_ru || '',
					label_uk: field.label_uk || '',
					placeholder_de: field.placeholder_de || '',
					placeholder_en: field.placeholder_en || '',
					placeholder_ru: field.placeholder_ru || '',
					placeholder_uk: field.placeholder_uk || '',
				}));
			}
		} catch (err) {
			console.warn('Failed to load additional fields:', err);
		}
	}

	/**
	 * Добавить новое дополнительное поле
	 */
	function addAdditionalField() {
		additionalFields = [
			...additionalFields,
			{
				id: Date.now(), // Временный ID для UI
				field_key: '',
				field_type: 'text',
				field_options: null,
				required: false,
				label_de: '',
				label_en: '',
				label_ru: '',
				label_uk: '',
				placeholder_de: '',
				placeholder_en: '',
				placeholder_ru: '',
				placeholder_uk: '',
			},
		];
	}

	/**
	 * Удалить дополнительное поле
	 */
	function removeAdditionalField(index: number) {
		additionalFields = additionalFields.filter((_, i) => i !== index);
	}

	/**
	 * Валидация формы
	 */
	function validateForm(): string | null {
		// Проверка title_de (обязательно)
		if (!formData.title.de.trim()) {
			return $_('admin.events.errors.titleRequired');
		}

		// Проверка даты мероприятия
		if (!formData.date) {
			return $_('admin.events.errors.dateRequired');
		}

		const eventDate = new Date(formData.date);
		const now = new Date();

		// Дата мероприятия должна быть в будущем
		if (eventDate <= now) {
			return $_('admin.events.errors.dateMustBeFuture');
		}

		// Проверка дедлайна регистрации
		if (!formData.registration_deadline) {
			return $_('admin.events.errors.deadlineRequired');
		}

		const deadlineDate = new Date(formData.registration_deadline);

		// Дедлайн должен быть раньше даты мероприятия
		if (deadlineDate >= eventDate) {
			return $_('admin.events.errors.deadlineAfterDate');
		}

		// Проверка max_participants
		if (formData.max_participants !== null && formData.max_participants !== undefined) {
			const maxPart = Number(formData.max_participants);
			if (isNaN(maxPart) || maxPart <= 0) {
				return $_('admin.events.errors.invalidMaxParticipants');
			}
		}

		// Валидация дополнительных полей
		for (let i = 0; i < additionalFields.length; i++) {
			const field = additionalFields[i];

			// field_key обязателен и должен быть в snake_case
			if (!field.field_key.trim()) {
				return $_('admin.events.errors.fieldKeyRequired', {
					values: { number: i + 1 },
				});
			}

			// Проверка формата field_key (snake_case)
			const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
			if (!snakeCaseRegex.test(field.field_key)) {
				return $_('admin.events.errors.fieldKeyInvalidFormat', {
					values: { key: field.field_key },
				});
			}

			// label_de обязателен
			if (!field.label_de.trim()) {
				return $_('admin.events.errors.labelDeRequired', {
					values: { number: i + 1 },
				});
			}

			// Для select должны быть options
			if (field.field_type === 'select') {
				const options =
					typeof field.field_options === 'string'
						? field.field_options.trim()
						: field.field_options;

				if (!options || options.length === 0) {
					return $_('admin.events.errors.selectOptionsRequired', {
						values: { number: i + 1 },
					});
				}
			}
		}

		return null;
	}

	/**
	 * Отправка формы
	 */
	async function handleSubmit() {
		error = '';
		loading = true;

		try {
			// Валидация
			const validationError = validateForm();
			if (validationError) {
				throw new Error(validationError);
			}

			// Обработка дополнительных полей: преобразовать field_options для select
			const processedAdditionalFields = additionalFields.map((field) => {
				const processedField = { ...field };

				if (field.field_type === 'select' && field.field_options) {
					// Если field_options это строка, разбить по запятым
					const options =
						typeof field.field_options === 'string'
							? (field.field_options as string)
									.split(',')
									.map((opt: string) => opt.trim())
									.filter((opt: string) => opt.length > 0)
							: field.field_options;
					processedField.field_options = options;
				} else if (field.field_type !== 'select') {
					// Для не-select полей убираем field_options
					processedField.field_options = null;
				}

				return processedField;
			});

			// Подготовка данных для API
			const payload = {
				eventId: event?.id,
				// Развернуть мультиязычные поля
				title_de: formData.title.de.trim(),
				title_en: formData.title.en.trim() || null,
				title_ru: formData.title.ru.trim() || null,
				title_uk: formData.title.uk.trim() || null,
				description_de: formData.description.de.trim() || null,
				description_en: formData.description.en.trim() || null,
				description_ru: formData.description.ru.trim() || null,
				description_uk: formData.description.uk.trim() || null,
				requirements_de: formData.requirements.de.trim() || null,
				requirements_en: formData.requirements.en.trim() || null,
				requirements_ru: formData.requirements.ru.trim() || null,
				requirements_uk: formData.requirements.uk.trim() || null,
				location_de: formData.location.de.trim() || null,
				location_en: formData.location.en.trim() || null,
				location_ru: formData.location.ru.trim() || null,
				location_uk: formData.location.uk.trim() || null,
				date: formData.date,
				registration_deadline: formData.registration_deadline,
				max_participants: formData.max_participants || null,
				// ✅ ИСПРАВЛЕНО: отправляем пустую строку вместо null для соответствия urlSchema
				telegram_link: formData.telegram_link.trim(),
				whatsapp_link: formData.whatsapp_link.trim(),
				additional_fields: processedAdditionalFields,
			};

			// Вызвать onSave из props
			await onSave(payload);

			// Успех
			dispatch('success');
			onClose();
		} catch (err: any) {
			error = err.message || $_('admin.events.errors.saveFailed');
		} finally {
			loading = false;
		}
	}

	/**
	 * Закрыть модал
	 */
	function handleClose() {
		onClose();
		dispatch('close');
	}

	// Состояние
	let loading = false;
	let error = '';
</script>

{#if isOpen}
	<Modal
		title={mode === 'create'
			? $_('admin.events.createEventTitle')
			: $_('admin.events.editEventTitle')}
		on:close={handleClose}
		size="lg"
	>
		<form on:submit|preventDefault={handleSubmit} class="space-y-6">
			<!-- Ошибка -->
			{#if error}
				<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
					{error}
				</div>
			{/if}

			<!-- Вкладки языков -->
			<div class="border-b border-gray-200">
				<nav class="-mb-px flex space-x-4" aria-label="Tabs">
					{#each languages as lang}
						<button
							type="button"
							on:click={() => (activeLanguage = lang)}
							class="py-2 px-1 border-b-2 font-medium text-sm {activeLanguage === lang
								? 'border-blue-500 text-blue-600'
								: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						>
							{lang.toUpperCase()}
							{#if lang === 'de'}
								<span class="text-red-500">*</span>
							{/if}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Мультиязычные поля -->
			<div class="space-y-4">
				<!-- Название -->
				<FormField
					label={$_('admin.events.fields.title')}
					required={activeLanguage === 'de'}
					error=""
				>
					<input
						type="text"
						bind:value={formData.title[activeLanguage]}
						required={activeLanguage === 'de'}
						placeholder={$_('admin.events.placeholders.title')}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</FormField>

				<!-- Описание -->
				<FormField label={$_('admin.events.fields.description')} required={false} error="">
					<textarea
						bind:value={formData.description[activeLanguage]}
						rows="6"
						placeholder={$_('admin.events.placeholders.description')}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					></textarea>
				</FormField>

				<!-- Требования -->
				<FormField label={$_('admin.events.fields.requirements')} required={false} error="">
					<textarea
						bind:value={formData.requirements[activeLanguage]}
						rows="4"
						placeholder={$_('admin.events.placeholders.requirements')}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					></textarea>
				</FormField>

				<!-- Место проведения -->
				<FormField label={$_('admin.events.fields.location')} required={false} error="">
					<input
						type="text"
						bind:value={formData.location[activeLanguage]}
						placeholder={$_('admin.events.placeholders.location')}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</FormField>
			</div>

			<!-- Разделитель -->
			<div class="border-t border-gray-200 pt-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">
					{$_('admin.events.sections.mainInfo')}
				</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Дата мероприятия -->
					<FormField
						label={$_('admin.events.fields.date')}
						required={true}
						error=""
						help={$_('admin.events.help.date')}
					>
						<input
							type="datetime-local"
							bind:value={formData.date}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</FormField>

					<!-- Дедлайн регистрации -->
					<FormField
						label={$_('admin.events.fields.registrationDeadline')}
						required={true}
						error=""
						help={$_('admin.events.help.deadline')}
					>
						<input
							type="datetime-local"
							bind:value={formData.registration_deadline}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</FormField>

					<!-- Максимум участников -->
					<FormField
						label={$_('admin.events.fields.maxParticipants')}
						required={false}
						error=""
						help={$_('admin.events.help.maxParticipants')}
					>
						<input
							type="number"
							bind:value={formData.max_participants}
							min="1"
							placeholder={$_('admin.events.placeholders.unlimited')}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</FormField>
				</div>
			</div>

			<!-- Ссылки на мессенджеры -->
			<div class="border-t border-gray-200 pt-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">
					{$_('admin.events.sections.messengers')}
				</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Telegram -->
					<FormField
						label={$_('admin.events.fields.telegramLink')}
						required={false}
						error=""
						help={$_('admin.events.help.telegramLink')}
					>
						<input
							type="url"
							bind:value={formData.telegram_link}
							placeholder="https://t.me/..."
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</FormField>

					<!-- WhatsApp -->
					<FormField
						label={$_('admin.events.fields.whatsappLink')}
						required={false}
						error=""
						help={$_('admin.events.help.whatsappLink')}
					>
						<input
							type="url"
							bind:value={formData.whatsapp_link}
							placeholder="https://chat.whatsapp.com/..."
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</FormField>
				</div>
			</div>

			<!-- Дополнительные поля формы регистрации -->
			<div class="border-t border-gray-200 pt-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-medium text-gray-900">
						{$_('admin.events.sections.additionalFields')}
					</h3>
					<Button
						type="button"
						on:click={addAdditionalField}
						variant="secondary"
						size="sm"
					>
						<svg
							class="w-4 h-4 mr-1"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						{$_('admin.events.addField')}
					</Button>
				</div>

				{#if additionalFields.length === 0}
					<p class="text-sm text-gray-500 italic">
						{$_('admin.events.noAdditionalFields')}
					</p>
				{:else}
					<div class="space-y-4">
						{#each additionalFields as field, index}
							<div class="bg-gray-50 p-4 rounded-md border border-gray-200">
								<div class="flex justify-between items-start mb-3">
									<h4 class="text-sm font-medium text-gray-700">
										{$_('admin.events.fieldNumber', {
											values: { number: index + 1 },
										})}
									</h4>
									<button
										type="button"
										on:click={() => removeAdditionalField(index)}
										class="text-red-600 hover:text-red-800"
										aria-label={$_('admin.events.removeField')}
									>
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
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
									<!-- Field Key -->
									<div>
										<label
											for="field-key-{index}"
											class="block text-sm font-medium text-gray-700 mb-1"
										>
											{$_('admin.events.fieldKey')}
											<span class="text-red-500">*</span>
										</label>
										<input
											id="field-key-{index}"
											type="text"
											bind:value={field.field_key}
											required
											placeholder="education_level"
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>

									<!-- Field Type -->
									<div>
										<label
											for="field-type-{index}"
											class="block text-sm font-medium text-gray-700 mb-1"
										>
											{$_('admin.events.fieldType')}
										</label>
										<select
											id="field-type-{index}"
											bind:value={field.field_type}
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										>
											<option value="text">Text</option>
											<option value="number">Number</option>
											<option value="date">Date</option>
											<option value="select">Select</option>
											<option value="checkbox">Checkbox</option>
										</select>
									</div>

									<!-- Label DE -->
									<div>
										<label
											for="field-label-de-{index}"
											class="block text-sm font-medium text-gray-700 mb-1"
										>
											Label (DE) <span class="text-red-500">*</span>
										</label>
										<input
											id="field-label-de-{index}"
											type="text"
											bind:value={field.label_de}
											required
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>

									<!-- Required -->
									<div class="flex items-center pt-6">
										<input
											type="checkbox"
											bind:checked={field.required}
											id="required-{index}"
											class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
										/>
										<label
											for="required-{index}"
											class="ml-2 text-sm text-gray-700"
										>
											{$_('admin.events.fieldRequired')}
										</label>
									</div>
								</div>

								<!-- Опции для select -->
								{#if field.field_type === 'select'}
									<div class="mt-3">
										<label
											for="field-options-{index}"
											class="block text-sm font-medium text-gray-700 mb-1"
										>
											{$_('admin.events.selectOptions')}
											<span class="text-xs text-gray-500">
												({$_('admin.events.selectOptionsHelp')})
											</span>
										</label>
										<input
											id="field-options-{index}"
											type="text"
											bind:value={field.field_options}
											placeholder="Option 1, Option 2, Option 3"
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</form>

		<!-- Actions -->
		<svelte:fragment slot="actions">
			<Button on:click={handleClose} variant="secondary" disabled={loading}>
				{$_('common.cancel')}
			</Button>
			<Button on:click={handleSubmit} variant="primary" disabled={loading}>
				{#if loading}
					<svg
						class="animate-spin h-5 w-5 mr-2"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					{$_('common.saving')}
				{:else}
					{mode === 'create' ? $_('admin.events.create') : $_('admin.events.save')}
				{/if}
			</Button>
		</svelte:fragment>
	</Modal>
{/if}
