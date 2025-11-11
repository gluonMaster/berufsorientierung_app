<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { Users, Calendar, ClipboardCheck, Trash2, Clock } from 'lucide-svelte';
	import type { DashboardData } from './+page.server';

	// Данные из +page.server.ts
	export let data: DashboardData;

	// Форматирование даты и времени для логов
	function formatDateTime(timestamp: string): string {
		const date = new Date(timestamp);
		return date.toLocaleString($locale || 'de-DE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Форматирование типа действия (перевод)
	function formatActionType(actionType: string): string {
		// Создаём ключ для перевода вида "admin.activityLog.actions.user_register"
		const translationKey = `admin.activityLog.actions.${actionType}`;
		return $_(translationKey);
	}

	// Карточки статистики с иконками и цветами
	const statsCards = [
		{
			title: 'admin.dashboard.stats.totalUsers',
			value: data.stats.totalUsers,
			icon: Users,
			color: 'blue', // CSS класс для цветового акцента
		},
		{
			title: 'admin.dashboard.stats.activeEvents',
			value: data.stats.activeEvents,
			icon: Calendar,
			color: 'green',
		},
		{
			title: 'admin.dashboard.stats.upcomingRegistrations',
			value: data.stats.upcomingRegistrations,
			icon: ClipboardCheck,
			color: 'purple',
		},
		{
			title: 'admin.dashboard.stats.scheduledDeletions',
			value: data.stats.scheduledDeletions,
			icon: Trash2,
			color: 'orange',
		},
	];
</script>

<div class="dashboard-container">
	<!-- Заголовок -->
	<div class="dashboard-header">
		<h1 class="dashboard-title">{$_('admin.dashboard.title')}</h1>
		<p class="dashboard-subtitle">{$_('admin.dashboard.subtitle')}</p>
	</div>

	<!-- Карточки статистики (Grid 2x2 на desktop, стек на mobile) -->
	<div class="stats-grid">
		{#each statsCards as card}
			<div class="stat-card stat-card-{card.color}">
				<div class="stat-icon">
					<svelte:component this={card.icon} size={32} />
				</div>
				<div class="stat-content">
					<div class="stat-value">{card.value}</div>
					<div class="stat-label">{$_(card.title)}</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Последние действия -->
	<div class="recent-activity">
		<div class="section-header">
			<h2 class="section-title">{$_('admin.dashboard.recentActivity.title')}</h2>
			<a href="/admin/logs" class="view-all-link">
				{$_('admin.dashboard.recentActivity.viewAll')}
			</a>
		</div>

		{#if data.recentActivity.length === 0}
			<!-- Пустое состояние -->
			<div class="empty-state">
				<Clock size={48} />
				<p>{$_('admin.dashboard.recentActivity.empty')}</p>
			</div>
		{:else}
			<!-- Таблица логов (адаптивная) -->
			<div class="activity-table-wrapper">
				<table class="activity-table">
					<thead>
						<tr>
							<th>{$_('admin.dashboard.recentActivity.table.time')}</th>
							<th>{$_('admin.dashboard.recentActivity.table.user')}</th>
							<th>{$_('admin.dashboard.recentActivity.table.action')}</th>
							<th>{$_('admin.dashboard.recentActivity.table.ip')}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentActivity as log}
							<tr>
								<td data-label={$_('admin.dashboard.recentActivity.table.time')}>
									<span class="time-badge">{formatDateTime(log.timestamp)}</span>
								</td>
								<td data-label={$_('admin.dashboard.recentActivity.table.user')}>
									<div class="user-info">
										{#if log.user_full_name}
											<span class="user-name">{log.user_full_name}</span>
											<span class="user-email">{log.user_email || ''}</span>
										{:else}
											<span class="user-system"
												>{$_('admin.dashboard.recentActivity.system')}</span
											>
										{/if}
									</div>
								</td>
								<td data-label={$_('admin.dashboard.recentActivity.table.action')}>
									<span class="action-badge"
										>{formatActionType(log.action_type)}</span
									>
								</td>
								<td data-label={$_('admin.dashboard.recentActivity.table.ip')}>
									<span class="ip-address">{log.ip_address || '—'}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Container */
	.dashboard-container {
		max-width: 1400px;
		margin: 0 auto;
	}

	/* Header */
	.dashboard-header {
		margin-bottom: 2rem;
	}

	.dashboard-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0 0 0.5rem 0;
	}

	.dashboard-subtitle {
		font-size: 1rem;
		color: #666;
		margin: 0;
	}

	/* Stats Grid - Mobile First */
	.stats-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		margin-bottom: 2.5rem;
	}

	@media (min-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* На desktop остаётся 2x2 сетка согласно ТЗ */

	/* Stat Card */
	.stat-card {
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: all 0.2s;
		border-left: 4px solid transparent;
	}

	.stat-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}

	/* Цветовые акценты для карточек */
	.stat-card-blue {
		border-left-color: #3b82f6;
	}

	.stat-card-blue .stat-icon {
		color: #3b82f6;
		background-color: #dbeafe;
	}

	.stat-card-green {
		border-left-color: #10b981;
	}

	.stat-card-green .stat-icon {
		color: #10b981;
		background-color: #d1fae5;
	}

	.stat-card-purple {
		border-left-color: #8b5cf6;
	}

	.stat-card-purple .stat-icon {
		color: #8b5cf6;
		background-color: #ede9fe;
	}

	.stat-card-orange {
		border-left-color: #f59e0b;
	}

	.stat-card-orange .stat-icon {
		color: #f59e0b;
		background-color: #fef3c7;
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 0.5rem;
		flex-shrink: 0;
	}

	.stat-content {
		flex: 1;
		min-width: 0;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: #1a1a1a;
		line-height: 1;
		margin-bottom: 0.25rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #666;
		line-height: 1.4;
	}

	/* Recent Activity Section */
	.recent-activity {
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1a1a1a;
		margin: 0;
	}

	.view-all-link {
		font-size: 0.9375rem;
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.view-all-link:hover {
		color: #2563eb;
		text-decoration: underline;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		color: #9ca3af;
		gap: 1rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 1rem;
	}

	/* Activity Table - Desktop */
	.activity-table-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.activity-table {
		width: 100%;
		border-collapse: collapse;
	}

	.activity-table thead {
		background-color: #f9fafb;
	}

	.activity-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 2px solid #e5e7eb;
	}

	.activity-table tbody tr {
		border-bottom: 1px solid #e5e7eb;
		transition: background-color 0.15s;
	}

	.activity-table tbody tr:hover {
		background-color: #f9fafb;
	}

	.activity-table td {
		padding: 1rem;
		font-size: 0.875rem;
		color: #374151;
		vertical-align: top;
	}

	/* Badges */
	.time-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: #f3f4f6;
		color: #4b5563;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.action-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background-color: #dbeafe;
		color: #1e40af;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.ip-address {
		font-family: 'Courier New', monospace;
		color: #6b7280;
		font-size: 0.8125rem;
	}

	/* User Info */
	.user-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.user-name {
		font-weight: 500;
		color: #1a1a1a;
	}

	.user-email {
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.user-system {
		font-style: italic;
		color: #9ca3af;
	}

	/* Mobile Adaptation - Cards instead of table */
	@media (max-width: 767px) {
		.activity-table thead {
			display: none;
		}

		.activity-table,
		.activity-table tbody,
		.activity-table tr,
		.activity-table td {
			display: block;
		}

		.activity-table tr {
			margin-bottom: 1rem;
			padding: 1rem;
			background: #f9fafb;
			border-radius: 0.5rem;
			border: 1px solid #e5e7eb;
		}

		.activity-table tr:hover {
			background: #f3f4f6;
		}

		.activity-table td {
			padding: 0.5rem 0;
			border: none;
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
		}

		.activity-table td::before {
			content: attr(data-label);
			font-weight: 600;
			color: #6b7280;
			font-size: 0.8125rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			flex-shrink: 0;
			margin-right: 1rem;
		}

		.activity-table td > * {
			text-align: right;
		}

		.user-info {
			align-items: flex-end;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 639px) {
		.dashboard-header {
			margin-bottom: 1.5rem;
		}

		.dashboard-title {
			font-size: 1.5rem;
		}

		.dashboard-subtitle {
			font-size: 0.9375rem;
		}

		.recent-activity {
			padding: 1rem;
		}

		.section-title {
			font-size: 1.125rem;
		}
	}
</style>
