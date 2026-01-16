<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { _ } from 'svelte-i18n';

	// Компонент модального окна с backdrop, анимацией и focus trap
	export let isOpen = true;
	export let onClose: (() => void) | undefined = undefined;
	export let title: string;
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const dispatch = createEventDispatcher();

	let modalElement: HTMLDivElement;
	let previousActiveElement: HTMLElement | null = null;

	// Размеры модала
	const sizeClasses = {
		sm: 'max-w-md',
		md: 'max-w-lg md:max-w-2xl',
		lg: 'max-w-2xl md:max-w-4xl lg:max-w-6xl',
	};

	// Функция закрытия модала
	function handleClose() {
		dispatch('close');
		onClose?.();
	}

	// Обработка нажатия ESC для закрытия модала
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			handleClose();
		}
	}

	// Закрытие по клику на backdrop
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	// Focus trap: перехват Tab и Shift+Tab внутри модала
	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const focusableElements = modalElement.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

		if (event.shiftKey) {
			// Shift + Tab
			if (document.activeElement === firstElement) {
				lastElement.focus();
				event.preventDefault();
			}
		} else {
			// Tab
			if (document.activeElement === lastElement) {
				firstElement.focus();
				event.preventDefault();
			}
		}
	}

	// Управление скроллом body и фокусом (только в браузере)
	$: if (browser) {
		if (isOpen) {
			// Сохранение текущего активного элемента
			previousActiveElement = document.activeElement as HTMLElement;

			// Блокировка скролла
			document.body.style.overflow = 'hidden';

			// Установка фокуса на модал после рендеринга
			setTimeout(() => {
				const closeButton = modalElement?.querySelector('button');
				closeButton?.focus();
			}, 0);
		} else {
			// Восстановление скролла
			document.body.style.overflow = '';

			// Возврат фокуса на предыдущий элемент
			if (previousActiveElement) {
				previousActiveElement.focus();
			}
		}
	}

	onMount(() => {
		if (browser) {
			document.addEventListener('keydown', handleKeydown);
		}
	});

	onDestroy(() => {
		if (browser) {
			document.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = '';
		}
	});
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 transition-opacity duration-200"
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
		role="presentation"
	>
		<!-- Modal -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				bind:this={modalElement}
				class="bg-white rounded-lg shadow-xl w-full {sizeClasses[
					size
				]} max-h-[90vh] overflow-hidden transform transition-all duration-200 animate-fade-in-scale flex flex-col"
				on:keydown={handleModalKeydown}
				role="document"
			>
				<!-- Header -->
				<div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
					<h2 id="modal-title" class="text-lg sm:text-xl font-semibold text-gray-900">
						{title}
					</h2>
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2"
						on:click={handleClose}
						aria-label={$_('ui.modal.closeAriaLabel')}
					>
						<svg
							class="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>

				<!-- Content -->
				<div class="p-4 sm:p-6 overflow-y-auto flex-1">
					<slot />
				</div>

				<!-- Footer Actions -->
				{#if $$slots.actions}
					<div
						class="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200"
					>
						<slot name="actions" />
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in-scale {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-fade-in-scale {
		animation: fade-in-scale 0.2s ease-out;
	}
</style>
