<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import type { Event } from '$lib/types';

	export let event: Event;

	const dispatch = createEventDispatcher();

	// Форма отмены
	let cancellationReason = '';
	let loading = false;
	let error = '';

	/**
	 * Получить локализованное название мероприятия
	 */
	function getEventTitle(): string {
		const currentLocale = $locale || 'de';
		const titles: Record<string, string> = {
			de: event.title_de,
			en: event.title_en || event.title_de,
			ru: event.title_ru || event.title_de,
			uk: event.title_uk || event.title_de,
		};
		return titles[currentLocale] || event.title_de;
	}

	/**
	 * Отправка формы отмены
	 * TODO: Реализуется в 9.4
	 */
	async function handleSubmit() {
		error = '';

		// Валидация
		if (!cancellationReason.trim()) {
			error = $_('admin.events.errors.reasonRequired');
			return;
		}

		loading = true;

		try {
			const response = await fetch('/api/admin/events/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: event.id,
					cancellation_reason: cancellationReason.trim(),
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || $_('admin.events.errors.cancelFailed'));
			}

			// Успех
			dispatch('success');
		} catch (err: any) {
			error = err.message || $_('admin.events.errors.cancelFailed');
		} finally {
			loading = false;
		}
	}

	/**
	 * Закрыть модал
	 */
	function handleClose() {
		dispatch('close');
	}
</script>

<Modal title={$_('admin.events.cancelEventTitle')} on:close={handleClose}>
	<form on:submit|preventDefault={handleSubmit} class="space-y-4">
		<!-- Предупреждение -->
		<div class="bg-orange-50 border border-orange-200 rounded-md p-4">
			<div class="flex">
				<div class="shrink-0">
					<svg
						class="h-5 w-5 text-orange-400"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-orange-800">
						{$_('admin.events.cancelWarningTitle')}
					</h3>
					<div class="mt-2 text-sm text-orange-700">
						<p>{$_('admin.events.cancelWarningMessage')}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Информация о мероприятии -->
		<div class="bg-gray-50 rounded-md p-4">
			<h4 class="text-sm font-medium text-gray-900 mb-2">
				{$_('admin.events.cancellingEvent')}:
			</h4>
			<p class="text-base font-semibold text-gray-900">{getEventTitle()}</p>
			<p class="text-sm text-gray-600 mt-1">
				{new Intl.DateTimeFormat($locale || 'de', {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				}).format(new Date(event.date))}
			</p>
		</div>

		<!-- Причина отмены -->
		<FormField
			label={$_('admin.events.fields.cancellationReason')}
			required={true}
			{error}
			help={$_('admin.events.help.cancellationReason')}
		>
			<textarea
				bind:value={cancellationReason}
				required
				rows="4"
				placeholder={$_('admin.events.placeholders.cancellationReason')}
				class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {error
					? 'border-red-300'
					: ''}"
			/>
		</FormField>

		<!-- Информация об email рассылке -->
		<div class="bg-blue-50 border border-blue-200 rounded-md p-4">
			<div class="flex">
				<div class="shrink-0">
					<svg
						class="h-5 w-5 text-blue-400"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
						/>
						<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-blue-800">
						{$_('admin.events.emailNotificationTitle')}
					</h3>
					<div class="mt-2 text-sm text-blue-700">
						<p>{$_('admin.events.emailNotificationMessage')}</p>
					</div>
				</div>
			</div>
		</div>
	</form>

	<!-- Actions -->
	<svelte:fragment slot="actions">
		<Button on:click={handleClose} variant="secondary" disabled={loading}>
			{$_('common.cancel')}
		</Button>
		<Button on:click={handleSubmit} variant="danger" disabled={loading}>
			{#if loading}
				<svg
					class="animate-spin h-5 w-5 mr-2"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				{$_('common.processing')}
			{:else}
				{$_('admin.events.confirmCancel')}
			{/if}
		</Button>
	</svelte:fragment>
</Modal>
