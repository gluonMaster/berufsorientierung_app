<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import type { Event, EventAdditionalField } from '$lib/types';

	export let mode: 'create' | 'edit' = 'create';
	export let event: Event | null = null;

	const dispatch = createEventDispatcher();

	// Поддерживаемые языки
	const languages = ['de', 'en', 'ru', 'uk'];
	let activeLanguage = 'de';

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
	let additionalFields: EventAdditionalField[] = [];

	// Состояние
	let loading = false;
	let error = '';

	/**
	 * Добавить новое дополнительное поле
	 */
	function addAdditionalField() {
		additionalFields = [
			...additionalFields,
			{
				id: Date.now(), // Временный ID для UI
				event_id: event?.id || 0,
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
	 * Отправка формы
	 */
	async function handleSubmit() {
		error = '';
		loading = true;

		try {
			// Валидация обязательных полей
			if (!formData.title.de.trim()) {
				throw new Error($_('admin.events.errors.titleRequired'));
			}
			if (!formData.date) {
				throw new Error($_('admin.events.errors.dateRequired'));
			}
			if (!formData.registration_deadline) {
				throw new Error($_('admin.events.errors.deadlineRequired'));
			}

			// Проверка что дедлайн до даты мероприятия
			if (formData.date && formData.registration_deadline) {
				if (new Date(formData.registration_deadline) >= new Date(formData.date)) {
					throw new Error($_('admin.events.errors.deadlineAfterDate'));
				}
			}

			// Валидация max_participants
			if (formData.max_participants !== null && formData.max_participants !== undefined) {
				const maxPart = Number(formData.max_participants);
				if (isNaN(maxPart) || maxPart <= 0) {
					throw new Error($_('admin.events.errors.saveFailed'));
				}
			}

			// Обработка дополнительных полей: преобразовать field_options для select
			const processedAdditionalFields = additionalFields.map((field) => {
				if (field.field_type === 'select' && field.field_options) {
					// Если field_options это строка, разбить по запятым
					const options =
						typeof field.field_options === 'string'
							? (field.field_options as string)
									.split(',')
									.map((opt: string) => opt.trim())
									.filter((opt: string) => opt.length > 0)
							: field.field_options;
					return {
						...field,
						field_options: options,
					};
				}
				return field;
			});

			// Подготовка данных для API
			const payload = {
				eventId: event?.id,
				...formData,
				// Развернуть мультиязычные поля
				title_de: formData.title.de,
				title_en: formData.title.en,
				title_ru: formData.title.ru,
				title_uk: formData.title.uk,
				description_de: formData.description.de,
				description_en: formData.description.en,
				description_ru: formData.description.ru,
				description_uk: formData.description.uk,
				requirements_de: formData.requirements.de,
				requirements_en: formData.requirements.en,
				requirements_ru: formData.requirements.ru,
				requirements_uk: formData.requirements.uk,
				location_de: formData.location.de,
				location_en: formData.location.en,
				location_ru: formData.location.ru,
				location_uk: formData.location.uk,
				additional_fields: processedAdditionalFields,
			};

			// Определить endpoint
			const endpoint =
				mode === 'create' ? '/api/admin/events/create' : '/api/admin/events/update';
			const method = mode === 'create' ? 'POST' : 'PUT';

			const response = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || $_('admin.events.errors.saveFailed'));
			}

			// Успех
			dispatch('success');
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
		dispatch('close');
	}
</script>

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
				/>
			</FormField>

			<!-- Требования -->
			<FormField label={$_('admin.events.fields.requirements')} required={false} error="">
				<textarea
					bind:value={formData.requirements[activeLanguage]}
					rows="4"
					placeholder={$_('admin.events.placeholders.requirements')}
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
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
				<Button type="button" on:click={addAdditionalField} variant="secondary" size="sm">
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
									<label class="block text-sm font-medium text-gray-700 mb-1">
										{$_('admin.events.fieldKey')}
										<span class="text-red-500">*</span>
									</label>
									<input
										type="text"
										bind:value={field.field_key}
										required
										placeholder="education_level"
										class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
								</div>

								<!-- Field Type -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">
										{$_('admin.events.fieldType')}
									</label>
									<select
										bind:value={field.field_type}
										class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									>
										<option value="text">Text</option>
										<option value="textarea">Textarea</option>
										<option value="number">Number</option>
										<option value="date">Date</option>
										<option value="select">Select</option>
										<option value="checkbox">Checkbox</option>
									</select>
								</div>

								<!-- Label DE -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">
										Label (DE) <span class="text-red-500">*</span>
									</label>
									<input
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
									<label class="block text-sm font-medium text-gray-700 mb-1">
										{$_('admin.events.selectOptions')}
										<span class="text-xs text-gray-500">
											({$_('admin.events.selectOptionsHelp')})
										</span>
									</label>
									<input
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
