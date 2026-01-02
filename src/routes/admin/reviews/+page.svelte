<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import StarRating from '$lib/components/ui/StarRating.svelte';
	import { Check, X, Eye, User, Globe, Link, Copy, CheckCircle } from 'lucide-svelte';
	import type { ReviewForAdminList } from '$lib/types/review';

	export let data;

	// Состояние модалок
	let showApproveAllModal = false;
	let showRejectAllModal = false;
	let showCommentModal = false;
	let selectedReview: ReviewForAdminList | null = null;

	// Toast уведомления
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';
	let showToast = false;

	// Состояние загрузки
	let actionLoading: Record<number, boolean> = {};
	let bulkLoading = false;

	// Генератор публичных ссылок
	let selectedEventId: number | null = null;
	let linkExpiresAt = '';
	let generatingLink = false;
	let generatedLink: string | null = null;
	let linkCopied = false;

	/**
	 * Получить название события в зависимости от локали
	 */
	function getEventTitle(review: ReviewForAdminList): string {
		return review.event_title_de || $_('admin.reviews.untitledEvent');
	}

	/**
	 * Получить название события для dropdown
	 */
	function getEventOptionTitle(event: {
		title_de?: string | null;
		title_en?: string | null;
		title_ru?: string | null;
		title_uk?: string | null;
		date?: string | null;
	}): string {
		const loc = $locale || 'de';
		const titleKey = `title_${loc}` as keyof typeof event;
		const title =
			(event[titleKey] as string) || event.title_de || $_('admin.reviews.untitledEvent');
		const dateStr = event.date ? formatDateShort(event.date) : '';
		return dateStr ? `${title} (${dateStr})` : title;
	}

	/**
	 * Получить информацию об авторе
	 */
	function getAuthorInfo(review: ReviewForAdminList): {
		name: string;
		email: string | null;
		type: 'user' | 'public';
	} {
		if (review.user_id !== null) {
			const name =
				[review.author_first_name, review.author_last_name].filter(Boolean).join(' ') ||
				'Unknown';
			return {
				name,
				email: review.author_email,
				type: 'user',
			};
		} else {
			return {
				name: review.public_display_name || $_('admin.reviews.author.anonymous'),
				email: null,
				type: 'public',
			};
		}
	}

	/**
	 * Обрезать текст до определённой длины
	 */
	function truncateText(text: string, maxLength: number = 200): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}

	/**
	 * Форматировать дату
	 */
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString($locale || 'de', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	/**
	 * Форматировать дату (короткий формат)
	 */
	function formatDateShort(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString($locale || 'de', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	/**
	 * Генерировать публичную ссылку
	 */
	async function generatePublicLink() {
		if (!selectedEventId || !linkExpiresAt) {
			showNotification($_('admin.reviews.links.selectEventAndDate'), 'error');
			return;
		}

		generatingLink = true;
		generatedLink = null;

		try {
			const response = await fetch('/api/admin/reviews/links/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: selectedEventId,
					expires_at: linkExpiresAt,
				}),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				// Генерируем полный URL
				const baseUrl = window.location.origin;
				generatedLink = `${baseUrl}/reviews/public/${result.token}`;
				showNotification($_('admin.reviews.links.generated'), 'success');
			} else {
				showNotification(result.error || $_('admin.reviews.links.generateError'), 'error');
			}
		} catch (err) {
			console.error('Generate link error:', err);
			showNotification($_('admin.reviews.links.generateError'), 'error');
		} finally {
			generatingLink = false;
		}
	}

	/**
	 * Копировать ссылку в буфер обмена
	 */
	async function copyLink() {
		if (!generatedLink) return;

		try {
			await navigator.clipboard.writeText(generatedLink);
			linkCopied = true;
			showNotification($_('admin.reviews.links.copied'), 'success');
			setTimeout(() => {
				linkCopied = false;
			}, 2000);
		} catch (err) {
			console.error('Copy error:', err);
			showNotification($_('admin.reviews.links.copyError'), 'error');
		}
	}

	/**
	 * Одобрить отзыв
	 */
	async function approveReview(reviewId: number) {
		actionLoading[reviewId] = true;
		try {
			const response = await fetch('/api/admin/reviews/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ review_ids: [reviewId] }),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				showNotification($_('admin.reviews.approveSuccess'), 'success');
				await invalidateAll();
			} else {
				showNotification(result.error || $_('admin.reviews.approveError'), 'error');
			}
		} catch (err) {
			console.error('Approve error:', err);
			showNotification($_('admin.reviews.approveError'), 'error');
		} finally {
			actionLoading[reviewId] = false;
		}
	}

	/**
	 * Отклонить отзыв
	 */
	async function rejectReview(reviewId: number) {
		actionLoading[reviewId] = true;
		try {
			const response = await fetch('/api/admin/reviews/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ review_ids: [reviewId] }),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				showNotification($_('admin.reviews.rejectSuccess'), 'success');
				await invalidateAll();
			} else {
				showNotification(result.error || $_('admin.reviews.rejectError'), 'error');
			}
		} catch (err) {
			console.error('Reject error:', err);
			showNotification($_('admin.reviews.rejectError'), 'error');
		} finally {
			actionLoading[reviewId] = false;
		}
	}

	/**
	 * Одобрить все pending отзывы
	 */
	async function approveAllPending() {
		bulkLoading = true;
		try {
			const response = await fetch('/api/admin/reviews/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ all_pending: true }),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				showNotification(
					$_('admin.reviews.approveAllSuccess', { values: { count: result.updated } }),
					'success'
				);
				await invalidateAll();
			} else {
				showNotification(result.error || $_('admin.reviews.approveError'), 'error');
			}
		} catch (err) {
			console.error('Approve all error:', err);
			showNotification($_('admin.reviews.approveError'), 'error');
		} finally {
			bulkLoading = false;
			showApproveAllModal = false;
		}
	}

	/**
	 * Отклонить все pending отзывы
	 */
	async function rejectAllPending() {
		bulkLoading = true;
		try {
			const response = await fetch('/api/admin/reviews/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ all_pending: true }),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				showNotification(
					$_('admin.reviews.rejectAllSuccess', { values: { count: result.updated } }),
					'success'
				);
				await invalidateAll();
			} else {
				showNotification(result.error || $_('admin.reviews.rejectError'), 'error');
			}
		} catch (err) {
			console.error('Reject all error:', err);
			showNotification($_('admin.reviews.rejectError'), 'error');
		} finally {
			bulkLoading = false;
			showRejectAllModal = false;
		}
	}

	/**
	 * Показать полный комментарий
	 */
	function showFullComment(review: ReviewForAdminList) {
		selectedReview = review;
		showCommentModal = true;
	}

	/**
	 * Показать уведомление
	 */
	function showNotification(message: string, type: 'success' | 'error' | 'info') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	/**
	 * Изменить статус фильтра
	 */
	function changeStatus(newStatus: string) {
		const params = new URLSearchParams();
		params.set('status', newStatus);
		params.set('page', '1');
		goto(`?${params.toString()}`, { replaceState: true });
	}

	/**
	 * Изменить страницу
	 */
	function changePage(newPage: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', newPage.toString());
		goto(`?${params.toString()}`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>{$_('admin.reviews.title')} | {$_('admin.title')}</title>
</svelte:head>

<div class="p-4 md:p-6">
	<!-- Заголовок и массовые действия -->
	<header class="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-2xl font-bold text-gray-800">{$_('admin.reviews.title')}</h1>

		{#if data.status === 'pending' && data.total > 0}
			<div class="flex gap-2">
				<Button
					variant="primary"
					size="sm"
					on:click={() => (showApproveAllModal = true)}
					disabled={bulkLoading}
				>
					<Check size={16} />
					<span class="hidden sm:inline">{$_('admin.reviews.approveAll')}</span>
					<span class="sm:hidden">{$_('admin.reviews.approveAllShort')}</span>
				</Button>
				<Button
					variant="danger"
					size="sm"
					on:click={() => (showRejectAllModal = true)}
					disabled={bulkLoading}
				>
					<X size={16} />
					<span class="hidden sm:inline">{$_('admin.reviews.rejectAll')}</span>
					<span class="sm:hidden">{$_('admin.reviews.rejectAllShort')}</span>
				</Button>
			</div>
		{/if}
	</header>

	<!-- Фильтры по статусу -->
	<div class="flex gap-1 mb-6 overflow-x-auto pb-2">
		<button
			class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap {data.status ===
			'pending'
				? 'bg-indigo-100 text-indigo-700'
				: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
			on:click={() => changeStatus('pending')}
		>
			{$_('admin.reviews.status.pending')}
			{#if data.status === 'pending'}
				<span class="ml-1 text-xs">({data.total})</span>
			{/if}
		</button>
		<button
			class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap {data.status ===
			'approved'
				? 'bg-indigo-100 text-indigo-700'
				: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
			on:click={() => changeStatus('approved')}
		>
			{$_('admin.reviews.status.approved')}
		</button>
		<button
			class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap {data.status ===
			'rejected'
				? 'bg-indigo-100 text-indigo-700'
				: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
			on:click={() => changeStatus('rejected')}
		>
			{$_('admin.reviews.status.rejected')}
		</button>
	</div>

	<!-- Генератор публичных ссылок -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
		<h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
			<Link size={20} class="text-indigo-600" />
			{$_('admin.reviews.links.title')}
		</h2>

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Выбор события -->
			<div class="sm:col-span-2 lg:col-span-1">
				<label for="linkEvent" class="block text-sm font-medium text-gray-700 mb-1">
					{$_('admin.reviews.links.event')}
				</label>
				<select
					id="linkEvent"
					bind:value={selectedEventId}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
				>
					<option value={null}>{$_('form.select')}</option>
					{#each data.events || [] as event (event.id)}
						<option value={event.id}>{getEventOptionTitle(event)}</option>
					{/each}
				</select>
			</div>

			<!-- Срок действия -->
			<div>
				<label for="linkExpires" class="block text-sm font-medium text-gray-700 mb-1">
					{$_('admin.reviews.links.expiresAt')}
				</label>
				<input
					type="datetime-local"
					id="linkExpires"
					bind:value={linkExpiresAt}
					min={new Date().toISOString().slice(0, 16)}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
				/>
			</div>

			<!-- Кнопка генерации -->
			<div class="flex items-end">
				<Button
					variant="primary"
					on:click={generatePublicLink}
					loading={generatingLink}
					disabled={generatingLink || !selectedEventId || !linkExpiresAt}
					class="w-full sm:w-auto"
				>
					<Link size={16} />
					{$_('admin.reviews.links.generate')}
				</Button>
			</div>
		</div>

		<!-- Сгенерированная ссылка -->
		{#if generatedLink}
			<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
				<p class="text-sm font-medium text-green-800 mb-2">
					{$_('admin.reviews.links.generated')}
				</p>
				<div class="flex flex-col sm:flex-row gap-2">
					<input
						type="text"
						readonly
						value={generatedLink}
						class="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm font-mono"
					/>
					<Button
						variant={linkCopied ? 'primary' : 'secondary'}
						size="sm"
						on:click={copyLink}
						class="flex items-center justify-center gap-2"
					>
						{#if linkCopied}
							<CheckCircle size={16} />
							{$_('admin.reviews.links.copied')}
						{:else}
							<Copy size={16} />
							{$_('admin.reviews.links.copy')}
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Список отзывов -->
	{#if data.reviews.length === 0}
		<div class="text-center py-12 text-gray-500">
			<p>{$_('admin.reviews.empty')}</p>
		</div>
	{:else}
		<!-- Mobile: карточки -->
		<div class="space-y-4 md:hidden">
			{#each data.reviews as review (review.id)}
				{@const author = getAuthorInfo(review)}
				<article class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
					<div class="flex flex-col gap-2 mb-3">
						<div class="flex-1">
							<h3 class="font-semibold text-gray-800 text-sm">
								{getEventTitle(review)}
							</h3>
							<time class="text-xs text-gray-500"
								>{formatDate(review.created_at)}</time
							>
						</div>
						<div class="flex items-center gap-2">
							<StarRating
								value={review.rating}
								max={10}
								readonly
								size="sm"
								ariaLabel={$_('admin.reviews.table.rating')}
							/>
							<span class="text-sm font-medium text-gray-700">{review.rating}/10</span
							>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2 mb-3">
						{#if author.type === 'user'}
							<span
								class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
							>
								<User size={14} />
								{author.name}
							</span>
							{#if author.email}
								<span class="text-xs text-gray-500">{author.email}</span>
							{/if}
						{:else}
							<span
								class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"
							>
								<Globe size={14} />
								{author.name}
							</span>
						{/if}
						{#if review.is_anonymous}
							<span
								class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
								>{$_('admin.reviews.anonymous')}</span
							>
						{/if}
					</div>

					<div class="mb-4">
						<p class="text-sm text-gray-700 leading-relaxed">
							{truncateText(review.comment)}
						</p>
						{#if review.comment.length > 200}
							<button
								class="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800"
								on:click={() => showFullComment(review)}
							>
								<Eye size={14} />
								{$_('admin.reviews.showFull')}
							</button>
						{/if}
					</div>

					{#if data.status === 'pending'}
						<div class="flex gap-2 pt-3 border-t border-gray-100">
							<Button
								variant="primary"
								size="sm"
								on:click={() => approveReview(review.id)}
								disabled={actionLoading[review.id]}
								loading={actionLoading[review.id]}
							>
								<Check size={16} />
								{$_('admin.reviews.approve')}
							</Button>
							<Button
								variant="danger"
								size="sm"
								on:click={() => rejectReview(review.id)}
								disabled={actionLoading[review.id]}
								loading={actionLoading[review.id]}
							>
								<X size={16} />
								{$_('admin.reviews.reject')}
							</Button>
						</div>
					{/if}
				</article>
			{/each}
		</div>

		<!-- Desktop: таблица -->
		<div
			class="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200 hidden md:block"
		>
			<table class="w-full">
				<thead>
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b"
							>{$_('admin.reviews.table.event')}</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b"
							>{$_('admin.reviews.table.author')}</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b"
							>{$_('admin.reviews.table.rating')}</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b"
							>{$_('admin.reviews.table.comment')}</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b"
							>{$_('admin.reviews.table.date')}</th
						>
						{#if data.status === 'pending'}
							<th
								class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b"
								>{$_('admin.reviews.table.actions')}</th
							>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.reviews as review (review.id)}
						{@const author = getAuthorInfo(review)}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-4 border-b border-gray-100">
								<div class="font-medium text-gray-800">{getEventTitle(review)}</div>
							</td>
							<td class="px-4 py-4 border-b border-gray-100">
								<div class="flex flex-col gap-1">
									{#if author.type === 'user'}
										<span
											class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 w-fit"
										>
											<User size={12} />
											{author.name}
										</span>
										{#if author.email}
											<span class="text-xs text-gray-500">{author.email}</span
											>
										{/if}
									{:else}
										<span
											class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 w-fit"
										>
											<Globe size={12} />
											{author.name}
										</span>
									{/if}
									{#if review.is_anonymous}
										<span
											class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 w-fit"
											>{$_('admin.reviews.anonymous')}</span
										>
									{/if}
								</div>
							</td>
							<td class="px-4 py-4 border-b border-gray-100">
								<div class="flex items-center gap-2">
									<StarRating
										value={review.rating}
										max={10}
										readonly
										size="sm"
										ariaLabel={$_('admin.reviews.table.rating')}
									/>
									<span class="text-sm font-medium text-gray-700"
										>{review.rating}/10</span
									>
								</div>
							</td>
							<td class="px-4 py-4 border-b border-gray-100">
								<p class="text-sm text-gray-700 max-w-xs">
									{truncateText(review.comment, 150)}
								</p>
								{#if review.comment.length > 150}
									<button
										class="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800"
										on:click={() => showFullComment(review)}
									>
										<Eye size={14} />
										{$_('admin.reviews.showFull')}
									</button>
								{/if}
							</td>
							<td
								class="px-4 py-4 border-b border-gray-100 text-sm text-gray-500 whitespace-nowrap"
							>
								{formatDate(review.created_at)}
							</td>
							{#if data.status === 'pending'}
								<td class="px-4 py-4 border-b border-gray-100">
									<div class="flex gap-2">
										<button
											class="p-2 rounded-lg transition-colors text-green-600 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
											on:click={() => approveReview(review.id)}
											disabled={actionLoading[review.id]}
											title={$_('admin.reviews.approve')}
										>
											<Check size={18} />
										</button>
										<button
											class="p-2 rounded-lg transition-colors text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
											on:click={() => rejectReview(review.id)}
											disabled={actionLoading[review.id]}
											title={$_('admin.reviews.reject')}
										>
											<X size={18} />
										</button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Пагинация -->
	{#if data.totalPages > 1}
		<nav
			class="flex items-center justify-center gap-4 mt-6"
			aria-label={$_('admin.pagination.label')}
		>
			<button
				class="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
				disabled={data.page <= 1}
				on:click={() => changePage(data.page - 1)}
			>
				{$_('admin.pagination.previous')}
			</button>
			<span class="text-sm text-gray-600">
				{$_('admin.pagination.page')}
				{data.page} / {data.totalPages}
			</span>
			<button
				class="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
				disabled={data.page >= data.totalPages}
				on:click={() => changePage(data.page + 1)}
			>
				{$_('admin.pagination.next')}
			</button>
		</nav>
	{/if}
</div>

<!-- Modal: Подтверждение Approve All -->
{#if showApproveAllModal}
	<Modal
		title={$_('admin.reviews.confirmApproveAllTitle')}
		isOpen={showApproveAllModal}
		onClose={() => (showApproveAllModal = false)}
		size="sm"
	>
		<p class="text-gray-700 mb-6">
			{$_('admin.reviews.confirmApproveAllMessage', { values: { count: data.total } })}
		</p>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" on:click={() => (showApproveAllModal = false)}>
				{$_('common.cancel')}
			</Button>
			<Button variant="primary" on:click={approveAllPending} loading={bulkLoading}>
				{$_('admin.reviews.approveAll')}
			</Button>
		</div>
	</Modal>
{/if}

<!-- Modal: Подтверждение Reject All -->
{#if showRejectAllModal}
	<Modal
		title={$_('admin.reviews.confirmRejectAllTitle')}
		isOpen={showRejectAllModal}
		onClose={() => (showRejectAllModal = false)}
		size="sm"
	>
		<p class="text-gray-700 mb-6">
			{$_('admin.reviews.confirmRejectAllMessage', { values: { count: data.total } })}
		</p>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" on:click={() => (showRejectAllModal = false)}>
				{$_('common.cancel')}
			</Button>
			<Button variant="danger" on:click={rejectAllPending} loading={bulkLoading}>
				{$_('admin.reviews.rejectAll')}
			</Button>
		</div>
	</Modal>
{/if}

<!-- Modal: Полный комментарий -->
{#if showCommentModal && selectedReview}
	<Modal
		title={$_('admin.reviews.fullComment')}
		isOpen={showCommentModal}
		onClose={() => {
			showCommentModal = false;
			selectedReview = null;
		}}
		size="md"
	>
		<div class="space-y-4">
			<div class="space-y-2 pb-4 border-b border-gray-200">
				<div class="flex items-center gap-2 text-sm">
					<strong>{$_('admin.reviews.table.event')}:</strong>
					{getEventTitle(selectedReview)}
				</div>
				<div class="flex items-center gap-2 text-sm">
					<strong>{$_('admin.reviews.table.rating')}:</strong>
					<StarRating
						value={selectedReview.rating}
						max={10}
						readonly
						size="sm"
						ariaLabel={$_('admin.reviews.table.rating')}
					/>
					<span>{selectedReview.rating}/10</span>
				</div>
			</div>
			<div class="text-gray-700 leading-relaxed whitespace-pre-wrap">
				{selectedReview.comment}
			</div>
		</div>
	</Modal>
{/if}

<!-- Toast -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} on:close={() => (showToast = false)} />
{/if}
