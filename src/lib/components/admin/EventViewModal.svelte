<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { Event, User, Registration } from '$lib/types';

	// Расширенный тип Event с дополнительными полями от API
	interface EventWithCreator extends Event {
		creator_name?: string;
	}

	// Props
	export let isOpen: boolean = true;
	export let eventId: number;
	export let onClose: () => void = () => {};

	const dispatch = createEventDispatcher();

	// Данные мероприятия и участников
	let event: EventWithCreator | null = null;
	let registrations: (Registration & { user: User })[] = [];
	let loading = true;
	let error = '';

	// Флаги для индикации процесса перегенерации QR
	let isRegeneratingTelegram = false;
	let isRegeneratingWhatsapp = false;
	let regenerateError = '';

	/**
	 * Загрузить данные мероприятия и список участников при открытии
	 */
	onMount(async () => {
		await loadEventData();
		await loadRegistrations();
	});

	/**
	 * Загрузить полные данные мероприятия
	 */
	async function loadEventData() {
		try {
			const response = await fetch(`/api/admin/events/${eventId}`);

			if (!response.ok) {
				throw new Error($_('admin.events.errors.loadEventFailed'));
			}

			const data = await response.json();
			event = data.event;
		} catch (err: any) {
			console.error('Event loading failed:', err);
			error = err.message || $_('admin.events.errors.loadEventFailed');
		}
	}

	/**
	 * Загрузить регистрации на мероприятие
	 */
	async function loadRegistrations() {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/admin/events/${eventId}/registrations`);

			if (!response.ok) {
				// Эндпоинт еще не реализован - показываем пустой список
				if (response.status === 404) {
					registrations = [];
					return;
				}
				throw new Error($_('admin.events.errors.loadRegistrationsFailed'));
			}

			const data = await response.json();
			registrations = data.registrations || [];
		} catch (err: any) {
			console.error('Failed to load registrations:', err);
			error = err.message || $_('admin.events.errors.loadRegistrationsFailed');
			registrations = [];
		} finally {
			loading = false;
		}
	}

	/**
	 * Форматирование даты
	 */
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat($locale || 'de', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date);
	}

	/**
	 * Получить локализованное значение поля
	 */
	function getLocalizedField(
		de: string,
		en: string | null | undefined,
		ru: string | null | undefined,
		uk: string | null | undefined
	): string {
		const currentLocale = $locale || 'de';
		const values: Record<string, string | null | undefined> = {
			de,
			en: en || de,
			ru: ru || de,
			uk: uk || de,
		};
		return values[currentLocale] || de;
	}

	/**
	 * Экспорт участников в CSV
	 */
	function exportToCSV() {
		if (registrations.length === 0 || !event) {
			return;
		}

		// Заголовки CSV
		const headers = [
			$_('admin.events.csv.firstName'),
			$_('admin.events.csv.lastName'),
			$_('admin.events.csv.email'),
			$_('admin.events.csv.phone'),
			$_('admin.events.csv.registeredAt'),
		];

		// Данные
		const rows = registrations.map((reg) => [
			reg.user.first_name,
			reg.user.last_name,
			reg.user.email,
			reg.user.phone || '',
			formatDate(reg.registered_at),
		]);

		// Формирование CSV
		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
		].join('\n');

		// Скачивание файла
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `event_${eventId}_participants.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	/**
	 * Редактировать мероприятие
	 */
	function handleEdit() {
		dispatch('edit', { eventId });
		onClose();
	}

	/**
	 * Перегенерировать QR-код для Telegram или WhatsApp
	 */
	async function regenerateQr(type: 'telegram' | 'whatsapp') {
		regenerateError = '';

		// Устанавливаем флаг загрузки
		if (type === 'telegram') {
			isRegeneratingTelegram = true;
		} else {
			isRegeneratingWhatsapp = true;
		}

		try {
			const response = await fetch('/api/admin/events/regenerate-qr', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					eventId,
					type,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || $_('admin.events.errors.regenerateQrFailed'));
			}

			// Успешная перегенерация - перезагружаем данные события
			await loadEventData();
		} catch (err: any) {
			console.error('QR regeneration failed:', err);
			regenerateError = err.message || $_('admin.events.errors.regenerateQrFailed');
		} finally {
			// Сбрасываем флаги загрузки
			if (type === 'telegram') {
				isRegeneratingTelegram = false;
			} else {
				isRegeneratingWhatsapp = false;
			}
		}
	}

	/**
	 * Закрыть модал
	 */
	function handleClose() {
		onClose();
		dispatch('close');
	}
</script>

{#if isOpen && event}
	<Modal title={$_('admin.events.viewEventTitle')} on:close={handleClose} size="lg">
		<div class="space-y-6">
			<!-- Название и статус -->
			<div>
				<div class="flex items-start justify-between mb-2">
					<h2 class="text-2xl font-bold text-gray-900">
						{getLocalizedField(
							event.title_de,
							event.title_en,
							event.title_ru,
							event.title_uk
						)}
					</h2>
					<span
						class="px-3 py-1 text-sm font-semibold rounded-full {event.status ===
						'active'
							? 'bg-green-100 text-green-800'
							: event.status === 'draft'
								? 'bg-gray-100 text-gray-800'
								: 'bg-red-100 text-red-800'}"
					>
						{$_(
							`admin.events.status${event.status.charAt(0).toUpperCase() + event.status.slice(1)}`
						)}
					</span>
				</div>
			</div>

			<!-- Метаданные мероприятия -->
			<div class="bg-blue-50 border border-blue-200 rounded-md p-4">
				<h3 class="text-sm font-semibold text-blue-900 mb-2">
					{$_('admin.events.metadata')}
				</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
					<!-- Создано -->
					<div>
						<div class="text-blue-700 font-medium">{$_('admin.events.createdAt')}</div>
						<div class="text-blue-900">{formatDate(event.created_at)}</div>
					</div>

					<!-- Обновлено -->
					{#if event.updated_at && event.updated_at !== event.created_at}
						<div>
							<div class="text-blue-700 font-medium">
								{$_('admin.events.updatedAt')}
							</div>
							<div class="text-blue-900">{formatDate(event.updated_at)}</div>
						</div>
					{/if}

					<!-- Создал -->
					{#if event.creator_name}
						<div>
							<div class="text-blue-700 font-medium">
								{$_('admin.events.createdBy')}
							</div>
							<div class="text-blue-900">{event.creator_name}</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Основная информация -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
				<!-- Дата -->
				<div>
					<div class="text-sm text-gray-600">{$_('admin.events.fields.date')}</div>
					<div class="font-medium text-gray-900">{formatDate(event.date)}</div>
				</div>

				<!-- Дедлайн регистрации -->
				<div>
					<div class="text-sm text-gray-600">
						{$_('admin.events.fields.registrationDeadline')}
					</div>
					<div class="font-medium text-gray-900">
						{formatDate(event.registration_deadline)}
					</div>
				</div>

				<!-- Место проведения -->
				{#if event.location_de}
					<div class="md:col-span-2">
						<div class="text-sm text-gray-600">
							{$_('admin.events.fields.location')}
						</div>
						<div class="font-medium text-gray-900">
							{getLocalizedField(
								event.location_de,
								event.location_en,
								event.location_ru,
								event.location_uk
							)}
						</div>
					</div>
				{/if}

				<!-- Максимум участников -->
				<div>
					<div class="text-sm text-gray-600">
						{$_('admin.events.fields.maxParticipants')}
					</div>
					<div class="font-medium text-gray-900">
						{event.max_participants || $_('admin.events.unlimited')}
					</div>
				</div>

				<!-- Зарегистрировано -->
				<div>
					<div class="text-sm text-gray-600">{$_('admin.events.registered')}</div>
					<div class="font-medium text-gray-900">
						{registrations.length}
						{#if event.max_participants}
							/ {event.max_participants}
							{#if registrations.length >= event.max_participants}
								<span class="text-red-600">({$_('admin.events.full')})</span>
							{/if}
						{/if}
					</div>
				</div>
			</div>

			<!-- Описание -->
			{#if event.description_de}
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">
						{$_('admin.events.fields.description')}
					</h3>
					<div class="text-gray-700 whitespace-pre-wrap">
						{getLocalizedField(
							event.description_de,
							event.description_en,
							event.description_ru,
							event.description_uk
						)}
					</div>
				</div>
			{/if}

			<!-- Требования -->
			{#if event.requirements_de}
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">
						{$_('admin.events.fields.requirements')}
					</h3>
					<div class="text-gray-700 whitespace-pre-wrap">
						{getLocalizedField(
							event.requirements_de,
							event.requirements_en,
							event.requirements_ru,
							event.requirements_uk
						)}
					</div>
				</div>
			{/if}

			<!-- Ссылки на мессенджеры и QR-коды -->
			{#if event.telegram_link || event.whatsapp_link}
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-3">
						{$_('admin.events.messengerLinks')}
					</h3>

					<!-- Ошибка перегенерации -->
					{#if regenerateError}
						<div
							class="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md"
						>
							{regenerateError}
						</div>
					{/if}

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#if event.telegram_link}
							<div class="border border-gray-200 rounded-md p-4">
								<div class="flex items-center mb-2">
									<svg
										class="w-6 h-6 text-blue-500 mr-2"
										fill="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 4.038-1.359 5.356-.168.558-.5.744-.822.762-.698.064-1.229-.461-1.907-.903-1.061-.692-1.659-1.123-2.687-1.799-.188-.124-.332-.243-.437-.379a.963.963 0 01-.096-.806c.064-.21.342-.468.695-.753.925-.745 2.051-1.63 2.876-2.275.153-.119.18-.284.058-.397-.13-.122-.341-.073-.492.013-.946.537-2.492 1.577-3.462 2.194-.313.199-.596.296-.853.296-.227 0-.664-.07-1.311-.266-.852-.257-1.53-.393-1.472-.83.03-.227.347-.458.951-.69 2.51-1.065 4.184-1.767 5.023-2.107 2.392-.999 2.888-1.172 3.211-1.178.071-.001.231.016.334.1a.367.367 0 01.122.265c.002.036-.002.145-.013.21z"
										/>
									</svg>
									<span class="font-medium text-gray-900">Telegram</span>
								</div>
								<a
									href={event.telegram_link}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-blue-600 hover:underline break-all"
								>
									{event.telegram_link}
								</a>
								{#if event.qr_telegram_url}
									<div class="mt-3">
										<img
											src={event.qr_telegram_url}
											alt="Telegram QR"
											class="w-32 h-32 mx-auto border border-gray-200 rounded"
										/>
									</div>
								{/if}
								<!-- Кнопка перегенерации Telegram QR -->
								<div class="mt-3">
									<Button
										on:click={() => regenerateQr('telegram')}
										variant="secondary"
										size="sm"
										disabled={isRegeneratingTelegram}
										class="w-full"
									>
										{#if isRegeneratingTelegram}
											<svg
												class="animate-spin h-4 w-4 mr-2"
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
											{$_('admin.events.regeneratingQr')}
										{:else}
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
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											{$_('admin.events.regenerateQrTelegram')}
										{/if}
									</Button>
								</div>
							</div>
						{/if}

						{#if event.whatsapp_link}
							<div class="border border-gray-200 rounded-md p-4">
								<div class="flex items-center mb-2">
									<svg
										class="w-6 h-6 text-green-500 mr-2"
										fill="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
										/>
									</svg>
									<span class="font-medium text-gray-900">WhatsApp</span>
								</div>
								<a
									href={event.whatsapp_link}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-blue-600 hover:underline break-all"
								>
									{event.whatsapp_link}
								</a>
								{#if event.qr_whatsapp_url}
									<div class="mt-3">
										<img
											src={event.qr_whatsapp_url}
											alt="WhatsApp QR"
											class="w-32 h-32 mx-auto border border-gray-200 rounded"
										/>
									</div>
								{/if}
								<!-- Кнопка перегенерации WhatsApp QR -->
								<div class="mt-3">
									<Button
										on:click={() => regenerateQr('whatsapp')}
										variant="secondary"
										size="sm"
										disabled={isRegeneratingWhatsapp}
										class="w-full"
									>
										{#if isRegeneratingWhatsapp}
											<svg
												class="animate-spin h-4 w-4 mr-2"
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
											{$_('admin.events.regeneratingQr')}
										{:else}
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
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											{$_('admin.events.regenerateQrWhatsapp')}
										{/if}
									</Button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Список участников -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-lg font-semibold text-gray-900">
						{$_('admin.events.participants')} ({registrations.length})
					</h3>
					{#if registrations.length > 0}
						<Button on:click={exportToCSV} variant="secondary" size="sm">
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
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
							{$_('admin.events.exportCSV')}
						</Button>
					{/if}
				</div>

				{#if loading}
					<div class="text-center py-8">
						<svg
							class="animate-spin h-8 w-8 mx-auto text-blue-600"
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
						<p class="mt-2 text-gray-600">{$_('common.loading')}</p>
					</div>
				{:else if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
						{error}
					</div>
				{:else if registrations.length === 0}
					<div class="text-center py-8 text-gray-500">
						{$_('admin.events.noParticipants')}
					</div>
				{:else}
					<div class="border border-gray-200 rounded-md overflow-hidden">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{$_('admin.events.participantName')}
									</th>
									<th
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{$_('admin.events.participantEmail')}
									</th>
									<th
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{$_('admin.events.participantPhone')}
									</th>
									<th
										class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
									>
										{$_('admin.events.registeredAt')}
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each registrations as registration}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3 text-sm font-medium text-gray-900">
											{registration.user.first_name}
											{registration.user.last_name}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600">
											{registration.user.email}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600">
											{registration.user.phone || '—'}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600">
											{formatDate(registration.registered_at)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Информация об отмене (если мероприятие отменено) -->
			{#if event.status === 'cancelled' && event.cancellation_reason}
				<div class="bg-red-50 border border-red-200 rounded-md p-4">
					<h4 class="text-sm font-semibold text-red-800 mb-2">
						{$_('admin.events.cancelledReason')}
					</h4>
					<p class="text-sm text-red-700">{event.cancellation_reason}</p>
					{#if event.cancelled_at}
						<p class="text-xs text-red-600 mt-2">
							{$_('admin.events.cancelledAt', {
								values: { date: formatDate(event.cancelled_at) },
							})}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<svelte:fragment slot="actions">
			<Button on:click={handleEdit} variant="secondary">
				{$_('admin.events.edit')}
			</Button>
			<Button on:click={handleClose} variant="primary">
				{$_('common.close')}
			</Button>
		</svelte:fragment>
	</Modal>
{/if}
