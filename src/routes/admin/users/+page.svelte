<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import UserViewModal from '$lib/components/admin/UserViewModal.svelte';

	export let data;

	// Локальное состояние для поиска и фильтров
	let searchQuery = data.search || '';
	let selectedFilter = data.filter || 'all';

	// Модальные окна
	let showViewModal = false;
	let selectedUserId: number | null = null;

	// Toast уведомления
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';
	let showToast = false;

	// Состояние загрузки для действий
	let actionLoading: Record<number, boolean> = {};

	/**
	 * Применить фильтры - обновление URL и перезагрузка данных
	 */
	function applyFilters() {
		const params = new URLSearchParams();
		params.set('page', '1'); // Сброс на первую страницу при новом поиске/фильтре
		if (searchQuery.trim()) {
			params.set('search', searchQuery.trim());
		}
		if (selectedFilter !== 'all') {
			params.set('filter', selectedFilter);
		}
		goto(`?${params.toString()}`, { replaceState: true });
	}

	/**
	 * Сброс фильтров
	 */
	function resetFilters() {
		searchQuery = '';
		selectedFilter = 'all';
		goto('/admin/users', { replaceState: true });
	}

	/**
	 * Изменение страницы пагинации
	 */
	function changePage(newPage: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', newPage.toString());
		goto(`?${params.toString()}`, { replaceState: true });
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
		}).format(date);
	}

	/**
	 * Показать toast уведомление
	 */
	function showToastNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	/**
	 * Открыть модал просмотра пользователя
	 */
	function openViewModal(userId: number) {
		selectedUserId = userId;
		showViewModal = true;
	}

	/**
	 * Назначить пользователя администратором
	 */
	async function makeAdmin(userId: number) {
		if (!confirm($_('admin.usersPage.confirmMakeAdmin'))) {
			return;
		}

		actionLoading[userId] = true;

		try {
			const response = await fetch('/api/admin/users/make-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to make admin');
			}

			showToastNotification($_('admin.usersPage.actions.makeAdmin') + ' ✓', 'success');
			await invalidateAll();
		} catch (error: any) {
			console.error('[makeAdmin] Error:', error);
			showToastNotification(error.message || $_('errors.generic'), 'error');
		} finally {
			actionLoading[userId] = false;
		}
	}

	/**
	 * Удалить права администратора у пользователя
	 */
	async function removeAdmin(userId: number, isSuperadmin: boolean) {
		if (isSuperadmin) {
			showToastNotification($_('admin.usersPage.cannotRemoveSuperadmin'), 'error');
			return;
		}

		if (!confirm($_('admin.usersPage.confirmRemoveAdmin'))) {
			return;
		}

		actionLoading[userId] = true;

		try {
			const response = await fetch('/api/admin/users/remove-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to remove admin');
			}

			showToastNotification($_('admin.usersPage.actions.removeAdmin') + ' ✓', 'success');
			await invalidateAll();
		} catch (error: any) {
			console.error('[removeAdmin] Error:', error);
			showToastNotification(error.message || $_('errors.generic'), 'error');
		} finally {
			actionLoading[userId] = false;
		}
	}

	/**
	 * Экспорт данных пользователя
	 */
	function exportUserData(userId: number) {
		window.open(`/api/admin/users/${userId}/export`, '_blank');
	}

	/**
	 * Вычисление диапазона страниц для пагинации
	 */
	function getPageRange(current: number, total: number): number[] {
		const delta = 2; // Сколько страниц показывать слева и справа от текущей
		const range: number[] = [];
		const rangeWithDots: number[] = [];

		for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
			range.push(i);
		}

		if (current - delta > 2) {
			rangeWithDots.push(1, -1); // -1 означает "..."
		} else {
			rangeWithDots.push(1);
		}

		rangeWithDots.push(...range);

		if (current + delta < total - 1) {
			rangeWithDots.push(-1, total);
		} else if (total > 1) {
			rangeWithDots.push(total);
		}

		return rangeWithDots;
	}

	// Вычисляем общее количество страниц
	$: totalPages = Math.ceil(data.total / data.pageSize);
	$: pageRange = getPageRange(data.page, totalPages);
</script>

<!-- Header -->
<div class="mb-8">
	<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
		{$_('admin.usersPage.title')}
	</h1>
</div>

<!-- Поиск и фильтры -->
<div class="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
	<div class="flex flex-col gap-4 md:flex-row md:items-end">
		<!-- Поле поиска -->
		<div class="flex-1">
			<label
				for="search"
				class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				{$_('admin.usersPage.search')}
			</label>
			<input
				id="search"
				type="text"
				bind:value={searchQuery}
				on:keydown={(e) => e.key === 'Enter' && applyFilters()}
				placeholder={$_('admin.usersPage.search')}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			/>
		</div>

		<!-- Фильтр по роли/статусу -->
		<div class="w-full md:w-48">
			<label
				for="filter"
				class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				{$_('common.filter')}
			</label>
			<select
				id="filter"
				bind:value={selectedFilter}
				on:change={applyFilters}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			>
				<option value="all">{$_('admin.usersPage.filter.all')}</option>
				<option value="admins">{$_('admin.usersPage.filter.admins')}</option>
				<option value="users">{$_('admin.usersPage.filter.users')}</option>
				<option value="pending_deletion"
					>{$_('admin.usersPage.filter.pendingDeletion')}</option
				>
			</select>
		</div>

		<!-- Кнопки действий -->
		<div class="flex gap-2">
			<Button variant="secondary" on:click={resetFilters}>
				{$_('admin.usersPage.reset')}
			</Button>
			<Button on:click={applyFilters}>{$_('common.search')}</Button>
		</div>
	</div>
</div>

<!-- Таблица пользователей (Desktop) -->
<div class="mb-6 hidden overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 md:block">
	<div class="overflow-x-auto">
		<table class="w-full">
			<thead class="bg-gray-50 dark:bg-gray-700">
				<tr>
					<th
						class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.name')}
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.email')}
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.registered')}
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.registrations')}
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.role')}
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.status')}
					</th>
					<th
						class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
					>
						{$_('admin.usersPage.table.actions')}
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each data.users as user}
					<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
						<!-- Имя -->
						<td class="whitespace-nowrap px-6 py-4">
							<div class="text-sm font-medium text-gray-900 dark:text-white">
								{user.first_name}
								{user.last_name}
							</div>
						</td>

						<!-- Email -->
						<td class="whitespace-nowrap px-6 py-4">
							<div class="text-sm text-gray-700 dark:text-gray-300">{user.email}</div>
						</td>

						<!-- Дата регистрации -->
						<td class="whitespace-nowrap px-6 py-4">
							<div class="text-sm text-gray-700 dark:text-gray-300">
								{formatDate(user.created_at)}
							</div>
						</td>

						<!-- Количество регистраций -->
						<td class="whitespace-nowrap px-6 py-4">
							<div class="text-sm font-medium text-gray-900 dark:text-white">
								{user.registrations_count}
							</div>
						</td>

						<!-- Роль -->
						<td class="whitespace-nowrap px-6 py-4">
							{#if user.is_superadmin}
								<span
									class="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800"
								>
									{$_('admin.usersPage.role.superadmin')}
								</span>
							{:else if user.is_admin}
								<span
									class="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800"
								>
									{$_('admin.usersPage.role.admin')}
								</span>
							{:else}
								<span
									class="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800"
								>
									{$_('admin.usersPage.role.user')}
								</span>
							{/if}
						</td>

						<!-- Статус -->
						<td class="whitespace-nowrap px-6 py-4">
							{#if user.has_pending_deletion}
								<span
									class="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800"
								>
									{$_('admin.usersPage.status.pendingDeletion')}
								</span>
							{:else if user.is_blocked}
								<span
									class="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"
								>
									{$_('admin.usersPage.status.blocked')}
								</span>
							{:else}
								<span
									class="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
								>
									{$_('admin.usersPage.status.active')}
								</span>
							{/if}
						</td>

						<!-- Действия -->
						<td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
							<div class="flex items-center justify-end gap-2">
								<!-- Просмотр -->
								<button
									on:click={() => openViewModal(user.id)}
									class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
									title={$_('admin.usersPage.actions.view')}
								>
									{$_('admin.usersPage.actions.view')}
								</button>

								<!-- Управление правами админа -->
								{#if !user.is_superadmin && user.id !== data.currentUser.id}
									{#if user.is_admin}
										<button
											on:click={() =>
												removeAdmin(user.id, user.is_superadmin)}
											disabled={actionLoading[user.id]}
											class="text-orange-600 hover:text-orange-900 disabled:opacity-50 dark:text-orange-400 dark:hover:text-orange-300"
											title={$_('admin.usersPage.actions.removeAdmin')}
										>
											{$_('admin.usersPage.actions.removeAdmin')}
										</button>
									{:else}
										<button
											on:click={() => makeAdmin(user.id)}
											disabled={actionLoading[user.id]}
											class="text-green-600 hover:text-green-900 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
											title={$_('admin.usersPage.actions.makeAdmin')}
										>
											{$_('admin.usersPage.actions.makeAdmin')}
										</button>
									{/if}
								{/if}

								<!-- Экспорт данных -->
								<button
									on:click={() => exportUserData(user.id)}
									class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
									title={$_('admin.usersPage.actions.export')}
								>
									{$_('admin.usersPage.actions.export')}
								</button>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td
							colspan="7"
							class="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
						>
							{$_('admin.usersPage.noResults')}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<!-- Карточки пользователей (Mobile) -->
<div class="mb-6 space-y-4 md:hidden">
	{#each data.users as user}
		<div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
			<!-- Имя и роль -->
			<div class="mb-3 flex items-start justify-between">
				<div>
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">
						{user.first_name}
						{user.last_name}
					</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
				</div>
				<div>
					{#if user.is_superadmin}
						<span
							class="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800"
						>
							{$_('admin.usersPage.role.superadmin')}
						</span>
					{:else if user.is_admin}
						<span
							class="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800"
						>
							{$_('admin.usersPage.role.admin')}
						</span>
					{:else}
						<span
							class="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800"
						>
							{$_('admin.usersPage.role.user')}
						</span>
					{/if}
				</div>
			</div>

			<!-- Информация -->
			<div class="mb-3 space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-gray-600 dark:text-gray-400"
						>{$_('admin.usersPage.table.registered')}:</span
					>
					<span class="font-medium text-gray-900 dark:text-white"
						>{formatDate(user.created_at)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-600 dark:text-gray-400"
						>{$_('admin.usersPage.table.registrations')}:</span
					>
					<span class="font-medium text-gray-900 dark:text-white"
						>{user.registrations_count}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-600 dark:text-gray-400"
						>{$_('admin.usersPage.table.status')}:</span
					>
					{#if user.has_pending_deletion}
						<span
							class="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800"
						>
							{$_('admin.usersPage.status.pendingDeletion')}
						</span>
					{:else if user.is_blocked}
						<span
							class="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"
						>
							{$_('admin.usersPage.status.blocked')}
						</span>
					{:else}
						<span
							class="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
						>
							{$_('admin.usersPage.status.active')}
						</span>
					{/if}
				</div>
			</div>

			<!-- Действия -->
			<div class="flex flex-wrap gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
				<Button size="sm" variant="secondary" on:click={() => openViewModal(user.id)}>
					{$_('admin.usersPage.actions.view')}
				</Button>

				{#if !user.is_superadmin && user.id !== data.currentUser.id}
					{#if user.is_admin}
						<Button
							size="sm"
							variant="secondary"
							on:click={() => removeAdmin(user.id, user.is_superadmin)}
							disabled={actionLoading[user.id]}
						>
							{$_('admin.usersPage.actions.removeAdmin')}
						</Button>
					{:else}
						<Button
							size="sm"
							variant="primary"
							on:click={() => makeAdmin(user.id)}
							disabled={actionLoading[user.id]}
						>
							{$_('admin.usersPage.actions.makeAdmin')}
						</Button>
					{/if}
				{/if}

				<Button size="sm" variant="secondary" on:click={() => exportUserData(user.id)}>
					{$_('admin.usersPage.actions.export')}
				</Button>
			</div>
		</div>
	{:else}
		<div
			class="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400"
		>
			{$_('admin.usersPage.noResults')}
		</div>
	{/each}
</div>

<!-- Пагинация -->
{#if totalPages > 1}
	<div
		class="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow dark:bg-gray-800 sm:px-6"
	>
		<div class="flex flex-1 justify-between sm:hidden">
			<!-- Mobile пагинация -->
			<Button
				variant="secondary"
				disabled={data.page === 1}
				on:click={() => changePage(data.page - 1)}
			>
				{$_('common.back')}
			</Button>
			<span class="flex items-center text-sm text-gray-700 dark:text-gray-300">
				{$_('admin.usersPage.pagination.page')}
				{data.page} / {totalPages}
			</span>
			<Button
				variant="secondary"
				disabled={data.page === totalPages}
				on:click={() => changePage(data.page + 1)}
			>
				{$_('common.next')}
			</Button>
		</div>

		<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
			<!-- Информация о показанных записях -->
			<div>
				<p class="text-sm text-gray-700 dark:text-gray-300">
					{$_('admin.usersPage.pagination.showing')}
					<span class="font-medium">{(data.page - 1) * data.pageSize + 1}</span>
					{$_('admin.usersPage.pagination.to')}
					<span class="font-medium"
						>{Math.min(data.page * data.pageSize, data.total)}</span
					>
					{$_('admin.usersPage.pagination.total')}
					<span class="font-medium">{data.total}</span>
				</p>
			</div>

			<!-- Кнопки страниц -->
			<div>
				<nav class="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
					{#each pageRange as pageNum}
						{#if pageNum === -1}
							<span
								class="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
							>
								...
							</span>
						{:else}
							{@const isActive = pageNum === data.page}
							<button
								on:click={() => changePage(pageNum)}
								class="relative inline-flex items-center border px-4 py-2 text-sm font-medium transition-colors"
								class:z-10={isActive}
								class:border-blue-500={isActive}
								class:bg-blue-50={isActive}
								class:text-blue-600={isActive}
								class:dark:border-blue-400={isActive}
								class:dark:bg-blue-900={isActive}
								class:dark:text-blue-200={isActive}
								class:border-gray-300={!isActive}
								class:bg-white={!isActive}
								class:text-gray-700={!isActive}
								class:hover:bg-gray-50={!isActive}
								class:dark:border-gray-600={!isActive}
								class:dark:bg-gray-800={!isActive}
								class:dark:text-gray-300={!isActive}
								class:dark:hover:bg-gray-700={!isActive}
							>
								{pageNum}
							</button>
						{/if}
					{/each}
				</nav>
			</div>
		</div>
	</div>
{/if}

<!-- Модальное окно просмотра пользователя -->
{#if showViewModal && selectedUserId !== null}
	<UserViewModal userId={selectedUserId} bind:show={showViewModal} />
{/if}

<!-- Toast уведомления -->
{#if showToast}
	<Toast
		message={toastMessage}
		type={toastType}
		onClose={() => {
			showToast = false;
		}}
	/>
{/if}
