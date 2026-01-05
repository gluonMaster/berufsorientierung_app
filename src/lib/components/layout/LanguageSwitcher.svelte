<script lang="ts">
	/**
	 * LanguageSwitcher Component
	 * Dropdown for switching between supported languages with flags
	 * Mobile-responsive: shows only flags on small screens, full names on larger screens
	 */

	import { _ } from 'svelte-i18n';
	import {
		currentLanguage,
		changeLanguage,
		SUPPORTED_LANGUAGES,
		getAvailableLanguages,
		type LanguageCode,
	} from '$lib/stores/language';
	import { clickOutside } from '$lib/utils/clickOutside';

	// Component state
	let isOpen = $state(false);
	let dropdownRef: HTMLDivElement | undefined = $state();

	// Available languages
	const languages = getAvailableLanguages();

	/**
	 * Handles language selection
	 */
	async function handleLanguageChange(langCode: LanguageCode) {
		await changeLanguage(langCode);
		isOpen = false;
	}

	/**
	 * Toggles dropdown
	 */
	function toggleDropdown() {
		isOpen = !isOpen;
	}

	/**
	 * Closes dropdown when clicking outside
	 */
	function handleClickOutside() {
		if (isOpen) {
			isOpen = false;
		}
	}

	/**
	 * Keyboard navigation
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}

	function getFlagSrc(langCode: LanguageCode): string {
		return `/flags/${langCode}.svg`;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative inline-block" bind:this={dropdownRef} use:clickOutside={handleClickOutside}>
	<!-- Trigger Button -->
	<button
		type="button"
		class="language-switcher-button"
		onclick={toggleDropdown}
		aria-expanded={isOpen}
		aria-haspopup="true"
		aria-label={$_('profile.language')}
	>
		<img
			class="flag"
			src={getFlagSrc($currentLanguage)}
			alt=""
			aria-hidden="true"
			loading="eager"
		/>
		<span class="language-name">
			{SUPPORTED_LANGUAGES[$currentLanguage].nativeName}
		</span>
		<svg
			class="chevron"
			class:open={isOpen}
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				d="M5 7.5L10 12.5L15 7.5"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div class="language-dropdown" role="menu" aria-label={$_('profile.language')}>
			{#each languages as lang (lang.code)}
				<button
					type="button"
					class="language-option"
					class:active={$currentLanguage === lang.code}
					onclick={() => handleLanguageChange(lang.code)}
					role="menuitem"
					aria-label={`${$_('profile.language')}: ${lang.nativeName}`}
				>
					<img
						class="flag"
						src={getFlagSrc(lang.code)}
						alt=""
						aria-hidden="true"
						loading="lazy"
					/>
					<span class="language-name">{lang.nativeName}</span>
					{#if $currentLanguage === lang.code}
						<svg
							class="checkmark"
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<path
								d="M13.5 4L6 11.5L2.5 8"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.language-switcher-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem; /* Square padding for mobile (flag only) */
		background-color: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 44px; /* Touch-friendly */
		min-width: 44px; /* Touch-friendly for mobile */
	}

	.language-switcher-button:hover {
		background-color: #f9fafb;
		border-color: #d1d5db;
	}

	.language-switcher-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px #3b82f6;
	}

	.language-switcher-button:active {
		background-color: #f3f4f6;
	}

	.flag {
		width: 1.25rem;
		height: 0.9375rem;
		border-radius: 0.125rem;
		object-fit: cover;
		display: block;
		flex-shrink: 0;
	}

	.language-name {
		display: none;
		white-space: nowrap;
	}

	.chevron {
		transition: transform 0.2s ease;
		color: #6b7280;
		flex-shrink: 0;
		display: none;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.language-dropdown {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		z-index: 50;
		min-width: 12rem;
		background-color: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -4px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		animation: slideDown 0.2s ease;
	}

	/* <= 767px: language switcher lives in the mobile menu (left aligned) */
	@media (max-width: 767px) {
		.language-dropdown {
			left: 0;
			right: auto;
			min-width: 10rem;
			max-width: calc(100vw - 2rem);
		}
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.language-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background-color: white;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.15s ease;
		min-height: 44px; /* Touch-friendly */
	}

	.language-option:hover {
		background-color: #f9fafb;
	}

	.language-option:focus {
		outline: none;
		background-color: #f3f4f6;
	}

	.language-option.active {
		background-color: #eff6ff;
		color: #2563eb;
	}

	.language-option .language-name {
		display: block;
		flex: 1;
	}

	.checkmark {
		color: #2563eb;
		flex-shrink: 0;
	}

	/* Mobile: show only flags in button, full names in dropdown */
	@media (min-width: 640px) {
		.language-switcher-button {
			padding: 0.5rem 0.75rem; /* More padding for text */
			justify-content: flex-start;
		}

		.language-switcher-button .language-name {
			display: block;
		}

		.language-switcher-button .chevron {
			display: block;
		}
	}

	/* Tablet and Desktop: show full names everywhere */
	@media (min-width: 768px) {
		.language-dropdown {
			min-width: 14rem;
		}
	}

	/* Dark mode support (if needed in future) */
	@media (prefers-color-scheme: dark) {
		.language-switcher-button {
			background-color: #1f2937;
			border-color: #374151;
			color: #f9fafb;
		}

		.language-switcher-button:hover {
			background-color: #374151;
			border-color: #4b5563;
		}

		.language-dropdown {
			background-color: #1f2937;
			border-color: #374151;
		}

		.language-option {
			background-color: #1f2937;
			color: #f9fafb;
		}

		.language-option:hover {
			background-color: #374151;
		}

		.language-option:focus {
			background-color: #4b5563;
		}

		.language-option.active {
			background-color: #1e3a8a;
			color: #93c5fd;
		}

		.checkmark {
			color: #93c5fd;
		}
	}
</style>
