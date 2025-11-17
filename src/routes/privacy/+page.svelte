<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<svelte:head>
	<title>{$_('legal.privacy.title')} - Berufsorientierung</title>
	<meta name="description" content={$_('legal.privacy.title')} />
</svelte:head>

<section class="legal-page">
	<div class="container">
		<h1 class="title">{$_('legal.privacy.title')}</h1>
		<div class="content">
			{@html $_('legal.privacy.content')}
		</div>
	</div>
</section>

<style>
	.legal-page {
		padding: 2rem 1rem;
		min-height: 60vh;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
	}

	.title {
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		color: #1f2937;
	}

	.content :global(h2) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
		color: #374151;
	}

	.content :global(p) {
		margin-bottom: 0.75rem;
		line-height: 1.6;
		color: #4b5563;
	}

	.content :global(ul) {
		margin-left: 1.25rem;
		margin-bottom: 0.75rem;
		list-style: disc;
		color: #4b5563;
	}

	.content :global(li) {
		margin-bottom: 0.5rem;
		line-height: 1.6;
	}

	.content :global(strong) {
		font-weight: 600;
		color: #1f2937;
	}

	.content :global(br) {
		line-height: 1.8;
	}

	/* Мобильная адаптация */
	@media (max-width: 640px) {
		.legal-page {
			padding: 1.5rem 1rem;
		}

		.title {
			font-size: 1.5rem;
		}

		.content :global(h2) {
			font-size: 1.125rem;
		}

		.content :global(ul) {
			margin-left: 1rem;
		}
	}
</style>
