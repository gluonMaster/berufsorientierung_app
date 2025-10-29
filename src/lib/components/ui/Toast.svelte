<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	// Компонент уведомления с автоматическим закрытием и анимацией
	export let message: string;
	export let type: 'success' | 'error' | 'info' = 'info';
	export let duration = 3000;
	export let onClose: (() => void) | undefined = undefined;

	let visible = false;
	let timeoutId: ReturnType<typeof setTimeout>;

	// ARIA role и aria-live в зависимости от типа
	// error → alert (assertive) для критических сообщений
	// success/info → status (polite) для информационных сообщений
	$: ariaRole = type === 'error' ? 'alert' : 'status';
	$: ariaLive = type === 'error' ? 'assertive' : 'polite';

	// Стили в зависимости от типа уведомления
	const typeStyles = {
		success: 'bg-green-500 text-white',
		error: 'bg-red-500 text-white',
		info: 'bg-blue-500 text-white',
	};

	// Иконки для каждого типа
	const icons = {
		success: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
		</svg>`,
		error: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
		</svg>`,
		info: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>`,
	};

	// Закрытие уведомления
	function close() {
		visible = false;
		clearTimeout(timeoutId);
		// Задержка для завершения анимации перед вызовом onClose
		setTimeout(() => {
			if (onClose) {
				onClose();
			}
		}, 300);
	}

	onMount(() => {
		// Анимация появления
		setTimeout(() => {
			visible = true;
		}, 10);

		// Автоматическое закрытие
		if (duration > 0) {
			timeoutId = setTimeout(() => {
				close();
			}, duration);
		}

		return () => {
			clearTimeout(timeoutId);
		};
	});
</script>

<div
	class="fixed z-50 top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 w-[calc(100%-2rem)] max-w-sm transition-all duration-300 {visible
		? 'opacity-100 translate-y-0'
		: 'opacity-0 -translate-y-4'}"
	role={ariaRole}
	aria-live={ariaLive}
>
	<div class="rounded-lg shadow-lg overflow-hidden {typeStyles[type]}">
		<div class="flex items-center p-4 gap-3">
			<!-- Иконка -->
			<div class="flex-shrink-0">
				{@html icons[type]}
			</div>

			<!-- Сообщение -->
			<div class="flex-1 text-sm sm:text-base font-medium">
				{message}
			</div>

			<!-- Кнопка закрытия -->
			<button
				type="button"
				class="flex-shrink-0 text-white hover:text-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-current rounded-lg p-1"
				on:click={close}
				aria-label={$_('ui.toast.closeAriaLabel')}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>

		<!-- Прогресс-бар (опционально) -->
		{#if duration > 0}
			<div class="h-1 bg-white bg-opacity-30 overflow-hidden">
				<div
					class="h-full bg-white transition-all ease-linear"
					style="width: 100%; animation: progress {duration}ms linear;"
				></div>
			</div>
		{/if}
	</div>
</div>

<style>
	@keyframes progress {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
</style>
