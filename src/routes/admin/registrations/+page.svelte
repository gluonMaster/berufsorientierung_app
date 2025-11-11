<script lang="ts">
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { currentLanguage } from '$lib/stores/language';

	// Тип данных из +page.server.ts
	export let data: {
		registrations: Array<{
			id: number;
			user_id: number;
			event_id: number;
			additional_data: string | null;
			registered_at: string;
			cancelled_at: string | null;
			cancellation_reason: string | null;
			user_first_name: string;
			user_last_name: string;
			user_email: string;
			event_title_de: string;
			event_title_en: string | null;
			event_title_ru: string | null;
			event_title_uk: string | null;
			event_date: string;
			event_status: string;
		}>;
		events: Array<{
			id: number;
			title_de: string;
			title_en: string | null;
			title_ru: string | null;
			title_uk: string | null;
			date: string;
		}>;
		filters: {
			eventId: string;
			status: string;
			dateFrom: string;
			dateTo: string;
		};
		pagination: {
			page: number;
			limit: number;
			total: number;
			totalPages: number;
		};
	};

	let showModal = false;
	let selectedRegistration: any = null;
	let cancelling = false;
	let cancellationReason = '';

	// Получение заголовка события на текущем языке
	function getEventTitle(event: any, lang: string): string {
		const title = event[`title_${lang}`] || event.title_de;
		return title;
	}

	// Форматирование даты
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString($currentLanguage || 'de', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Обновление фильтров
	function updateFilters() {
		const params = new URLSearchParams();
		const eventIdSelect = document.getElementById('eventId') as HTMLSelectElement;
		const statusSelect = document.getElementById('status') as HTMLSelectElement;
		const dateFromInput = document.getElementById('dateFrom') as HTMLInputElement;
		const dateToInput = document.getElementById('dateTo') as HTMLInputElement;

		if (eventIdSelect.value !== 'all') params.set('eventId', eventIdSelect.value);
		if (statusSelect.value !== 'all') params.set('status', statusSelect.value);
		if (dateFromInput.value) params.set('dateFrom', dateFromInput.value);
		if (dateToInput.value) params.set('dateTo', dateToInput.value);

		goto(`/admin/registrations?${params.toString()}`);
	}

	// Просмотр регистрации
	function viewRegistration(registration: any) {
		selectedRegistration = registration;
		showModal = true;
	}

	// Закрытие модального окна
	function closeModal() {
		showModal = false;
		selectedRegistration = null;
		cancellationReason = '';
	}

	// Обработка клавиши Escape для закрытия модального окна
	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	// Отмена регистрации администратором
	async function cancelRegistration() {
		if (!selectedRegistration || !cancellationReason.trim()) {
			alert($_('admin.registrations.cancel_reason_required'));
			return;
		}

		cancelling = true;

		try {
			const response = await fetch(
				`/api/admin/registrations/${selectedRegistration.id}/cancel`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ reason: cancellationReason }),
				}
			);

			if (response.ok) {
				alert($_('admin.registrations.cancelled_success'));
				showModal = false;
				selectedRegistration = null;
				cancellationReason = '';
				// Инвалидация данных и перезагрузка страницы
				await invalidateAll();
				goto('/admin/registrations');
			} else {
				const error = await response.json();
				alert(error.message || $_('admin.registrations.cancel_error'));
			}
		} catch (err) {
			console.error('Cancel error:', err);
			alert($_('admin.registrations.cancel_error'));
		} finally {
			cancelling = false;
		}
	}

	// Экспорт в CSV
	function exportToCSV() {
		const params = new URLSearchParams($page.url.searchParams);
		// Добавляем текущий язык в параметры экспорта
		params.set('language', $currentLanguage);
		window.location.href = `/api/admin/registrations/export?${params.toString()}`;
	}

	// Пагинация
	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`/admin/registrations?${params.toString()}`);
	}
</script>

<svelte:head>
	<title>{$_('admin.registrations.title')} - {$_('admin.title')}</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">{$_('admin.registrations.title')}</h1>
		<p class="text-gray-600 mt-2">{$_('admin.registrations.description')}</p>
	</div>

	<!-- Фильтры -->
	<div class="bg-white rounded-lg shadow p-6 mb-6">
		<h2 class="text-lg font-semibold mb-4">{$_('admin.registrations.filters')}</h2>

		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<!-- Фильтр по мероприятию -->
			<div>
				<label for="eventId" class="block text-sm font-medium text-gray-700 mb-2">
					{$_('admin.registrations.filter_event')}
				</label>
				<select
					id="eventId"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
					value={data.filters.eventId}
					on:change={updateFilters}
				>
					<option value="all">{$_('admin.registrations.all_events')}</option>
					{#each data.events as event}
						<option value={event.id}>
							{getEventTitle(event, $currentLanguage)} - {new Date(
								event.date
							).toLocaleDateString()}
						</option>
					{/each}
				</select>
			</div>

			<!-- Фильтр по статусу -->
			<div>
				<label for="status" class="block text-sm font-medium text-gray-700 mb-2">
					{$_('admin.registrations.filter_status')}
				</label>
				<select
					id="status"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
					value={data.filters.status}
					on:change={updateFilters}
				>
					<option value="all">{$_('admin.registrations.status_all')}</option>
					<option value="active">{$_('admin.registrations.status_active')}</option>
					<option value="cancelled">{$_('admin.registrations.status_cancelled')}</option>
				</select>
			</div>

			<!-- Дата от -->
			<div>
				<label for="dateFrom" class="block text-sm font-medium text-gray-700 mb-2">
					{$_('admin.registrations.date_from')}
				</label>
				<input
					type="date"
					id="dateFrom"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
					value={data.filters.dateFrom}
					on:change={updateFilters}
				/>
			</div>

			<!-- Дата до -->
			<div>
				<label for="dateTo" class="block text-sm font-medium text-gray-700 mb-2">
					{$_('admin.registrations.date_to')}
				</label>
				<input
					type="date"
					id="dateTo"
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
					value={data.filters.dateTo}
					on:change={updateFilters}
				/>
			</div>
		</div>

		<div class="mt-4 flex justify-between items-center">
			<p class="text-sm text-gray-600">
				{$_('admin.registrations.total_found')}: <strong>{data.pagination.total}</strong>
			</p>
			<button
				on:click={exportToCSV}
				class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
			>
				{$_('admin.registrations.export_csv')}
			</button>
		</div>
	</div>

	<!-- Таблица регистраций -->
	{#if data.registrations.length > 0}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<!-- Десктопная таблица -->
			<div class="hidden md:block overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
							>
								{$_('admin.registrations.table.user')}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
							>
								{$_('admin.registrations.table.event')}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
							>
								{$_('admin.registrations.table.registered_at')}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
							>
								{$_('admin.registrations.table.status')}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
							>
								{$_('admin.registrations.table.actions')}
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each data.registrations as registration}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm font-medium text-gray-900">
										{registration.user_first_name}
										{registration.user_last_name}
									</div>
									<div class="text-sm text-gray-500">
										{registration.user_email}
									</div>
								</td>
								<td class="px-6 py-4">
									<div class="text-sm text-gray-900">
										{getEventTitle(
											{
												title_de: registration.event_title_de,
												title_en: registration.event_title_en,
												title_ru: registration.event_title_ru,
												title_uk: registration.event_title_uk,
											},
											$currentLanguage
										)}
									</div>
									<div class="text-sm text-gray-500">
										{new Date(registration.event_date).toLocaleDateString()}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{formatDate(registration.registered_at)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									{#if registration.cancelled_at}
										<span
											class="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded"
										>
											{$_('admin.registrations.status_cancelled')}
										</span>
									{:else}
										<span
											class="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded"
										>
											{$_('admin.registrations.status_active')}
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm">
									<button
										on:click={() => viewRegistration(registration)}
										class="text-blue-600 hover:text-blue-900 mr-3"
									>
										{$_('admin.registrations.view')}
									</button>
									{#if !registration.cancelled_at}
										<button
											on:click={() => viewRegistration(registration)}
											class="text-red-600 hover:text-red-900"
										>
											{$_('admin.registrations.cancel')}
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Мобильные карточки -->
			<div class="md:hidden divide-y divide-gray-200">
				{#each data.registrations as registration}
					<div class="p-4">
						<div class="mb-2">
							<span class="font-semibold text-gray-900">
								{registration.user_first_name}
								{registration.user_last_name}
							</span>
							{#if registration.cancelled_at}
								<span
									class="ml-2 px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded"
								>
									{$_('admin.registrations.status_cancelled')}
								</span>
							{:else}
								<span
									class="ml-2 px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded"
								>
									{$_('admin.registrations.status_active')}
								</span>
							{/if}
						</div>
						<div class="text-sm text-gray-600 mb-1">{registration.user_email}</div>
						<div class="text-sm text-gray-700 mb-1">
							{getEventTitle(
								{
									title_de: registration.event_title_de,
									title_en: registration.event_title_en,
									title_ru: registration.event_title_ru,
									title_uk: registration.event_title_uk,
								},
								$currentLanguage
							)}
						</div>
						<div class="text-sm text-gray-500 mb-3">
							{formatDate(registration.registered_at)}
						</div>
						<div class="flex gap-2">
							<button
								on:click={() => viewRegistration(registration)}
								class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
							>
								{$_('admin.registrations.view')}
							</button>
							{#if !registration.cancelled_at}
								<button
									on:click={() => viewRegistration(registration)}
									class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
								>
									{$_('admin.registrations.cancel')}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Пагинация -->
		{#if data.pagination.totalPages > 1}
			<div class="mt-6 flex justify-center">
				<nav class="flex gap-2">
					{#if data.pagination.page > 1}
						<button
							on:click={() => goToPage(data.pagination.page - 1)}
							class="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
						>
							{$_('admin.pagination.previous')}
						</button>
					{/if}

					{#each Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1) as pageNum}
						{#if pageNum === data.pagination.page}
							<button class="px-3 py-2 bg-blue-600 text-white rounded-md" disabled>
								{pageNum}
							</button>
						{:else if pageNum === 1 || pageNum === data.pagination.totalPages || Math.abs(pageNum - data.pagination.page) <= 2}
							<button
								on:click={() => goToPage(pageNum)}
								class="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
							>
								{pageNum}
							</button>
						{:else if Math.abs(pageNum - data.pagination.page) === 3}
							<span class="px-3 py-2">...</span>
						{/if}
					{/each}

					{#if data.pagination.page < data.pagination.totalPages}
						<button
							on:click={() => goToPage(data.pagination.page + 1)}
							class="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
						>
							{$_('admin.pagination.next')}
						</button>
					{/if}
				</nav>
			</div>
		{/if}
	{:else}
		<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
			{$_('admin.registrations.no_results')}
		</div>
	{/if}
</div>

<!-- Модальное окно просмотра/отмены -->
{#if showModal && selectedRegistration}
	<!-- Overlay для затемнения фона -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
		on:click={closeModal}
		on:keydown={handleModalKeydown}
	>
		<!-- Контейнер модального окна -->
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div
			class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
			role="document"
			on:click|stopPropagation
			on:keydown|stopPropagation
		>
			<h2 id="modal-title" class="text-2xl font-bold mb-4">
				{$_('admin.registrations.modal_title')}
			</h2>

			<div class="space-y-4">
				<!-- Информация о пользователе -->
				<div>
					<h3 class="font-semibold text-gray-700 mb-2">
						{$_('admin.registrations.user_info')}
					</h3>
					<p>
						<strong>{$_('admin.registrations.name')}:</strong>
						{selectedRegistration.user_first_name}
						{selectedRegistration.user_last_name}
					</p>
					<p>
						<strong>{$_('admin.registrations.email')}:</strong>
						{selectedRegistration.user_email}
					</p>
				</div>

				<!-- Информация о мероприятии -->
				<div>
					<h3 class="font-semibold text-gray-700 mb-2">
						{$_('admin.registrations.event_info')}
					</h3>
					<p>
						<strong>{$_('admin.registrations.event_title')}:</strong>
						{getEventTitle(
							{
								title_de: selectedRegistration.event_title_de,
								title_en: selectedRegistration.event_title_en,
								title_ru: selectedRegistration.event_title_ru,
								title_uk: selectedRegistration.event_title_uk,
							},
							$currentLanguage
						)}
					</p>
					<p>
						<strong>{$_('admin.registrations.event_date')}:</strong>
						{new Date(selectedRegistration.event_date).toLocaleDateString()}
					</p>
				</div>
				<!-- Информация о регистрации -->
				<div>
					<h3 class="font-semibold text-gray-700 mb-2">
						{$_('admin.registrations.registration_info')}
					</h3>
					<p>
						<strong>{$_('admin.registrations.registered_at')}:</strong>
						{formatDate(selectedRegistration.registered_at)}
					</p>
					<p>
						<strong>{$_('admin.registrations.status')}:</strong>
						{#if selectedRegistration.cancelled_at}
							<span class="text-red-600"
								>{$_('admin.registrations.status_cancelled')}</span
							>
							<br />
							<strong>{$_('admin.registrations.cancelled_at')}:</strong>
							{formatDate(selectedRegistration.cancelled_at)}
							<br />
							<strong>{$_('admin.registrations.cancellation_reason')}:</strong>
							{selectedRegistration.cancellation_reason}
						{:else}
							<span class="text-green-600"
								>{$_('admin.registrations.status_active')}</span
							>
						{/if}
					</p>
				</div>

				<!-- Дополнительные данные -->
				{#if selectedRegistration.additional_data}
					<div>
						<h3 class="font-semibold text-gray-700 mb-2">
							{$_('admin.registrations.additional_data')}
						</h3>
						<pre
							class="bg-gray-50 p-3 rounded text-sm overflow-x-auto">{selectedRegistration.additional_data}</pre>
					</div>
				{/if}

				<!-- Форма отмены (если регистрация активна) -->
				{#if !selectedRegistration.cancelled_at}
					<div class="border-t pt-4">
						<h3 class="font-semibold text-gray-700 mb-2">
							{$_('admin.registrations.cancel_registration')}
						</h3>
						<label for="cancellationReason" class="block text-sm text-gray-700 mb-2">
							{$_('admin.registrations.cancellation_reason_label')}
						</label>
						<textarea
							id="cancellationReason"
							bind:value={cancellationReason}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
							rows="3"
							placeholder={$_('admin.registrations.cancellation_reason_placeholder')}
						></textarea>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					on:click={closeModal}
					class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
				>
					{$_('admin.registrations.close')}
				</button>
				{#if !selectedRegistration.cancelled_at}
					<button
						on:click={cancelRegistration}
						disabled={cancelling || !cancellationReason.trim()}
						class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{cancelling
							? $_('admin.registrations.cancelling')
							: $_('admin.registrations.cancel_confirm')}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
