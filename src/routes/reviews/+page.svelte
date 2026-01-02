<script lang="ts">
	/**
	 * Страница отзывов
	 *
	 * Отображает полную ленту одобренных отзывов с пагинацией
	 * Mobile-first дизайн
	 */

	import { _ } from 'svelte-i18n';
	import StarRating from '$lib/components/ui/StarRating.svelte';
	import type { ReviewsPageData } from './+page.server';

	// Получаем данные из +page.server.ts
	let { data } = $props<{ data: ReviewsPageData }>();

	/**
	 * Форматирует дату отзыва для отображения
	 */
	function formatReviewDate(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
		} catch {
			return dateStr;
		}
	}

	/**
	 * Получает отображаемое имя автора отзыва
	 */
	function getReviewAuthorName(review: { display_name: string | null }): string {
		if (!review.display_name) {
			return $_('reviews.author.anonymous');
		}
		return review.display_name;
	}

	/**
	 * Генерирует массив номеров страниц для отображения в пагинации
	 */
	function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			if (currentPage <= 3) {
				for (let i = 1; i <= 4; i++) pages.push(i);
				pages.push('...');
				pages.push(totalPages);
			} else if (currentPage >= totalPages - 2) {
				pages.push(1);
				pages.push('...');
				for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
			} else {
				pages.push(1);
				pages.push('...');
				pages.push(currentPage - 1);
				pages.push(currentPage);
				pages.push(currentPage + 1);
				pages.push('...');
				pages.push(totalPages);
			}
		}

		return pages;
	}

	const pageNumbers = $derived(getPageNumbers(data.page, data.totalPages));
</script>

<svelte:head>
	<title>{$_('reviews.page.title')} | Berufsorientierung</title>
	<meta name="description" content={$_('reviews.page.description')} />
</svelte:head>

<main class="min-h-screen bg-gray-50 py-8 sm:py-12">
	<div class="container mx-auto px-4">
		<!-- Заголовок страницы -->
		<div class="mb-8 sm:mb-12">
			<h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
				{$_('reviews.page.heading')}
			</h1>
			<p class="text-gray-600 text-lg">
				{$_('reviews.page.description')}
			</p>
		</div>

		<!-- Список отзывов или Empty state -->
		{#if data.reviews.length > 0}
			<!-- Grid отзывов (mobile-first) -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
				{#each data.reviews as review (review.id)}
					<article
						class="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6 flex flex-col hover:shadow-md transition-shadow"
					>
						<!-- Рейтинг -->
						<div class="mb-4">
							<StarRating
								value={review.rating}
								max={10}
								readonly={true}
								size="sm"
								ariaLabel={$_('reviews.form.rating')}
							/>
						</div>

						<!-- Комментарий -->
						<p class="text-gray-700 leading-relaxed mb-4 flex-grow">
							{review.comment}
						</p>

						<!-- Мета-информация -->
						<div class="mt-auto pt-4 border-t border-gray-100">
							<!-- Автор -->
							<p class="font-medium text-gray-900">
								{getReviewAuthorName(review)}
							</p>

							<!-- Событие -->
							<p class="text-sm text-gray-600 mt-1" title={review.event_title_de}>
								{review.event_title_de}
							</p>

							<!-- Дата -->
							<p class="text-sm text-gray-400 mt-1">
								{formatReviewDate(review.created_at)}
							</p>
						</div>
					</article>
				{/each}
			</div>

			<!-- Пагинация -->
			{#if data.totalPages > 1}
				<nav
					class="mt-8 sm:mt-12 flex flex-wrap justify-center items-center gap-2"
					aria-label={$_('admin.pagination.label')}
				>
					<!-- Кнопка "Назад" -->
					{#if data.page > 1}
						<a
							href={`?page=${data.page - 1}`}
							class="pagination-arrow pagination-prev px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
							aria-label={$_('admin.pagination.previous')}
						>
							←
						</a>
					{/if}

					<!-- Номера страниц -->
					{#each pageNumbers as pageNum}
						{#if pageNum === '...'}
							<span class="px-3 py-2 text-gray-400">...</span>
						{:else}
							<a
								href={`?page=${pageNum}`}
								class="min-w-[44px] px-3 py-2 text-sm font-medium text-center rounded-md transition-colors
									{data.page === pageNum
									? 'bg-blue-600 text-white'
									: 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}"
								aria-current={data.page === pageNum ? 'page' : undefined}
							>
								{pageNum}
							</a>
						{/if}
					{/each}

					<!-- Кнопка "Вперед" -->
					{#if data.page < data.totalPages}
						<a
							href={`?page=${data.page + 1}`}
							class="pagination-arrow pagination-next px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
							aria-label={$_('admin.pagination.next')}
						>
							→
						</a>
					{/if}
				</nav>

				<!-- Информация о текущей странице (для мобильных) -->
				<p class="mt-4 text-center text-sm text-gray-500">
					{$_('common.page')}
					{data.page} / {data.totalPages}
				</p>
			{/if}
		{:else}
			<!-- Empty state -->
			<div
				class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center"
			>
				<svg
					class="w-16 h-16 sm:w-20 sm:h-20 text-gray-400 mx-auto mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					></path>
				</svg>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">
					{$_('reviews.page.empty')}
				</h2>
				<p class="text-gray-600 max-w-md mx-auto">
					{$_('reviews.page.emptyDescription')}
				</p>
			</div>
		{/if}
	</div>
</main>

<style>
	.pagination-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0;
		line-height: 0;
	}

	.pagination-arrow::before {
		font-size: 1rem;
		line-height: 1;
	}

	.pagination-prev::before {
		content: '\\2190';
	}

	.pagination-next::before {
		content: '\\2192';
	}
</style>
