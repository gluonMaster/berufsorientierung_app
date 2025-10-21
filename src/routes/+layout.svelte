<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initializeI18n, isI18nInitialized } from '$lib/stores/language';
	import { waitLocale } from 'svelte-i18n';

	let { children } = $props();

	// Initialize i18n on mount
	onMount(async () => {
		await initializeI18n();
		await waitLocale();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

{#if $isI18nInitialized}
	{@render children?.()}
{:else}
	<div class="loading-screen">
		<div class="spinner"></div>
		<p>Loading...</p>
	</div>
{/if}

<style>
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
</style>
