<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Header from '$lib/components/layout/Header.svelte';
</script>

<Header />

<main class="container">
	<section class="hero">
		<h1 class="title">{$_('common.welcome')}</h1>
		<p class="subtitle">Berufsorientierung - Kolibri Dresden</p>

		<div class="cta-buttons">
			<a href="/events" class="btn btn-primary">
				{$_('common.events')}
			</a>
			<a href="/register" class="btn btn-secondary">
				{$_('common.register')}
			</a>
		</div>
	</section>

	<section class="info">
		<div class="info-card">
			<h2>{$_('events.upcomingEvents')}</h2>
			<p>Узнайте о предстоящих мероприятиях по профориентации</p>
		</div>

		<div class="info-card">
			<h2>{$_('common.profile')}</h2>
			<p>Управляйте своим профилем и регистрациями</p>
		</div>

		<div class="info-card">
			<h2>{$_('gdpr.dataProcessing')}</h2>
			<p>Мы заботимся о конфиденциальности ваших данных</p>
		</div>
	</section>
</main>

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
