<script lang="ts">
	/**
	 * Root Layout Component
	 * Главный layout приложения с Header, Footer и инициализацией i18n
	 * + синхронизация серверного состояния пользователя с клиентским store
	 */

	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initializeI18n, isI18nInitialized } from '$lib/stores/language';
	import { waitLocale, locale } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { Header, Footer } from '$lib/components/layout';
	import { setUser, clearUser } from '$lib/stores/user';

	// Данные из +layout.server.ts
	let { data, children } = $props();

	// Пользователь с сервера (синхронизируется с store)
	const serverUser = $derived((data as any)?.user || null);

	// Язык с сервера
	const serverLocale = $derived((data as any)?.locale || 'de');

	// Определяем, находимся ли мы в админ-панели
	// Если путь начинается с /admin - скрываем Header и Footer
	const isAdminRoute = $derived($page.url.pathname.startsWith('/admin'));

	// Реактивная синхронизация серверного пользователя с клиентским store
	// SSR-safe: не использует window или другие browser-only API
	$effect(() => {
		if (serverUser) {
			// Если с сервера пришел пользователь - обновляем store
			setUser(serverUser);
		} else {
			// Если пользователь разлогинился на сервере - очищаем store
			clearUser();
		}
	});

	// Инициализация i18n при монтировании
	onMount(async () => {
		// Используем locale с сервера как начальный
		if (serverLocale) {
			locale.set(serverLocale);
		}
		await initializeI18n();
		await waitLocale();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Berufsorientierung - Kolibri Dresden</title>
	<meta
		name="description"
		content="Профориентация для молодежи с миграционным прошлым в Дрездене"
	/>
</svelte:head>

{#if $isI18nInitialized}
	<div class="app-layout" class:admin-mode={isAdminRoute}>
		<!-- Header с данными пользователя (для SSR синхронизации) -->
		<!-- Скрываем Header и Footer для админ-панели -->
		{#if !isAdminRoute}
			<Header user={serverUser} />
		{/if}

		<!-- Основной контент -->
		<main class="main-content">
			{@render children?.()}
		</main>

		<!-- Footer -->
		{#if !isAdminRoute}
			<Footer />
		{/if}

		<!-- Toast Container для уведомлений -->
		<div class="toast-container">
			<!-- Toast компонент будет управляться через store/события -->
		</div>
	</div>
{:else}
	<div class="loading-screen">
		<div class="spinner"></div>
		<p>Laden...</p>
	</div>
{/if}

<style>
	/* App Layout */
	.app-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* Для админ-панели убираем flex-направление (admin-layout управляет своей сеткой) */
	.app-layout.admin-mode {
		display: block;
	}

	/* Main Content */
	.main-content {
		flex: 1;
		width: 100%;
	}

	/* Для админ-режима main-content не должен иметь flex */
	.admin-mode .main-content {
		flex: none;
	}

	/* Toast Container */
	.toast-container {
		position: fixed;
		top: 5rem;
		right: 1rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		pointer-events: none;
	}

	/* Mobile */
	@media (max-width: 639px) {
		.toast-container {
			top: 4.5rem;
			right: 0.5rem;
			left: 0.5rem;
		}
	}

	/* Loading Screen */
	.loading-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background-color: #f9fafb;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-screen p {
		margin-top: 1rem;
		color: #6b7280;
		font-size: 0.875rem;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.loading-screen {
			background-color: #111827;
		}

		.spinner {
			border-color: #374151;
			border-top-color: #60a5fa;
		}

		.loading-screen p {
			color: #9ca3af;
		}
	}
</style>
