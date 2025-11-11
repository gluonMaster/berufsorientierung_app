<script lang="ts">
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import { currentLanguage } from '$lib/stores/language';

	// Тип данных из +page.server.ts
	export let data: {
		events: Array<{
			id: number;
			title_de: string;
			title_en: string | null;
			title_ru: string | null;
			title_uk: string | null;
			date: string;
			status: string;
		}>;
		stats: {
			total_users: number;
			users_with_registrations: number;
			users_with_upcoming_events: number;
		};
		countsByEvent: Record<number, number>;
	};

	// Шаги формы
	let currentStep = 1;

	// Шаг 1: Выбор получателей
	let recipientType: 'all' | 'event' | 'upcoming' | 'custom' = 'all';
	let selectedEventId: string | null = '';
	let customEmails = '';

	// Шаг 2: Создание письма
	let emailLanguage: 'de' | 'en' | 'ru' | 'uk' = 'de';
	let emailSubject = '';
	let emailText = '';

	// Шаг 3: Отправка
	let sending = false;
	let sendProgress = 0;
	let sendTotal = 0;
	let currentBatch = 0;
	let totalBatches = 0;
	let sendResult: { success: boolean; sent: number; failed: number } | null = null;

	// Вычисление количества получателей
	$: recipientCount = getRecipientCount();

	function getRecipientCount(): number {
		switch (recipientType) {
			case 'all':
				return data.stats.total_users;
			case 'event':
				// Используем данные countsByEvent для конкретного мероприятия
				if (selectedEventId && data.countsByEvent) {
					return data.countsByEvent[Number(selectedEventId)] || 0;
				}
				return 0;
			case 'upcoming':
				return data.stats.users_with_upcoming_events;
			case 'custom':
				return customEmails
					.split(',')
					.map((e) => e.trim())
					.filter((e) => e.length > 0).length;
			default:
				return 0;
		}
	}

	// Получение заголовка события на текущем языке
	function getEventTitle(event: any, lang: string): string {
		return event[`title_${lang}`] || event.title_de;
	}

	// Переход к следующему шагу
	function nextStep() {
		if (currentStep === 1) {
			// Валидация шага 1
			if (recipientType === 'event' && !selectedEventId) {
				alert($_('admin.newsletter.select_event_error'));
				return;
			}
			if (recipientType === 'custom' && customEmails.trim().length === 0) {
				alert($_('admin.newsletter.enter_emails_error'));
				return;
			}
		} else if (currentStep === 2) {
			// Валидация шага 2
			if (emailSubject.trim().length < 3) {
				alert($_('admin.newsletter.subject_too_short'));
				return;
			}
			if (emailText.trim().length < 10) {
				alert($_('admin.newsletter.text_too_short'));
				return;
			}
		}

		currentStep++;
	}

	// Возврат к предыдущему шагу
	function prevStep() {
		currentStep--;
		sendResult = null;
	}

	// Отправка рассылки через SSE для прогресса
	async function sendNewsletter() {
		if (!confirm($_('admin.newsletter.confirm_send'))) {
			return;
		}

		sending = true;
		sendProgress = 0;
		sendTotal = recipientCount;
		currentBatch = 0;
		totalBatches = 0;
		sendResult = null;

		try {
			// Подготовка данных
			const payload: any = {
				recipientType,
				language: emailLanguage,
				subject: emailSubject,
				text: emailText,
			};

			if (recipientType === 'event') {
				payload.eventId = selectedEventId ? Number(selectedEventId) : null;
			} else if (recipientType === 'custom') {
				payload.customEmails = customEmails
					.split(',')
					.map((e) => e.trim())
					.filter((e) => e.length > 0);
			}

			// Если получателей мало (<=150), используем обычный endpoint без SSE
			if (recipientCount <= 150) {
				const response = await fetch('/api/admin/newsletter/send', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				if (response.ok) {
					const result = await response.json();
					sendResult = result;
				} else {
					const error = await response.json();
					alert(error.message || $_('admin.newsletter.send_error'));
				}
			} else {
				// Используем SSE для больших рассылок
				const response = await fetch('/api/admin/newsletter/send-stream', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					throw new Error('Failed to start newsletter stream');
				}

				// Обрабатываем SSE stream
				const reader = response.body?.getReader();
				const decoder = new TextDecoder();

				if (!reader) {
					throw new Error('No stream reader available');
				}

				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();

					if (done) break;

					// Декодируем чанк
					buffer += decoder.decode(value, { stream: true });

					// Обрабатываем полные SSE сообщения
					const lines = buffer.split('\n\n');
					buffer = lines.pop() || ''; // Сохраняем неполное сообщение

					for (const line of lines) {
						if (!line.trim()) continue;

						// Парсим SSE сообщение
						const eventMatch = line.match(/^event: (.+)$/m);
						const dataMatch = line.match(/^data: (.+)$/m);

						if (eventMatch && dataMatch) {
							const event = eventMatch[1];
							const data = JSON.parse(dataMatch[1]);

							if (event === 'progress') {
								// Обновляем прогресс
								sendProgress = data.sent;
								currentBatch = data.batch;
								totalBatches = data.totalBatches;
								console.log('[Newsletter] Progress:', data);
							} else if (event === 'complete') {
								// Рассылка завершена
								sendResult = {
									success: true,
									sent: data.sent,
									failed: data.failed,
								};
								console.log('[Newsletter] Complete:', data);
							} else if (event === 'error') {
								// Ошибка
								throw new Error(data.message);
							}
						}
					}
				}
			}
		} catch (err) {
			console.error('Newsletter send error:', err);
			alert($_('admin.newsletter.send_error'));
			sendResult = { success: false, sent: 0, failed: recipientCount };
		} finally {
			sending = false;
		}
	}

	// Сброс формы
	function resetForm() {
		currentStep = 1;
		recipientType = 'all';
		selectedEventId = '';
		customEmails = '';
		emailLanguage = 'de';
		emailSubject = '';
		emailText = '';
		sendResult = null;
	}
</script>

<svelte:head>
	<title>{$_('admin.newsletter.title')} - {$_('admin.title')}</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">{$_('admin.newsletter.title')}</h1>
		<p class="text-gray-600 mt-2">{$_('admin.newsletter.description')}</p>
	</div>

	<!-- Индикатор шагов -->
	<div class="mb-8">
		<div class="flex items-center justify-between">
			{#each [1, 2, 3] as step}
				<div class="flex items-center flex-1">
					<div
						class="w-10 h-10 rounded-full flex items-center justify-center font-semibold {currentStep >=
						step
							? 'bg-blue-600 text-white'
							: 'bg-gray-300 text-gray-600'}"
					>
						{step}
					</div>
					{#if step < 3}
						<div
							class="flex-1 h-1 mx-2 {currentStep > step
								? 'bg-blue-600'
								: 'bg-gray-300'}"
						></div>
					{/if}
				</div>
			{/each}
		</div>
		<div class="flex justify-between mt-2 text-sm">
			<span class={currentStep >= 1 ? 'text-blue-600 font-semibold' : 'text-gray-600'}>
				{$_('admin.newsletter.step1_title')}
			</span>
			<span class={currentStep >= 2 ? 'text-blue-600 font-semibold' : 'text-gray-600'}>
				{$_('admin.newsletter.step2_title')}
			</span>
			<span class={currentStep >= 3 ? 'text-blue-600 font-semibold' : 'text-gray-600'}>
				{$_('admin.newsletter.step3_title')}
			</span>
		</div>
	</div>

	<!-- Контент шагов -->
	<div class="bg-white rounded-lg shadow p-6">
		<!-- Шаг 1: Выбор получателей -->
		{#if currentStep === 1}
			<h2 class="text-xl font-bold mb-4">{$_('admin.newsletter.step1_title')}</h2>

			<div class="space-y-4">
				<!-- Все пользователи -->
				<label
					class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
				>
					<input type="radio" bind:group={recipientType} value="all" class="mt-1 mr-3" />
					<div class="flex-1">
						<div class="font-semibold">{$_('admin.newsletter.all_users')}</div>
						<div class="text-sm text-gray-600">
							{$_('admin.newsletter.all_users_count')}: {data.stats.total_users}
						</div>
					</div>
				</label>

				<!-- Зарегистрированные на мероприятие -->
				<label
					class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
				>
					<input
						type="radio"
						bind:group={recipientType}
						value="event"
						class="mt-1 mr-3"
					/>
					<div class="flex-1">
						<div class="font-semibold">{$_('admin.newsletter.event_users')}</div>
						<div class="text-sm text-gray-600 mb-2">
							{$_('admin.newsletter.event_users_description')}
						</div>
						{#if recipientType === 'event'}
							<select
								bind:value={selectedEventId}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
							>
								<option value="">{$_('admin.newsletter.select_event')}</option>
								{#each data.events as event}
									<option value={event.id}>
										{getEventTitle(event, $currentLanguage)} -
										{new Date(event.date).toLocaleDateString()}
										{#if data.countsByEvent && data.countsByEvent[event.id]}
											({data.countsByEvent[event.id]}
											{$_('admin.newsletter.participants')})
										{:else}
											(0 {$_('admin.newsletter.participants')})
										{/if}
									</option>
								{/each}
							</select>
						{/if}
					</div>
				</label>

				<!-- Зарегистрированные на предстоящие мероприятия -->
				<label
					class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
				>
					<input
						type="radio"
						bind:group={recipientType}
						value="upcoming"
						class="mt-1 mr-3"
					/>
					<div class="flex-1">
						<div class="font-semibold">{$_('admin.newsletter.upcoming_users')}</div>
						<div class="text-sm text-gray-600">
							{$_('admin.newsletter.upcoming_users_count')}: {data.stats
								.users_with_upcoming_events}
						</div>
					</div>
				</label>

				<!-- Пользовательский список -->
				<label
					class="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
				>
					<input
						type="radio"
						bind:group={recipientType}
						value="custom"
						class="mt-1 mr-3"
					/>
					<div class="flex-1">
						<div class="font-semibold">{$_('admin.newsletter.custom_list')}</div>
						<div class="text-sm text-gray-600 mb-2">
							{$_('admin.newsletter.custom_list_description')}
						</div>
						{#if recipientType === 'custom'}
							<textarea
								bind:value={customEmails}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
								rows="4"
								placeholder="user1@example.com, user2@example.com, ..."
							></textarea>
						{/if}
					</div>
				</label>
			</div>

			<div class="mt-6 p-4 bg-blue-50 rounded-lg">
				<p class="text-blue-800 font-semibold">
					{$_('admin.newsletter.selected_recipients')}: {recipientCount}
				</p>
			</div>
		{/if}

		<!-- Шаг 2: Создание письма -->
		{#if currentStep === 2}
			<h2 class="text-xl font-bold mb-4">{$_('admin.newsletter.step2_title')}</h2>

			<div class="space-y-4">
				<!-- Язык письма -->
				<div>
					<label for="emailLanguage" class="block text-sm font-medium text-gray-700 mb-2">
						{$_('admin.newsletter.email_language')}
					</label>
					<select
						id="emailLanguage"
						bind:value={emailLanguage}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
					>
						<option value="de">Deutsch</option>
						<option value="en">English</option>
						<option value="ru">Русский</option>
						<option value="uk">Українська</option>
					</select>
				</div>

				<!-- Тема письма -->
				<div>
					<label for="emailSubject" class="block text-sm font-medium text-gray-700 mb-2">
						{$_('admin.newsletter.email_subject')}
					</label>
					<input
						type="text"
						id="emailSubject"
						bind:value={emailSubject}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
						placeholder={$_('admin.newsletter.subject_placeholder')}
					/>
				</div>

				<!-- Текст письма -->
				<div>
					<label for="emailText" class="block text-sm font-medium text-gray-700 mb-2">
						{$_('admin.newsletter.email_text')}
					</label>
					<textarea
						id="emailText"
						bind:value={emailText}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
						rows="12"
						placeholder={$_('admin.newsletter.text_placeholder')}
					></textarea>
					<p class="text-sm text-gray-500 mt-1">
						{$_('admin.newsletter.text_length')}: {emailText.length}
						{$_('admin.newsletter.characters')}
					</p>
				</div>

				<!-- Предпросмотр -->
				{#if emailSubject || emailText}
					<div class="mt-6 p-4 bg-gray-50 rounded-lg border">
						<h3 class="font-semibold mb-2">{$_('admin.newsletter.preview')}</h3>
						{#if emailSubject}
							<p class="font-semibold mb-2">
								<strong>{$_('admin.newsletter.subject')}:</strong>
								{emailSubject}
							</p>
						{/if}
						{#if emailText}
							<div class="whitespace-pre-wrap text-sm text-gray-700">{emailText}</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Шаг 3: Подтверждение и отправка -->
		{#if currentStep === 3}
			<h2 class="text-xl font-bold mb-4">{$_('admin.newsletter.step3_title')}</h2>

			{#if !sendResult}
				<div class="space-y-4">
					<!-- Сводка -->
					<div class="bg-gray-50 rounded-lg p-4">
						<h3 class="font-semibold mb-3">{$_('admin.newsletter.summary')}</h3>

						<div class="space-y-2 text-sm">
							<p>
								<strong>{$_('admin.newsletter.recipients')}:</strong>
								{recipientCount}
								{#if recipientType === 'all'}
									({$_('admin.newsletter.all_users')})
								{:else if recipientType === 'event'}
									({$_('admin.newsletter.event_users')})
								{:else if recipientType === 'upcoming'}
									({$_('admin.newsletter.upcoming_users')})
								{:else}
									({$_('admin.newsletter.custom_list')})
								{/if}
							</p>
							<p>
								<strong>{$_('admin.newsletter.language')}:</strong>
								{emailLanguage.toUpperCase()}
							</p>
							<p>
								<strong>{$_('admin.newsletter.subject')}:</strong>
								{emailSubject}
							</p>
						</div>
					</div>

					<!-- Предупреждение о батчинге -->
					{#if recipientCount > 150}
						<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
							<p class="text-yellow-800 text-sm">
								<strong>{$_('admin.newsletter.batching_warning')}</strong>
								{$_('admin.newsletter.batching_description')}
							</p>
						</div>
					{/if}

					<!-- Кнопка отправки -->
					{#if !sending}
						<button
							on:click={sendNewsletter}
							class="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition"
						>
							{$_('admin.newsletter.send_button')}
						</button>
					{:else}
						<div class="py-8">
							<!-- Прогресс-бар -->
							{#if sendTotal > 0}
								<div class="mb-6">
									<div class="flex justify-between text-sm text-gray-600 mb-2">
										<span>
											{$_('admin.newsletter.progress_sending')}
											{#if totalBatches > 0}
												(Batch {currentBatch}/{totalBatches})
											{/if}
										</span>
										<span>{sendProgress} / {sendTotal}</span>
									</div>
									<div
										class="w-full bg-gray-200 rounded-full h-4 overflow-hidden"
									>
										<div
											class="bg-blue-600 h-full transition-all duration-300 ease-out"
											style="width: {(sendProgress / sendTotal) * 100}%"
										></div>
									</div>
									<p class="text-center text-sm text-gray-600 mt-2">
										{Math.round((sendProgress / sendTotal) * 100)}%
									</p>
								</div>
							{/if}

							<!-- Спиннер -->
							<div class="text-center">
								<div
									class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
								></div>
								<p class="mt-4 text-gray-600">{$_('admin.newsletter.sending')}</p>
								{#if totalBatches > 1}
									<p class="text-sm text-gray-500 mt-2">
										{$_('admin.newsletter.batching_info')}
									</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Результат отправки -->
				<div class="text-center py-8">
					{#if sendResult.success}
						<div
							class="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4"
						>
							<svg
								class="w-8 h-8 text-green-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								></path>
							</svg>
						</div>
						<h3 class="text-2xl font-bold text-green-600 mb-2">
							{$_('admin.newsletter.send_success')}
						</h3>
						<p class="text-gray-600 mb-6">
							{$_('admin.newsletter.sent_count')}: {sendResult.sent}
							{#if sendResult.failed > 0}
								<br />
								{$_('admin.newsletter.failed_count')}: {sendResult.failed}
							{/if}
						</p>
					{:else}
						<div
							class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4"
						>
							<svg
								class="w-8 h-8 text-red-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								></path>
							</svg>
						</div>
						<h3 class="text-2xl font-bold text-red-600 mb-2">
							{$_('admin.newsletter.send_failed')}
						</h3>
						<p class="text-gray-600 mb-6">{$_('admin.newsletter.send_error')}</p>
					{/if}

					<button
						on:click={resetForm}
						class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
					>
						{$_('admin.newsletter.send_another')}
					</button>
				</div>
			{/if}
		{/if}

		<!-- Кнопки навигации -->
		{#if currentStep < 3 || (currentStep === 3 && !sendResult)}
			<div class="mt-6 flex justify-between">
				{#if currentStep > 1}
					<button
						on:click={prevStep}
						disabled={sending}
						class="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{$_('admin.newsletter.previous')}
					</button>
				{:else}
					<div></div>
				{/if}

				{#if currentStep < 3}
					<button
						on:click={nextStep}
						class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
					>
						{$_('admin.newsletter.next')}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
