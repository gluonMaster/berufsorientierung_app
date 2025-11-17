<script lang="ts">
	/**
	 * Главная страница приложения
	 *
	 * Отображает:
	 * - Hero секцию с заголовком и призывом к действию
	 * - Список активных предстоящих мероприятий
	 * - Empty state если нет мероприятий
	 *
	 * Мультиязычная и мобильно адаптированная
	 */

	import { _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import EventCard from '$lib/components/events/EventCard.svelte';
	import EventModal from '$lib/components/events/EventModal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { EventWithStats } from './+page.server';

	// Получаем данные из +page.server.ts
	export let data: { events: EventWithStats[] };

	// Состояние модального окна
	let selectedEvent: EventWithStats | null = null;
	let isModalOpen = false;

	/**
	 * Открывает модальное окно с деталями мероприятия
	 */
	function openEventModal(event: EventWithStats) {
		selectedEvent = event;
		isModalOpen = true;
	}

	/**
	 * Закрывает модальное окно
	 */
	function closeEventModal() {
		isModalOpen = false;
		// Небольшая задержка перед очисткой selectedEvent для плавности анимации закрытия
		setTimeout(() => {
			selectedEvent = null;
		}, 200);
	}

	/**
	 * Определяем есть ли авторизованный пользователь из page store
	 * Надёжнее чем проверка через события (работает даже если событий нет)
	 */
	$: isAuthenticated = !!$page.data.user;
</script>

<main class="min-h-screen bg-gray-50">
	<!-- Hero секция -->
	<section class="bg-linear-to-br from-blue-600 to-blue-800 text-white">
		<div class="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
			<div class="max-w-3xl mx-auto text-center">
				<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
					{$_('homepage.hero.title')}
				</h1>
				<p class="text-lg sm:text-xl text-blue-100 mb-8">
					{$_('homepage.hero.subtitle')}
				</p>

				<!-- CTA кнопка если пользователь не авторизован -->
				{#if !isAuthenticated}
					<div class="flex justify-center">
						<Button
							variant="primary"
							type="button"
							size="lg"
							on:click={() => (window.location.href = '/register')}
						>
							{$_('homepage.hero.registerCta')}
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Секция предстоящих мероприятий -->
	<section class="container mx-auto px-4 py-8 sm:py-12">
		<!-- Заголовок секции -->
		<div class="mb-8">
			<h2 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
				{$_('homepage.events.title')}
			</h2>
			<p class="text-gray-600">
				{$_('homepage.events.subtitle')}
			</p>
		</div>

		<!-- Список мероприятий или Empty state -->
		{#if data.events.length > 0}
			<!-- Grid мероприятий (адаптивный: 1 колонка на mobile, 2 на tablet, 3 на desktop) -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each data.events as event (event.id)}
					<EventCard {event} onCardClick={() => openEventModal(event)} />
				{/each}
			</div>
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
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					></path>
				</svg>
				<h3 class="text-xl font-semibold text-gray-900 mb-2">
					{$_('homepage.events.empty.title')}
				</h3>
				<p class="text-gray-600 mb-6 max-w-md mx-auto">
					{$_('homepage.events.empty.message')}
				</p>

				<!-- Кнопка обновления -->
				<Button variant="secondary" type="button" on:click={() => window.location.reload()}>
					{$_('homepage.events.empty.refresh')}
				</Button>
			</div>
		{/if}
	</section>
</main>

<!-- Модальное окно с деталями мероприятия -->
{#if selectedEvent}
	<EventModal event={selectedEvent} isOpen={isModalOpen} onClose={closeEventModal} />
{/if}
