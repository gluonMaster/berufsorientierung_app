<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	// Props
	export let show: boolean = true;
	export let userId: number;

	const dispatch = createEventDispatcher();

	// Данные пользователя
	let user: any = null;
	let registrations: any[] = [];
	let activityLog: any[] = [];
	let loading = true;
	let error = '';

	// Преобразуем show в isOpen для компонента Modal
	$: isOpen = show;

	/**
	 * Загрузить данные пользователя при открытии
	 */
	onMount(async () => {
		await loadUserData();
	});

	/**
	 * Загрузить полные данные пользователя
	 */
	async function loadUserData() {
		loading = true;
		error = '';

		try {
			// Получаем основные данные пользователя
			const userResponse = await fetch(`/api/admin/users/${userId}`);
			if (!userResponse.ok) {
				throw new Error('Не удалось загрузить данные пользователя');
			}
			const userData = await userResponse.json();
			user = userData.user;

			// Получаем регистрации пользователя
			const registrationsResponse = await fetch(`/api/admin/users/${userId}/registrations`);
			if (registrationsResponse.ok) {
				const registrationsData = await registrationsResponse.json();
				registrations = registrationsData.registrations || [];
			}

			// Получаем историю активности
			const activityResponse = await fetch(`/api/admin/users/${userId}/activity`);
			if (activityResponse.ok) {
				const activityData = await activityResponse.json();
				activityLog = activityData.activity || [];
			}
		} catch (err: any) {
			console.error('Failed to load user data:', err);
			error = err.message || 'Не удалось загрузить данные пользователя';
		} finally {
			loading = false;
		}
	}

	/**
	 * Форматирование даты
	 */
	function formatDate(dateString: string): string {
		if (!dateString) return '-';
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
	 * Форматирование даты без времени
	 */
	function formatDateShort(dateString: string): string {
		if (!dateString) return '-';
		const date = new Date(dateString);
		return new Intl.DateTimeFormat($locale || 'de', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(date);
	}

	/**
	 * Закрыть модал
	 */
	function handleClose() {
		show = false;
		dispatch('close');
	}

	/**
	 * Экспорт данных пользователя
	 */
	function exportUserData() {
		window.open(`/api/admin/users/${userId}/export`, '_blank');
	}
</script>

<Modal {isOpen} onClose={handleClose} size="lg" title={$_('admin.usersPage.actions.view')}>
	<div class="px-6 py-4">
		{#if loading}
			<!-- Loading состояние -->
			<div class="flex items-center justify-center py-12">
				<div class="text-center">
					<div
						class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500"
					></div>
					<p class="mt-4 text-gray-600 dark:text-gray-400">{$_('common.loading')}</p>
				</div>
			</div>
		{:else if error}
			<!-- Ошибка -->
			<div class="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
				<p class="text-red-800 dark:text-red-200">{error}</p>
			</div>
		{:else if user}
			<!-- Содержимое модала -->
			<div class="space-y-6">
				<!-- Личные данные -->
				<section>
					<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
						{$_('form.firstName')} / {$_('form.lastName')}
					</h3>
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.firstName')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">{user.first_name}</p>
						</div>
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.lastName')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">{user.last_name}</p>
						</div>
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.email')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">{user.email}</p>
						</div>
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.birthDate')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">
								{formatDateShort(user.birth_date)}
							</p>
						</div>
					</div>
				</section>

				<!-- Контактная информация -->
				<section>
					<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
						{$_('form.phone')}
					</h3>
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.phone')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">{user.phone}</p>
						</div>
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.whatsapp')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">{user.whatsapp || '-'}</p>
						</div>
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.telegram')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">{user.telegram || '-'}</p>
						</div>
					</div>
				</section>

				<!-- Адрес -->
				<section>
					<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
						{$_('form.address')}
					</h3>
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.addressStreet')} / {$_('form.addressNumber')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">
								{user.address_street}
								{user.address_number}
							</p>
						</div>
						<div>
							<span
								class="block text-sm font-medium text-gray-600 dark:text-gray-400"
							>
								{$_('form.addressZip')} / {$_('form.addressCity')}
							</span>
							<p class="mt-1 text-gray-900 dark:text-white">
								{user.address_zip}
								{user.address_city}
							</p>
						</div>
					</div>
				</section>

				<!-- Регистрации на мероприятия -->
				<section>
					<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
						{$_('admin.usersPage.table.registrations')} ({registrations.length})
					</h3>
					{#if registrations.length > 0}
						<div
							class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
						>
							<table class="w-full">
								<thead class="bg-gray-50 dark:bg-gray-800">
									<tr>
										<th
											class="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300"
										>
											{$_('events.eventName')}
										</th>
										<th
											class="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300"
										>
											{$_('events.date')}
										</th>
										<th
											class="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300"
										>
											{$_('admin.usersPage.table.status')}
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
									{#each registrations as registration}
										<tr>
											<td
												class="px-4 py-2 text-sm text-gray-900 dark:text-white"
											>
												{registration.event_title || '-'}
											</td>
											<td
												class="px-4 py-2 text-sm text-gray-900 dark:text-white"
											>
												{formatDate(registration.event_date)}
											</td>
											<td class="px-4 py-2">
												{#if registration.cancelled_at}
													<span
														class="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"
													>
														Отменена
													</span>
												{:else}
													<span
														class="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
													>
														Активна
													</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="text-gray-600 dark:text-gray-400">Нет регистраций</p>
					{/if}
				</section>

				<!-- История активности (последние 10 записей) -->
				<section>
					<h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
						{$_('admin.recentActivity')} (последние 10)
					</h3>
					{#if activityLog.length > 0}
						<div class="space-y-2">
							{#each activityLog.slice(0, 10) as activity}
								<div
									class="flex items-start justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
								>
									<div class="flex-1">
										<p
											class="text-sm font-medium text-gray-900 dark:text-white"
										>
											{activity.action_type}
										</p>
										{#if activity.details}
											<p class="text-xs text-gray-600 dark:text-gray-400">
												{activity.details}
											</p>
										{/if}
									</div>
									<div class="ml-4 text-right">
										<p class="text-xs text-gray-600 dark:text-gray-400">
											{formatDate(activity.timestamp)}
										</p>
										{#if activity.ip_address}
											<p class="text-xs text-gray-500 dark:text-gray-500">
												{activity.ip_address}
											</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-gray-600 dark:text-gray-400">Нет записей активности</p>
					{/if}
				</section>
			</div>

			<!-- Footer с кнопками -->
			<div
				class="mt-6 flex justify-between border-t border-gray-200 pt-4 dark:border-gray-700"
			>
				<Button variant="secondary" on:click={exportUserData}>
					{$_('admin.usersPage.actions.export')}
				</Button>
				<Button on:click={handleClose}>{$_('common.close')}</Button>
			</div>
		{/if}
	</div>
</Modal>
