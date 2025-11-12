<script lang="ts">
	/**
	 * Admin Statistics Page
	 * Страница статистики для админки
	 */

	import { _, locale } from 'svelte-i18n';
	import EventViewModal from '$lib/components/admin/EventViewModal.svelte';

	export let data: any;

	const { generalStats, eventStats } = data;

	// Состояние для модального окна просмотра мероприятия
	let isEventModalOpen = false;
	let selectedEventId: number | null = null;

	/**
	 * Открыть модальное окно просмотра мероприятия
	 */
	function openEventModal(eventId: number) {
		selectedEventId = eventId;
		isEventModalOpen = true;
	}

	/**
	 * Закрыть модальное окно
	 */
	function closeEventModal() {
		isEventModalOpen = false;
		selectedEventId = null;
	}

	/**
	 * Форматирование месяца для отображения
	 */
	function formatMonth(month: string): string {
		const [year, monthNum] = month.split('-');
		const date = new Date(parseInt(year), parseInt(monthNum) - 1);
		return date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
	}

	/**
	 * Форматирование даты мероприятия
	 */
	function formatEventDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
	}

	/**
	 * Получить цвет для статуса мероприятия
	 */
	function getStatusColor(status: string): string {
		switch (status) {
			case 'active':
				return 'bg-green-100 text-green-800';
			case 'draft':
				return 'bg-gray-100 text-gray-800';
			case 'cancelled':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	/**
	 * Перевод статуса мероприятия
	 */
	function translateStatus(status: string): string {
		// Капитализируем первую букву для соответствия ключам переводов
		// admin.events.statusDraft, admin.events.statusActive, admin.events.statusCancelled
		const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
		return $_(`admin.events.status${capitalizedStatus}`);
	}

	/**
	 * Получить название мероприятия на текущем языке
	 * Использует текущую локаль из svelte-i18n с fallback на немецкий
	 */
	function getEventTitle(event: any): string {
		// Получаем текущую локаль (de, en, ru, uk) с fallback на 'de'
		const lang = ($locale || 'de').substring(0, 2);

		// Пытаемся получить название на текущем языке, иначе fallback на немецкий (бизнес-правило)
		return event[`title_${lang}`] || event.title_de || event.title_en || 'Untitled';
	}

	// Подготовка данных для графика пользователей (линейный)
	const maxUserCount = Math.max(...generalStats.usersByMonth.map((m: any) => m.count), 1);
	const userChartHeight = 200;
	const userChartWidth = 600;
	const userChartPadding = 40;

	// Подготовка данных для графика мероприятий по статусам (bar chart)
	const maxEventStatusCount = Math.max(
		...generalStats.eventsByStatus.map((s: any) => s.count),
		1
	);
	const eventStatusChartHeight = 200;
	const eventStatusChartWidth = 400;
	const eventStatusBarWidth =
		eventStatusChartWidth / Math.max(generalStats.eventsByStatus.length, 1) - 20;

	// Подготовка данных для pie chart регистраций по статусам
	const totalRegByStatus = generalStats.registrationsByStatus.reduce(
		(sum: number, item: any) => sum + item.count,
		0
	);
	const pieRadius = 80;
	const pieCenterX = 120;
	const pieCenterY = 120;
	const pieColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

	// Предварительный расчет углов для pie chart
	let pieSlices: Array<{ startAngle: number; endAngle: number; status: string; count: number }> =
		[];
	if (totalRegByStatus > 0) {
		let currentAngle = -Math.PI / 2; // Start at top
		pieSlices = generalStats.registrationsByStatus.map((statusStat: any) => {
			const sliceAngle = (statusStat.count / totalRegByStatus) * 2 * Math.PI;
			const endAngle = currentAngle + sliceAngle;
			const slice = {
				startAngle: currentAngle,
				endAngle: endAngle,
				status: statusStat.status,
				count: statusStat.count,
			};
			currentAngle = endAngle;
			return slice;
		});
	}

	/**
	 * Создать SVG path для сегмента pie chart
	 */
	function createPieSlice(
		centerX: number,
		centerY: number,
		radius: number,
		startAngle: number,
		endAngle: number
	): string {
		const startX = centerX + radius * Math.cos(startAngle);
		const startY = centerY + radius * Math.sin(startAngle);
		const endX = centerX + radius * Math.cos(endAngle);
		const endY = centerY + radius * Math.sin(endAngle);
		const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

		return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
	}

	// Подготовка данных для графика регистраций (убираем, заменяем на pie chart)
	const maxRegCount = Math.max(...generalStats.registrationsByMonth.map((m: any) => m.count), 1);
	const regChartHeight = 200;
	const regChartWidth = 600;
	const regBarWidth = regChartWidth / Math.max(generalStats.registrationsByMonth.length, 1) - 4;
</script>

<svelte:head>
	<title>{$_('admin.statsPage.title')} - Berufsorientierung</title>
</svelte:head>

<div class="space-y-8">
	<!-- Заголовок -->
	<div>
		<h1 class="text-3xl font-bold text-gray-900">{$_('admin.statsPage.title')}</h1>
		<p class="mt-2 text-gray-600">{$_('admin.statsPage.description')}</p>
	</div>

	<!-- Карточки с основной статистикой -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Всего пользователей -->
		<div class="rounded-lg bg-white p-6 shadow">
			<div class="flex items-center">
				<div class="flex-1">
					<p class="text-sm font-medium text-gray-600">
						{$_('admin.statsPage.totalUsers')}
					</p>
					<p class="mt-2 text-3xl font-bold text-gray-900">{generalStats.totalUsers}</p>
				</div>
				<div class="rounded-full bg-blue-100 p-3">
					<svg
						class="h-8 w-8 text-blue-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
				</div>
			</div>
		</div>

		<!-- Всего регистраций -->
		<div class="rounded-lg bg-white p-6 shadow">
			<div class="flex items-center">
				<div class="flex-1">
					<p class="text-sm font-medium text-gray-600">
						{$_('admin.statsPage.totalRegistrations')}
					</p>
					<p class="mt-2 text-3xl font-bold text-gray-900">
						{generalStats.totalRegistrations}
					</p>
				</div>
				<div class="rounded-full bg-green-100 p-3">
					<svg
						class="h-8 w-8 text-green-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
						/>
					</svg>
				</div>
			</div>
		</div>

		<!-- Средняя заполняемость -->
		<div class="rounded-lg bg-white p-6 shadow">
			<div class="flex items-center">
				<div class="flex-1">
					<p class="text-sm font-medium text-gray-600">
						{$_('admin.statsPage.averageOccupancy')}
					</p>
					<p class="mt-2 text-3xl font-bold text-gray-900">
						{generalStats.averageOccupancy}%
					</p>
				</div>
				<div class="rounded-full bg-purple-100 p-3">
					<svg
						class="h-8 w-8 text-purple-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						/>
					</svg>
				</div>
			</div>
		</div>

		<!-- Всего мероприятий -->
		<div class="rounded-lg bg-white p-6 shadow">
			<div class="flex items-center">
				<div class="flex-1">
					<p class="text-sm font-medium text-gray-600">
						{$_('admin.statsPage.totalEvents')}
					</p>
					<p class="mt-2 text-3xl font-bold text-gray-900">
						{generalStats.eventsByStatus.reduce(
							(sum: number, s: any) => sum + s.count,
							0
						)}
					</p>
				</div>
				<div class="rounded-full bg-orange-100 p-3">
					<svg
						class="h-8 w-8 text-orange-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
				</div>
			</div>
		</div>
	</div>

	<!-- Графики -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- График регистраций пользователей (Line Chart) -->
		<div class="rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">
				{$_('admin.statsPage.userRegistrations')}
			</h2>
			<div class="overflow-x-auto">
				<svg
					class="w-full"
					viewBox="0 0 {userChartWidth} {userChartHeight + userChartPadding}"
					preserveAspectRatio="xMidYMid meet"
				>
					<!-- Оси -->
					<line
						x1="0"
						y1={userChartHeight}
						x2={userChartWidth}
						y2={userChartHeight}
						stroke="#E5E7EB"
						stroke-width="2"
					/>

					<!-- Линия графика -->
					{#if generalStats.usersByMonth.length > 0}
						{@const points = generalStats.usersByMonth
							.map((month: any, i: number) => {
								const x =
									(i / Math.max(generalStats.usersByMonth.length - 1, 1)) *
										(userChartWidth - 20) +
									10;
								const y =
									userChartHeight -
									(month.count / maxUserCount) * (userChartHeight - 20);
								return `${x},${y}`;
							})
							.join(' ')}

						<polyline
							{points}
							fill="none"
							stroke="#3B82F6"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>

						<!-- Точки данных -->
						{#each generalStats.usersByMonth as month, i}
							{@const x =
								(i / Math.max(generalStats.usersByMonth.length - 1, 1)) *
									(userChartWidth - 20) +
								10}
							{@const y =
								userChartHeight -
								(month.count / maxUserCount) * (userChartHeight - 20)}

							<!-- Точка -->
							<circle cx={x} cy={y} r="4" fill="#3B82F6" />

							<!-- Значение -->
							<text
								{x}
								y={y - 10}
								text-anchor="middle"
								font-size="12"
								fill="#374151"
								font-weight="600"
							>
								{month.count}
							</text>

							<!-- Метка месяца -->
							<text
								{x}
								y={userChartHeight + 20}
								text-anchor="middle"
								font-size="10"
								fill="#6B7280"
							>
								{formatMonth(month.month)}
							</text>
						{/each}
					{/if}
				</svg>
			</div>
		</div>

		<!-- График мероприятий по статусам (Bar Chart) -->
		<div class="rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">
				{$_('admin.statsPage.eventsByStatus')}
			</h2>
			<div class="overflow-x-auto">
				<svg
					class="w-full"
					viewBox="0 0 {eventStatusChartWidth} {eventStatusChartHeight + 40}"
					preserveAspectRatio="xMidYMid meet"
				>
					<!-- Оси -->
					<line
						x1="0"
						y1={eventStatusChartHeight}
						x2={eventStatusChartWidth}
						y2={eventStatusChartHeight}
						stroke="#E5E7EB"
						stroke-width="2"
					/>

					<!-- Столбцы -->
					{#each generalStats.eventsByStatus as statusStat, i}
						{@const barHeight =
							(statusStat.count / maxEventStatusCount) *
							(eventStatusChartHeight - 20)}
						{@const x = i * (eventStatusBarWidth + 20) + 10}
						{@const y = eventStatusChartHeight - barHeight}
						{@const barColor =
							statusStat.status === 'active'
								? '#10B981'
								: statusStat.status === 'draft'
									? '#6B7280'
									: '#EF4444'}

						<!-- Столбец -->
						<rect
							{x}
							{y}
							width={eventStatusBarWidth}
							height={barHeight}
							fill={barColor}
							rx="2"
						/>

						<!-- Значение -->
						<text
							x={x + eventStatusBarWidth / 2}
							y={y - 5}
							text-anchor="middle"
							font-size="14"
							font-weight="600"
							fill="#374151"
						>
							{statusStat.count}
						</text>

						<!-- Метка статуса -->
						<text
							x={x + eventStatusBarWidth / 2}
							y={eventStatusChartHeight + 20}
							text-anchor="middle"
							font-size="11"
							fill="#6B7280"
						>
							{translateStatus(statusStat.status)}
						</text>
					{/each}
				</svg>
			</div>
		</div>
	</div>

	<!-- Круговая диаграмма распределения регистраций (Pie Chart) -->
	<div class="rounded-lg bg-white p-6 shadow">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">
			{$_('admin.statsPage.registrationDistribution')}
		</h2>
		<div class="flex flex-col items-center gap-6 md:flex-row md:justify-center">
			<!-- Pie chart -->
			<svg width="240" height="240" viewBox="0 0 240 240">
				{#if totalRegByStatus > 0}
					{#each pieSlices as slice, i}
						{@const path = createPieSlice(
							pieCenterX,
							pieCenterY,
							pieRadius,
							slice.startAngle,
							slice.endAngle
						)}

						<path
							d={path}
							fill={pieColors[i % pieColors.length]}
							stroke="white"
							stroke-width="2"
						/>
					{/each}
				{:else}
					<!-- Пустая диаграмма -->
					<circle cx={pieCenterX} cy={pieCenterY} r={pieRadius} fill="#E5E7EB" />
				{/if}
			</svg>

			<!-- Легенда -->
			<div class="space-y-2">
				{#each generalStats.registrationsByStatus as statusStat, i}
					{@const percent =
						totalRegByStatus > 0
							? Math.round((statusStat.count / totalRegByStatus) * 100)
							: 0}
					<div class="flex items-center gap-3">
						<div
							class="h-4 w-4 shrink-0 rounded"
							style="background-color: {pieColors[i % pieColors.length]}"
						></div>
						<span class="text-sm text-gray-700">
							{translateStatus(statusStat.status)}:
						</span>
						<span class="font-semibold text-gray-900">
							{statusStat.count} ({percent}%)
						</span>
					</div>
				{/each}
				{#if totalRegByStatus === 0}
					<p class="text-sm text-gray-500">{$_('admin.statsPage.noRegistrations')}</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Топ-3 популярных мероприятий (теперь заменяет старую секцию eventsByStatus) -->
	<div class="rounded-lg bg-white p-6 shadow">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">{$_('admin.statsPage.topEvents')}</h2>
		<div class="space-y-3">
			{#each generalStats.topEvents as event, index}
				<div class="flex items-center gap-4 rounded-lg border border-gray-200 p-4">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white"
					>
						{index + 1}
					</div>
					<div class="flex-1">
						<h3 class="font-medium text-gray-900">{getEventTitle(event)}</h3>
						<p class="text-sm text-gray-600">
							{event.registrations}
							{$_('admin.statsPage.registrations')}
							{#if event.max_participants}
								/ {event.max_participants} {$_('admin.statsPage.participants')}
							{/if}
						</p>
					</div>
					{#if event.max_participants}
						{@const percent = Math.round(
							(event.registrations / event.max_participants) * 100
						)}
						<div class="text-right">
							<span class="text-2xl font-bold text-gray-900">{percent}%</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Таблица прошедших мероприятий -->
	<div class="rounded-lg bg-white shadow">
		<div class="border-b border-gray-200 px-6 py-4">
			<h2 class="text-lg font-semibold text-gray-900">{$_('admin.statsPage.pastEvents')}</h2>
		</div>

		<!-- Desktop таблица -->
		<div class="hidden overflow-x-auto md:block">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.statsPage.eventName')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.statsPage.date')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.statsPage.registered')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.statsPage.limit')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('admin.statsPage.occupancy')}
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
						>
							{$_('events.viewDetails')}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each eventStats as event}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4">
								<div class="text-sm font-medium text-gray-900">
									{getEventTitle(event)}
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="text-sm text-gray-600">
									{formatEventDate(event.date)}
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="text-sm font-semibold text-gray-900">
									{event.registrations_count}
								</div>
							</td>
							<td class="px-6 py-4">
								<div class="text-sm text-gray-600">
									{event.max_participants ?? $_('admin.statsPage.unlimited')}
								</div>
							</td>
							<td class="px-6 py-4">
								{#if event.occupancy_percent !== null}
									<div class="flex items-center gap-2">
										<div
											class="h-2 w-24 overflow-hidden rounded-full bg-gray-200"
										>
											<div
												class="h-full rounded-full {event.occupancy_percent >=
												90
													? 'bg-red-500'
													: event.occupancy_percent >= 70
														? 'bg-yellow-500'
														: 'bg-green-500'}"
												style="width: {Math.min(
													event.occupancy_percent,
													100
												)}%"
											></div>
										</div>
										<span class="text-sm font-medium text-gray-900"
											>{event.occupancy_percent}%</span
										>
									</div>
								{:else}
									<span class="text-sm text-gray-400">—</span>
								{/if}
							</td>
							<td class="px-6 py-4">
								<button
									type="button"
									class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
									on:click={() => openEventModal(event.id)}
								>
									{$_('events.viewDetails')}
								</button>
							</td>
						</tr>
					{/each}

					{#if eventStats.length === 0}
						<tr>
							<td colspan="6" class="px-6 py-8 text-center text-gray-500">
								{$_('admin.statsPage.noPastEvents')}
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>

		<!-- Mobile карточки -->
		<div class="space-y-4 p-4 md:hidden">
			{#each eventStats as event}
				<div class="rounded-lg border border-gray-200 p-4">
					<h3 class="mb-2 font-medium text-gray-900">{getEventTitle(event)}</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-600">{$_('admin.statsPage.date')}:</span>
							<span class="font-medium text-gray-900"
								>{formatEventDate(event.date)}</span
							>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">{$_('admin.statsPage.registered')}:</span>
							<span class="font-medium text-gray-900"
								>{event.registrations_count}</span
							>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">{$_('admin.statsPage.limit')}:</span>
							<span class="font-medium text-gray-900">
								{event.max_participants ?? $_('admin.statsPage.unlimited')}
							</span>
						</div>
						{#if event.occupancy_percent !== null}
							<div class="flex justify-between">
								<span class="text-gray-600">{$_('admin.statsPage.occupancy')}:</span
								>
								<div class="flex items-center gap-2">
									<div class="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
										<div
											class="h-full rounded-full {event.occupancy_percent >=
											90
												? 'bg-red-500'
												: event.occupancy_percent >= 70
													? 'bg-yellow-500'
													: 'bg-green-500'}"
											style="width: {Math.min(event.occupancy_percent, 100)}%"
										></div>
									</div>
									<span class="font-medium text-gray-900"
										>{event.occupancy_percent}%</span
									>
								</div>
							</div>
						{/if}
					</div>
					<div class="mt-4">
						<button
							type="button"
							class="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
							on:click={() => openEventModal(event.id)}
						>
							{$_('events.viewDetails')}
						</button>
					</div>
				</div>
			{/each}

			{#if eventStats.length === 0}
				<div class="py-8 text-center text-gray-500">
					{$_('admin.statsPage.noPastEvents')}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Модальное окно просмотра мероприятия -->
{#if selectedEventId !== null}
	<EventViewModal
		isOpen={isEventModalOpen}
		eventId={selectedEventId}
		on:close={closeEventModal}
	/>
{/if}
