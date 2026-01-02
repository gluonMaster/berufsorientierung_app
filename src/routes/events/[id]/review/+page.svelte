<script lang="ts">
	/**
	 * Review Form Page
	 * Страница для оставления отзыва на мероприятие (авторизованный пользователь)
	 *
	 * Mobile-first design
	 */
	import { _, locale } from 'svelte-i18n';
	import Button from '$lib/components/ui/Button.svelte';
	import StarRating from '$lib/components/ui/StarRating.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { ReviewStatus } from '$lib/types/review';

	// Данные из +page.server.ts
	export let data: {
		user: { id: number; first_name: string; preferred_language: string };
		event: {
			id: number;
			title_de: string;
			title_en: string | null;
			title_ru: string | null;
			title_uk: string | null;
			date: string;
			end_date: string;
			location_de: string;
			location_en: string | null;
			location_ru: string | null;
			location_uk: string | null;
		};
		reviewWindow: {
			start: string;
			end: string;
		};
		existingReview: {
			id: number;
			rating: number;
			comment: string;
			status: ReviewStatus;
			created_at: string;
		} | null;
		preferredLang: string;
	};

	// Состояние формы
	let rating: number = 0;
	let comment: string = '';
	let isAnonymous: boolean = false;
	let isSubmitting: boolean = false;
	let isSuccess: boolean = false;

	// Toast уведомления
	let toastMessage = '';
	let toastType: 'success' | 'error' = 'success';
	let showToast = false;

	// Вычисляемые значения
	$: canSubmit = rating > 0 && comment.trim().length >= 10;
	$: commentLength = comment.trim().length;

	// Получаем название события на нужном языке
	function getEventTitle(): string {
		const lang = $locale || 'de';
		const key = `title_${lang}` as keyof typeof data.event;
		const title = data.event[key];

		if (title && typeof title === 'string' && title.trim()) {
			return title;
		}

		return data.event.title_de;
	}

	// Получаем локацию на нужном языке
	function getEventLocation(): string {
		const lang = $locale || 'de';
		const key = `location_${lang}` as keyof typeof data.event;
		const location = data.event[key];

		if (location && typeof location === 'string' && location.trim()) {
			return location;
		}

		return data.event.location_de;
	}

	// Форматирование даты
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString($locale || 'de', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Статус отзыва
	function getStatusBadge(status: ReviewStatus): { label: string; color: string } {
		switch (status) {
			case 'pending':
				return {
					label: $_('profile.reviews.status.pending'),
					color: 'bg-yellow-100 text-yellow-800',
				};
			case 'approved':
				return {
					label: $_('profile.reviews.status.approved'),
					color: 'bg-green-100 text-green-800',
				};
			case 'rejected':
				return {
					label: $_('profile.reviews.status.rejected'),
					color: 'bg-red-100 text-red-800',
				};
			default:
				return { label: status, color: 'bg-gray-100 text-gray-800' };
		}
	}

	// Отправка формы
	async function handleSubmit() {
		if (!canSubmit || isSubmitting) return;

		isSubmitting = true;

		try {
			const response = await fetch('/api/reviews/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: data.event.id,
					rating,
					comment: comment.trim(),
					is_anonymous: isAnonymous,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				isSuccess = true;
				toastMessage = $_('reviews.form.success');
				toastType = 'success';
				showToast = true;
			} else {
				// Обработка ошибок
				let errorMessage = $_('errors.genericError');

				if (result.code === 'REVIEW_EXISTS') {
					errorMessage = $_('reviews.form.alreadySubmitted');
				} else if (result.code === 'REVIEW_WINDOW_CLOSED') {
					errorMessage = $_('reviews.window.notAvailable');
				} else if (result.error) {
					errorMessage = result.error;
				}

				toastMessage = errorMessage;
				toastType = 'error';
				showToast = true;
			}
		} catch (error) {
			console.error('Error submitting review:', error);
			toastMessage = $_('errors.genericError');
			toastType = 'error';
			showToast = true;
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{$_('reviews.form.title')} - {getEventTitle()}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-2xl">
	<!-- Навигация назад -->
	<a href="/profile" class="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
		<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10 19l-7-7m0 0l7-7m-7 7h18"
			/>
		</svg>
		{$_('common.back')}
	</a>

	<div class="bg-white rounded-lg shadow-md p-4 sm:p-6">
		<h1 class="text-xl sm:text-2xl font-bold mb-4">{$_('reviews.form.title')}</h1>

		<!-- Информация о мероприятии -->
		<div class="bg-gray-50 rounded-lg p-4 mb-6">
			<h2 class="font-semibold text-lg mb-2">{getEventTitle()}</h2>
			<p class="text-sm text-gray-600 mb-1">
				<span class="font-medium">{$_('events.date')}:</span>
				{formatDate(data.event.date)}
			</p>
			<p class="text-sm text-gray-600">
				<span class="font-medium">{$_('events.location')}:</span>
				{getEventLocation()}
			</p>
		</div>

		{#if data.existingReview}
			<!-- Отзыв уже отправлен -->
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
				<div class="flex items-start">
					<svg
						class="w-5 h-5 text-blue-500 mr-3 mt-0.5 shrink-0"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
							clip-rule="evenodd"
						/>
					</svg>
					<div class="flex-1">
						<h3 class="font-semibold text-blue-800 mb-2">
							{$_('reviews.form.alreadySubmitted')}
						</h3>
						<p class="text-sm text-blue-700 mb-3">
							{$_('reviews.form.submittedOn', {
								values: { date: formatDate(data.existingReview.created_at) },
							})}
						</p>
						<div class="flex items-center gap-3 flex-wrap">
							<span
								class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadge(
									data.existingReview.status
								).color}"
							>
								{getStatusBadge(data.existingReview.status).label}
							</span>
							<span class="text-sm text-gray-600">
								{$_('reviews.form.rating')}: {data.existingReview.rating}/10
							</span>
						</div>
					</div>
				</div>
			</div>

			<div class="text-center">
				<a href="/profile">
					<Button variant="secondary">{$_('profile.myProfile')}</Button>
				</a>
			</div>
		{:else if isSuccess}
			<!-- Успешная отправка -->
			<div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
				<svg
					class="w-16 h-16 text-green-500 mx-auto mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h2 class="text-xl font-semibold text-green-800 mb-2">
					{$_('reviews.form.success')}
				</h2>
				<p class="text-green-700 mb-6">
					{$_('reviews.form.successDescription')}
				</p>
				<a href="/profile">
					<Button>{$_('profile.myProfile')}</Button>
				</a>
			</div>
		{:else}
			<!-- Форма отзыва -->
			<form on:submit|preventDefault={handleSubmit} class="space-y-6">
				<!-- Рейтинг -->
				<div>
					<span id="rating-label" class="block text-sm font-medium text-gray-700 mb-2">
						{$_('reviews.form.rating')}
						<span class="text-red-500" aria-hidden="true">*</span>
					</span>
					<div aria-labelledby="rating-label">
						<StarRating bind:value={rating} max={10} size="md" ariaLabel={$_('reviews.form.rating')} />
					</div>
					{#if rating === 0}
						<p class="text-sm text-gray-500 mt-1">
							{$_('reviews.form.ratingHint')}
						</p>
					{/if}
				</div>

				<!-- Комментарий -->
				<div>
					<label for="comment" class="block text-sm font-medium text-gray-700 mb-2">
						{$_('reviews.form.comment')}
						<span class="text-red-500">*</span>
					</label>
					<textarea
						id="comment"
						bind:value={comment}
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[120px] text-base"
						placeholder={$_('reviews.form.commentPlaceholder')}
						maxlength="2000"
						required
					></textarea>
					<div class="flex justify-between items-center mt-1">
						<p class="text-sm {commentLength < 10 ? 'text-red-500' : 'text-gray-500'}">
							{#if commentLength < 10}
								{$_('validation.minLength', { values: { min: 10 } })}
							{:else}
								{commentLength}/2000
							{/if}
						</p>
					</div>
				</div>

				<!-- Анонимность -->
				<div class="flex items-start">
					<div class="flex items-center h-5">
						<input
							id="anonymous"
							type="checkbox"
							bind:checked={isAnonymous}
							class="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
					</div>
					<div class="ml-3">
						<label for="anonymous" class="text-sm font-medium text-gray-700">
							{$_('reviews.form.anonymous')}
						</label>
						<p class="text-sm text-gray-500">
							{$_('reviews.form.anonymousHint')}
						</p>
					</div>
				</div>

				<!-- Кнопка отправки -->
				<div class="pt-4">
					<Button type="submit" fullWidth disabled={!canSubmit} loading={isSubmitting}>
						{$_('reviews.form.submit')}
					</Button>
				</div>
			</form>
		{/if}
	</div>
</div>

<!-- Toast уведомления -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={() => (showToast = false)} />
{/if}
