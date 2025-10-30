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
	<section class="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
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
							type="primary"
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
				<Button type="secondary" on:click={() => window.location.reload()}>
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

<style>
	.container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.hero {
		text-align: center;
		padding: 4rem 0;
	}

	.title {
		font-size: 3rem;
		font-weight: 800;
		color: #1f2937;
		margin-bottom: 1rem;
	}

	.subtitle {
		font-size: 1.25rem;
		color: #6b7280;
		margin-bottom: 2rem;
	}

	.cta-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 0.5rem;
		text-decoration: none;
		transition: all 0.2s ease;
		min-height: 44px;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
	}

	.btn-primary:hover {
		background-color: #2563eb;
	}

	.btn-secondary {
		background-color: white;
		color: #374151;
		border: 2px solid #d1d5db;
	}

	.btn-secondary:hover {
		background-color: #f9fafb;
	}

	.info {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 2rem;
		margin-top: 4rem;
	}

	.info-card {
		padding: 2rem;
		background-color: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.info-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
	}

	.info-card h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
		margin-bottom: 0.75rem;
	}

	.info-card p {
		color: #6b7280;
		line-height: 1.6;
	}

	@media (max-width: 640px) {
		.title {
			font-size: 2rem;
		}

		.subtitle {
			font-size: 1rem;
		}

		.hero {
			padding: 2rem 0;
		}

		.info {
			grid-template-columns: 1fr;
		}
	}
</style>
