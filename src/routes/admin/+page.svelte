<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { PageData } from './$types';
	import { Users, Calendar, ClipboardList } from 'lucide-svelte';

	export let data: PageData;
</script>

<div class="dashboard">
	<div class="welcome-section">
		<h2 class="welcome-title">{$_('common.welcome')}, {data.user.first_name}!</h2>
		<p class="welcome-text">
			{$_('admin.title')} - {$_('admin.dashboard')}
		</p>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-icon">
				<Users size={40} />
			</div>
			<div class="stat-content">
				<div class="stat-label">{$_('admin.totalUsers')}</div>
				<div class="stat-value">-</div>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">
				<Calendar size={40} />
			</div>
			<div class="stat-content">
				<div class="stat-label">{$_('admin.activeEvents')}</div>
				<div class="stat-value">-</div>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">
				<ClipboardList size={40} />
			</div>
			<div class="stat-content">
				<div class="stat-label">{$_('admin.totalRegistrations')}</div>
				<div class="stat-value">-</div>
			</div>
		</div>
	</div>

	<div class="placeholder-section">
		<p class="placeholder-text">
			{$_('admin.recentActivity')} - Coming soon...
		</p>
	</div>
</div>

<style>
	.dashboard {
		max-width: 1400px;
	}

	.welcome-section {
		margin-bottom: 2rem;
	}

	.welcome-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: #333;
		margin-bottom: 0.5rem;
	}

	.welcome-text {
		font-size: 1rem;
		color: #666;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (min-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.stats-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.stat-card {
		background-color: white;
		border: 1px solid #e5e5e5;
		border-radius: 0.75rem;
		padding: 1.5rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: box-shadow 0.2s;
	}

	.stat-card:hover {
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.stat-icon {
		width: 4rem;
		height: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f0f0f0;
		border-radius: 0.75rem;
		color: #0066cc;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: #333;
	}

	.placeholder-section {
		background-color: white;
		border: 1px solid #e5e5e5;
		border-radius: 0.75rem;
		padding: 2rem;
		text-align: center;
	}

	.placeholder-text {
		font-size: 1.125rem;
		color: #999;
	}
</style>
