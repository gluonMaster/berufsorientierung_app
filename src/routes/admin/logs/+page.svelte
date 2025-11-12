<script lang="ts">
	/**
	 * Admin Activity Logs Page
	 * Страница логов активности для админки
	 */

	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import type { ActivityLogActionType } from '$lib/types';

	export let data: any;

	const { logs, total, currentPage, totalPages, filters } = data;

	// Локальные состояния фильтров
	let userIdFilter = filters.userId?.toString() || '';
	let actionTypeFilter = filters.actionType || '';
	let dateFromFilter = filters.dateFrom || '';
	let dateToFilter = filters.dateTo || '';

	// Все возможные типы действий для dropdown
	const actionTypes: ActivityLogActionType[] = [
		'user_register',
		'user_login',
		'user_login_failed',
		'user_logout',
		'user_update_profile',
		'user_delete_request',
		'user_deleted',
		'profile_deleted_immediate',
		'profile_deletion_scheduled',
		'profile_deletion_failed',
		'event_create',
		'event_update',
		'event_delete',
		'event_publish',
		'event_cancel',
		'event_export',
		'event_import',
		'registration_create',
		'registration_cancel',
		'admin_add',
		'admin_remove',
		'admin_export_user_data',
		'bulk_email_sent',
	];

	/**
	 * Применить фильтры
	 */
	function applyFilters() {
		const params = new URLSearchParams();

		if (userIdFilter) params.set('userId', userIdFilter);
		if (actionTypeFilter) params.set('actionType', actionTypeFilter);
		if (dateFromFilter) params.set('dateFrom', dateFromFilter);
		if (dateToFilter) params.set('dateTo', dateToFilter);

		// Сброс на первую страницу при изменении фильтров
		goto(`/admin/logs?${params.toString()}`);
	}

	/**
	 * Сбросить все фильтры
	 */
	function resetFilters() {
		userIdFilter = '';
		actionTypeFilter = '';
		dateFromFilter = '';
		dateToFilter = '';
		goto('/admin/logs');
	}

	/**
	 * Перейти на страницу
	 */
	function goToPage(page: number) {
		const params = new URLSearchParams();

		if (filters.userId) params.set('userId', filters.userId.toString());
		if (filters.actionType) params.set('actionType', filters.actionType);
		if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
		if (filters.dateTo) params.set('dateTo', filters.dateTo);
		params.set('page', page.toString());

		goto(`/admin/logs?${params.toString()}`);
	}

	/**
	 * Форматирование даты и времени
	 */
	function formatDateTime(timestamp: string): string {
		const date = new Date(timestamp);
		return date.toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	/**
	 * Получить перевод типа действия
	 */
	function translateAction(actionType: string): string {
		return $_(`admin.logsPage.actions.${actionType}`);
	}

	/**
	 * Экспорт логов в CSV
	 */
	function exportToCSV() {
		// Формируем CSV данные (только текущая страница)
		const headers = [
			$_('admin.logsPage.timestamp'),
			$_('admin.logsPage.userId'),
			$_('admin.logsPage.userEmail'),
			$_('admin.logsPage.userName'),
			$_('admin.logsPage.action'),
			$_('admin.logsPage.details'),
			$_('admin.logsPage.ipAddress'),
		];

		const rows = logs.map((log: any) => [
			formatDateTime(log.timestamp),
			log.user_id?.toString() || '',
			log.user_email || '',
			log.user_full_name || '',
			translateAction(log.action_type),
			log.details || '',
			log.ip_address || '',
		]);

		// Объединяем в CSV строку
		const csvContent = [
			headers.join(','),
			...rows.map((row: any[]) =>
				row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(',')
			),
		].join('\n');

		// Создаём Blob и скачиваем
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		link.setAttribute('href', url);
		link.setAttribute(
			'download',
			`activity_logs_page_${new Date().toISOString().split('T')[0]}.csv`
		);
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	/**
	 * Экспорт всех логов с учетом текущих фильтров
	 */
	function exportAllToCSV() {
		// Формируем URL с текущими фильтрами
		const params = new URLSearchParams();
		if (userIdFilter) params.set('userId', userIdFilter);
		if (actionTypeFilter) params.set('actionType', actionTypeFilter);
		if (dateFromFilter) params.set('dateFrom', dateFromFilter);
		if (dateToFilter) params.set('dateTo', dateToFilter);

		// Перенаправляем на API endpoint
		const exportUrl = `/api/admin/logs/export?${params.toString()}`;
		window.location.href = exportUrl;
	}

	/**
	 * Получить цвет для типа действия (для badge)
	 */
	function getActionColor(actionType: string): string {
		if (
			actionType.startsWith('user_login_failed') ||
			actionType.includes('delete') ||
			actionType.includes('cancel')
		) {
			return 'bg-red-100 text-red-800';
		}
		if (
			actionType.startsWith('user_register') ||
			actionType.startsWith('event_create') ||
			actionType.startsWith('registration_create')
		) {
			return 'bg-green-100 text-green-800';
		}
		if (actionType.includes('update') || actionType.includes('publish')) {
			return 'bg-blue-100 text-blue-800';
		}
		if (actionType.includes('admin')) {
			return 'bg-purple-100 text-purple-800';
		}
		return 'bg-gray-100 text-gray-800';
	}
</script>

<svelte:head>
	<title>{$_('admin.logsPage.title')} - Berufsorientierung</title>
</svelte:head>

<div class="space-y-6">
	<!-- Заголовок -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">{$_('admin.logsPage.title')}</h1>
			<p class="mt-2 text-gray-600">
				{$_('admin.logsPage.description')} ({total}
				{$_('admin.logsPage.entries')})
			</p>
		</div>
		<div class="flex flex-col gap-2 sm:flex-row">
			<button
				on:click={exportToCSV}
				class="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-blue-600 hover:bg-blue-50"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				{$_('admin.logsPage.exportCurrentPage')}
			</button>
			<button
				on:click={exportAllToCSV}
				class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/>
				</svg>
				{$_('admin.logsPage.exportAll')}
			</button>
		</div>
	</div>

	<!-- Фильтры -->
	<div class="rounded-lg bg-white p-6 shadow">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">{$_('admin.logsPage.filters')}</h2>
		<form on:submit|preventDefault={applyFilters} class="space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<!-- User ID фильтр -->
				<div>
					<label for="userId" class="block text-sm font-medium text-gray-700">
						{$_('admin.logsPage.filterUserId')}
					</label>
					<input
						id="userId"
						type="number"
						bind:value={userIdFilter}
						placeholder={$_('admin.logsPage.filterUserIdPlaceholder')}
						class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<!-- Тип действия фильтр -->
				<div>
					<label for="actionType" class="block text-sm font-medium text-gray-700">
						{$_('admin.logsPage.filterActionType')}
					</label>
					<select
						id="actionType"
						bind:value={actionTypeFilter}
						class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					>
						<option value="">{$_('admin.logsPage.allActions')}</option>
						{#each actionTypes as actionType}
							<option value={actionType}>{translateAction(actionType)}</option>
						{/each}
					</select>
				</div>

				<!-- Дата от -->
				<div>
					<label for="dateFrom" class="block text-sm font-medium text-gray-700">
						{$_('admin.logsPage.filterDateFrom')}
					</label>
					<input
						id="dateFrom"
						type="date"
						bind:value={dateFromFilter}
						class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>

				<!-- Дата до -->
				<div>
					<label for="dateTo" class="block text-sm font-medium text-gray-700">
						{$_('admin.logsPage.filterDateTo')}
					</label>
					<input
						id="dateTo"
						type="date"
						bind:value={dateToFilter}
						class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>
			</div>

			<!-- Кнопки фильтров -->
			<div class="flex gap-2">
				<button
					type="submit"
					class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					{$_('admin.logsPage.applyFilters')}
				</button>
				<button
					type="button"
					on:click={resetFilters}
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
				>
					{$_('admin.logsPage.resetFilters')}
				</button>
			</div>
		</form>
	</div>

	<!-- Таблица логов (Desktop) -->
	<div class="hidden overflow-hidden rounded-lg bg-white shadow md:block">
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.logsPage.timestamp')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.logsPage.user')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.logsPage.action')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.logsPage.details')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.logsPage.ipAddress')}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each logs as log}
						<tr class="hover:bg-gray-50">
							<td class="whitespace-nowrap px-6 py-4">
								<div class="text-sm text-gray-900">
									{formatDateTime(log.timestamp)}
								</div>
							</td>
							<td class="px-6 py-4">
								{#if log.user_email}
									<div class="text-sm font-medium text-gray-900">
										{log.user_full_name || 'N/A'}
									</div>
									<div class="text-sm text-gray-500">{log.user_email}</div>
								{:else}
									<span class="text-sm text-gray-400"
										>{$_('admin.logsPage.systemAction')}</span
									>
								{/if}
							</td>
							<td class="px-6 py-4">
								<span
									class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getActionColor(
										log.action_type
									)}"
								>
									{translateAction(log.action_type)}
								</span>
							</td>
							<td class="px-6 py-4">
								{#if log.details}
									<div
										class="max-w-xs truncate text-sm text-gray-600"
										title={log.details}
									>
										{log.details}
									</div>
								{:else}
									<span class="text-sm text-gray-400">—</span>
								{/if}
							</td>
							<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
								{log.ip_address || '—'}
							</td>
						</tr>
					{/each}

					{#if logs.length === 0}
						<tr>
							<td colspan="5" class="px-6 py-8 text-center text-gray-500">
								{$_('admin.logsPage.noLogs')}
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Карточки логов (Mobile) -->
	<div class="space-y-4 md:hidden">
		{#each logs as log}
			<div class="rounded-lg bg-white p-4 shadow">
				<div class="mb-2 flex items-start justify-between">
					<span
						class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getActionColor(
							log.action_type
						)}"
					>
						{translateAction(log.action_type)}
					</span>
					<span class="text-xs text-gray-500">{formatDateTime(log.timestamp)}</span>
				</div>

				{#if log.user_email}
					<div class="mb-2">
						<div class="text-sm font-medium text-gray-900">
							{log.user_full_name || 'N/A'}
						</div>
						<div class="text-xs text-gray-500">{log.user_email}</div>
					</div>
				{:else}
					<div class="mb-2 text-sm text-gray-400">
						{$_('admin.logsPage.systemAction')}
					</div>
				{/if}

				{#if log.details}
					<div class="mb-2 text-sm text-gray-600">{log.details}</div>
				{/if}

				{#if log.ip_address}
					<div class="text-xs text-gray-500">IP: {log.ip_address}</div>
				{/if}
			</div>
		{/each}

		{#if logs.length === 0}
			<div class="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
				{$_('admin.logsPage.noLogs')}
			</div>
		{/if}
	</div>

	<!-- Пагинация -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow sm:px-6">
			<div class="flex flex-1 justify-between sm:hidden">
				<button
					on:click={() => goToPage(currentPage - 1)}
					disabled={currentPage === 1}
					class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{$_('admin.logsPage.previous')}
				</button>
				<button
					on:click={() => goToPage(currentPage + 1)}
					disabled={currentPage === totalPages}
					class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{$_('admin.logsPage.next')}
				</button>
			</div>

			<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-gray-700">
						{$_('admin.logsPage.showing')}
						<span class="font-medium">{(currentPage - 1) * 50 + 1}</span>
						-
						<span class="font-medium">{Math.min(currentPage * 50, total)}</span>
						{$_('admin.logsPage.of')}
						<span class="font-medium">{total}</span>
						{$_('admin.logsPage.entries')}
					</p>
				</div>
				<div>
					<nav
						class="inline-flex -space-x-px rounded-md shadow-sm"
						aria-label="Pagination"
					>
						<button
							on:click={() => goToPage(currentPage - 1)}
							disabled={currentPage === 1}
							class="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<span class="sr-only">{$_('admin.logsPage.previous')}</span>
							<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>

						{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							if (totalPages <= 5) return i + 1;
							if (currentPage <= 3) return i + 1;
							if (currentPage >= totalPages - 2) return totalPages - 4 + i;
							return currentPage - 2 + i;
						}) as page}
							<button
								on:click={() => goToPage(page)}
								class="relative inline-flex items-center border px-4 py-2 text-sm font-medium"
								class:z-10={currentPage === page}
								class:border-blue-500={currentPage === page}
								class:bg-blue-50={currentPage === page}
								class:text-blue-600={currentPage === page}
								class:border-gray-300={currentPage !== page}
								class:bg-white={currentPage !== page}
								class:text-gray-700={currentPage !== page}
								class:hover:bg-gray-50={currentPage !== page}
							>
								{page}
							</button>
						{/each}

						<button
							on:click={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages}
							class="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<span class="sr-only">{$_('admin.logsPage.next')}</span>
							<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</nav>
				</div>
			</div>
		</div>
	{/if}
</div>
