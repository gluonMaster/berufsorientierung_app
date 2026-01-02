<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import StarRating from '$lib/components/ui/StarRating.svelte';
	import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-svelte';

	export let data;

	// Форма отзыва
	let rating = 5;
	let comment = '';
	let isAnonymous = false;
	let displayName = '';

	// Состояние
	let isSubmitting = false;
	let submitted = false;

	// Toast уведомления
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'info' = 'info';
	let showToast = false;

	/**
	 * Получить название события в зависимости от локали
	 */
	function getEventTitle(): string {
		if (!data.event) return '';
		const loc = $locale || 'de';
		const titleKey = `title_${loc}` as keyof typeof data.event;
		return (data.event[titleKey] as string) || data.event.title_de || '';
	}

	/**
	 * Форматировать дату
	 */
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

	/**
	 * Отправить отзыв
	 */
	async function submitReview() {
		// Валидация
		if (comment.length < 10) {
			showNotification($_('reviews.form.commentTooShort'), 'error');
			return;
		}
		if (comment.length > 2000) {
			showNotification($_('reviews.form.commentTooLong'), 'error');
			return;
		}

		isSubmitting = true;

		try {
			const response = await fetch('/api/reviews/public', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					rating,
					comment,
					is_anonymous: isAnonymous,
					public_display_name:
						!isAnonymous && displayName.trim() ? displayName.trim() : undefined,
				}),
			});

			const result = await response.json();

			if (response.ok && result.success) {
				submitted = true;
				showNotification($_('reviews.form.submitSuccess'), 'success');
			} else {
				showNotification(result.error || $_('reviews.form.submitError'), 'error');
			}
		} catch (err) {
			console.error('Submit error:', err);
			showNotification($_('reviews.form.submitError'), 'error');
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Показать уведомление
	 */
	function showNotification(message: string, type: 'success' | 'error' | 'info') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}
</script>

<svelte:head>
	<title>{$_('reviews.public.title')}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
	<div class="w-full max-w-lg">
		<!-- Ошибка: недействительная ссылка -->
		{#if data.error === 'invalid_link'}
			<div class="bg-white rounded-xl shadow-lg p-6 text-center">
				<div
					class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center"
				>
					<XCircle size={32} class="text-red-600" />
				</div>
				<h1 class="text-xl font-bold text-gray-800 mb-2">
					{$_('reviews.public.invalidLink')}
				</h1>
				<p class="text-gray-600">{$_('reviews.public.invalidLinkDescription')}</p>
			</div>

			<!-- Ошибка: окно отзывов закрыто -->
		{:else if data.error === 'window_closed'}
			<div class="bg-white rounded-xl shadow-lg p-6 text-center">
				<div
					class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center"
				>
					<Clock size={32} class="text-amber-600" />
				</div>
				<h1 class="text-xl font-bold text-gray-800 mb-2">
					{$_('reviews.public.windowClosed')}
				</h1>
				<p class="text-gray-600 mb-4">{$_('reviews.public.windowClosedDescription')}</p>
				{#if data.event}
					<div class="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
						<p class="font-medium">{getEventTitle()}</p>
					</div>
				{/if}
			</div>

			<!-- Ошибка: нет даты окончания -->
		{:else if data.error === 'no_end_date'}
			<div class="bg-white rounded-xl shadow-lg p-6 text-center">
				<div
					class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center"
				>
					<AlertCircle size={32} class="text-amber-600" />
				</div>
				<h1 class="text-xl font-bold text-gray-800 mb-2">
					{$_('reviews.public.notAvailable')}
				</h1>
				<p class="text-gray-600">{$_('reviews.public.notAvailableDescription')}</p>
			</div>

			<!-- Отзыв успешно отправлен -->
		{:else if submitted}
			<div class="bg-white rounded-xl shadow-lg p-6 text-center">
				<div
					class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center"
				>
					<CheckCircle size={32} class="text-green-600" />
				</div>
				<h1 class="text-xl font-bold text-gray-800 mb-2">{$_('reviews.form.thankYou')}</h1>
				<p class="text-gray-600">{$_('reviews.form.pendingModeration')}</p>
			</div>

			<!-- Форма отзыва -->
		{:else if data.canReview}
			<div class="bg-white rounded-xl shadow-lg overflow-hidden">
				<!-- Заголовок -->
				<div class="bg-indigo-600 px-6 py-4 text-white">
					<h1 class="text-xl font-bold">{$_('reviews.public.title')}</h1>
					<p class="text-indigo-100 text-sm mt-1">{$_('reviews.public.subtitle')}</p>
				</div>

				<!-- Информация о событии -->
				<div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
					<p class="text-sm text-gray-500">{$_('reviews.form.event')}</p>
					<p class="font-semibold text-gray-800">{getEventTitle()}</p>
					{#if data.event?.date}
						<p class="text-sm text-gray-600">{formatDate(data.event.date)}</p>
					{/if}
				</div>

				<!-- Форма -->
				<form on:submit|preventDefault={submitReview} class="p-6 space-y-6">
					<!-- Рейтинг -->
					<div role="group" aria-labelledby="rating-label">
						<span
							id="rating-label"
							class="block text-sm font-medium text-gray-700 mb-2"
						>
							{$_('reviews.form.rating')} <span class="text-red-500">*</span>
						</span>
						<div class="flex items-center gap-4">
							<StarRating
								bind:value={rating}
								max={10}
								size="lg"
								ariaLabel={$_('reviews.form.rating')}
							/>
							<span class="text-lg font-semibold text-gray-700">{rating}/10</span>
						</div>
					</div>

					<!-- Комментарий -->
					<div>
						<label for="comment" class="block text-sm font-medium text-gray-700 mb-2">
							{$_('reviews.form.comment')} <span class="text-red-500">*</span>
						</label>
						<textarea
							id="comment"
							bind:value={comment}
							rows="4"
							minlength="10"
							maxlength="2000"
							required
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base"
							placeholder={$_('reviews.form.commentPlaceholder')}
						></textarea>
						<p class="text-xs text-gray-500 mt-1">
							{comment.length}/2000 {$_('reviews.form.characters')}
						</p>
					</div>

					<!-- Анонимность -->
					<div class="space-y-3">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={isAnonymous}
								class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
							/>
							<span class="text-sm text-gray-700">{$_('reviews.form.anonymous')}</span
							>
						</label>

						<!-- Имя для отображения (только если не анонимный) -->
						{#if !isAnonymous}
							<div class="ml-8">
								<label
									for="displayName"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									{$_('reviews.form.displayName')}
								</label>
								<input
									type="text"
									id="displayName"
									bind:value={displayName}
									maxlength="80"
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
									placeholder={$_('reviews.form.displayNamePlaceholder')}
								/>
								<p class="text-xs text-gray-500 mt-1">
									{$_('reviews.form.displayNameHelp')}
								</p>
							</div>
						{/if}
					</div>

					<!-- Кнопка отправки -->
					<Button
						type="submit"
						variant="primary"
						size="lg"
						loading={isSubmitting}
						disabled={isSubmitting || comment.length < 10}
						class="w-full"
					>
						{isSubmitting ? $_('common.processing') : $_('reviews.form.submit')}
					</Button>
				</form>
			</div>
		{:else}
			<div class="bg-white rounded-xl shadow-lg p-6 text-center">
				<div
					class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center"
				>
					<AlertCircle size={32} class="text-amber-600" />
				</div>
				<h1 class="text-xl font-bold text-gray-800 mb-2">
					{$_('reviews.public.notAvailable')}
				</h1>
				<p class="text-gray-600">{$_('reviews.public.notAvailableDescription')}</p>
			</div>
		{/if}
	</div>
</div>

<!-- Toast -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} on:close={() => (showToast = false)} />
{/if}
