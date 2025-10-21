<script lang="ts">
	/**
	 * Header Component
	 * Main navigation header with language switcher
	 */

	import { _ } from 'svelte-i18n';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { page } from '$app/stores';

	// Props
	interface Props {
		isAuthenticated?: boolean;
		isAdmin?: boolean;
	}

	let { isAuthenticated = false, isAdmin = false }: Props = $props();

	// Mobile menu state
	let isMobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	function closeMobileMenu() {
		isMobileMenuOpen = false;
	}
</script>

<header class="header">
	<div class="container">
		<!-- Logo -->
		<a href="/" class="logo" aria-label="Berufsorientierung Home">
			<span class="logo-text">Berufsorientierung</span>
		</a>

		<!-- Desktop Navigation -->
		<nav class="desktop-nav" aria-label={$_('nav.home')}>
			<a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>
				{$_('nav.home')}
			</a>
			<a
				href="/events"
				class="nav-link"
				class:active={$page.url.pathname.startsWith('/events')}
			>
				{$_('nav.events')}
			</a>

			{#if isAuthenticated}
				<a
					href="/profile"
					class="nav-link"
					class:active={$page.url.pathname.startsWith('/profile')}
				>
					{$_('nav.profile')}
				</a>

				{#if isAdmin}
					<a
						href="/admin"
						class="nav-link"
						class:active={$page.url.pathname.startsWith('/admin')}
					>
						{$_('nav.admin')}
					</a>
				{/if}
			{/if}
		</nav>

		<!-- Right Side: Language Switcher & Auth Buttons -->
		<div class="header-actions">
			<!-- Language Switcher - visible on all screen sizes -->
			<div class="language-wrapper">
				<LanguageSwitcher />
			</div>

			<!-- Auth buttons - desktop only -->
			<div class="auth-buttons-desktop">
				{#if isAuthenticated}
					<form action="/api/auth/logout" method="POST" style="display: inline;">
						<button type="submit" class="btn btn-secondary">
							{$_('nav.logout')}
						</button>
					</form>
				{:else}
					<a href="/login" class="btn btn-secondary">
						{$_('nav.login')}
					</a>
					<a href="/register" class="btn btn-primary">
						{$_('nav.register')}
					</a>
				{/if}
			</div>
		</div>

		<!-- Mobile Menu Button -->
		<button
			type="button"
			class="mobile-menu-button"
			onclick={toggleMobileMenu}
			aria-expanded={isMobileMenuOpen}
			aria-label="Toggle menu"
		>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{#if isMobileMenuOpen}
					<path d="M18 6L6 18M6 6l12 12" />
				{:else}
					<path d="M3 12h18M3 6h18M3 18h18" />
				{/if}
			</svg>
		</button>
	</div>

	<!-- Mobile Menu -->
	{#if isMobileMenuOpen}
		<div class="mobile-menu">
			<nav class="mobile-nav">
				<a href="/" class="mobile-nav-link" onclick={closeMobileMenu}>
					{$_('nav.home')}
				</a>
				<a href="/events" class="mobile-nav-link" onclick={closeMobileMenu}>
					{$_('nav.events')}
				</a>

				{#if isAuthenticated}
					<a href="/profile" class="mobile-nav-link" onclick={closeMobileMenu}>
						{$_('nav.profile')}
					</a>

					{#if isAdmin}
						<a href="/admin" class="mobile-nav-link" onclick={closeMobileMenu}>
							{$_('nav.admin')}
						</a>
					{/if}

					<form action="/api/auth/logout" method="POST" class="mobile-action">
						<button type="submit" class="btn btn-secondary btn-block">
							{$_('nav.logout')}
						</button>
					</form>
				{:else}
					<div class="mobile-auth-buttons">
						<a
							href="/login"
							class="btn btn-secondary btn-block"
							onclick={closeMobileMenu}
						>
							{$_('nav.login')}
						</a>
						<a
							href="/register"
							class="btn btn-primary btn-block"
							onclick={closeMobileMenu}
						>
							{$_('nav.register')}
						</a>
					</div>
				{/if}
			</nav>
		</div>
	{/if}
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 40;
		background-color: white;
		border-bottom: 1px solid #e5e7eb;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	.container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1280px;
		margin: 0 auto;
		padding: 1rem;
		gap: 1rem;
	}

	/* Logo */
	.logo {
		display: flex;
		align-items: center;
		font-size: 1.25rem;
		font-weight: 700;
		color: #1f2937;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.logo:hover {
		color: #3b82f6;
	}

	.logo-text {
		display: none;
	}

	@media (min-width: 640px) {
		.logo-text {
			display: inline;
		}
	}

	/* Desktop Navigation */
	.desktop-nav {
		display: none;
		align-items: center;
		gap: 1.5rem;
		flex: 1;
		margin: 0 2rem;
	}

	@media (min-width: 1024px) {
		.desktop-nav {
			display: flex;
		}
	}

	.nav-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		text-decoration: none;
		transition: color 0.2s ease;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
	}

	.nav-link:hover {
		color: #1f2937;
		background-color: #f3f4f6;
	}

	.nav-link.active {
		color: #3b82f6;
		font-weight: 600;
	}

	/* Header Actions */
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* Language wrapper - always visible */
	.language-wrapper {
		display: flex;
		align-items: center;
	}

	/* Auth buttons - desktop only */
	.auth-buttons-desktop {
		display: none;
		align-items: center;
		gap: 0.75rem;
	}

	@media (min-width: 1024px) {
		.auth-buttons-desktop {
			display: flex;
		}
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.5rem;
		text-decoration: none;
		transition: all 0.2s ease;
		cursor: pointer;
		border: none;
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
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background-color: #f9fafb;
	}

	.btn-block {
		width: 100%;
	}

	/* Mobile Menu Button */
	.mobile-menu-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: none;
		border: none;
		color: #374151;
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background-color 0.2s ease;
	}

	@media (min-width: 1024px) {
		.mobile-menu-button {
			display: none;
		}
	}

	.mobile-menu-button:hover {
		background-color: #f3f4f6;
	}

	/* Mobile Menu */
	.mobile-menu {
		display: block;
		border-top: 1px solid #e5e7eb;
		background-color: white;
		animation: slideDown 0.2s ease;
	}

	@media (min-width: 1024px) {
		.mobile-menu {
			display: none;
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

	.mobile-nav {
		display: flex;
		flex-direction: column;
		padding: 1rem;
		gap: 0.5rem;
	}

	.mobile-nav-link {
		display: block;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		text-decoration: none;
		border-radius: 0.375rem;
		transition: background-color 0.2s ease;
		min-height: 44px;
	}

	.mobile-nav-link:hover {
		background-color: #f3f4f6;
	}

	.mobile-action {
		margin-top: 0.5rem;
	}

	.mobile-auth-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.header {
			background-color: #1f2937;
			border-bottom-color: #374151;
		}

		.logo {
			color: #f9fafb;
		}

		.logo:hover {
			color: #93c5fd;
		}

		.nav-link {
			color: #d1d5db;
		}

		.nav-link:hover {
			color: #f9fafb;
			background-color: #374151;
		}

		.nav-link.active {
			color: #93c5fd;
		}

		.btn-secondary {
			background-color: #374151;
			color: #f9fafb;
			border-color: #4b5563;
		}

		.btn-secondary:hover {
			background-color: #4b5563;
		}

		.mobile-menu-button {
			color: #f9fafb;
		}

		.mobile-menu-button:hover {
			background-color: #374151;
		}

		.mobile-menu {
			background-color: #1f2937;
			border-top-color: #374151;
		}

		.mobile-nav-link {
			color: #d1d5db;
		}

		.mobile-nav-link:hover {
			background-color: #374151;
		}
	}
</style>
