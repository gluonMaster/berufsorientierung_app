<script lang="ts">
	import { enhance } from '$app/forms';
	import { _, locale } from 'svelte-i18n';
	import { changeLanguage } from '$lib/stores/language';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { User } from '$lib/types';
	import type { ReviewStatus } from '$lib/types/review';

	// Типы данных из +page.server.ts
	export let data: {
		user: User;
		registrations: Array<{
			id: number;
			event_id: number;
			registered_at: string;
			cancelled_at: string | null;
			cancellation_reason: string | null;
			event_title_de: string;
			event_title_en: string | null;
			event_title_ru: string | null;
			event_title_uk: string | null;
			event_date: string;
			event_end_date: string | null;
			event_status: string;
			review_id: number | null;
			review_status: ReviewStatus | null;
		}>;
		pendingDeletion: { user_id: number; deletion_date: string; created_at: string } | null;
	};

	// ActionData из form actions
	export let form:
		| { success: boolean; message: string; error?: string; type?: string; deleteDate?: string }
		| null
		| undefined;

	// Состояние формы редактирования
	let isEditMode = false;
	let isUpdating = false;

	// Данные формы (копия из data.user)
	let formData = {
		firstName: data.user.first_name,
		lastName: data.user.last_name,
		email: data.user.email,
		birthDate: data.user.birth_date,
		addressStreet: data.user.address_street || '',
		addressNumber: data.user.address_number || '',
		addressZip: data.user.address_zip || '',
		addressCity: data.user.address_city || '',
		phone: data.user.phone,
		whatsapp: data.user.whatsapp || '',
		telegram: data.user.telegram || '',
		photoVideoConsent: data.user.photo_video_consent,
		preferredLanguage: data.user.preferred_language,
		parentalConsent: data.user.parental_consent || false,
	};

	// Вычисляем возраст пользователя
	$: userAge = formData.birthDate
		? Math.floor(
				(new Date().getTime() - new Date(formData.birthDate).getTime()) /
					(1000 * 60 * 60 * 24 * 365.25)
			)
		: null;
	$: isMinor = userAge !== null && userAge < 18;

	// Модалы
	let showCancelModal = false;
	let selectedRegistrationId: number | null = null;
	let selectedRegistration: (typeof data.registrations)[0] | null = null;
	let showDeleteAccountModal = false;

	// Toast уведомления
	let toastMessage = '';
	let toastType: 'success' | 'error' = 'success';
	let showToast = false;

	// Обработка результата form action
	$: if (form) {
		if (form.success) {
			// Запоминаем новый язык ДО перезаписи formData (важно!)
			const newLanguage = formData.preferredLanguage;

			toastMessage = $_('profile.updateSuccess');
			toastType = 'success';
			showToast = true;
			isEditMode = false;
			isUpdating = false;

			// Обновляем данные формы из обновлённого пользователя
			if (data.user) {
				formData = {
					firstName: data.user.first_name,
					lastName: data.user.last_name,
					email: data.user.email,
					birthDate: data.user.birth_date,
					addressStreet: data.user.address_street || '',
					addressNumber: data.user.address_number || '',
					addressZip: data.user.address_zip || '',
					addressCity: data.user.address_city || '',
					phone: data.user.phone,
					whatsapp: data.user.whatsapp || '',
					telegram: data.user.telegram || '',
					photoVideoConsent: data.user.photo_video_consent,
					preferredLanguage: data.user.preferred_language,
					parentalConsent: data.user.parental_consent || false,
				};
			}

			// Переключаем язык на новый (выбранный пользователем в форме)
			changeLanguage(newLanguage as any);
		} else if (form.error) {
			// Более информативные сообщения об ошибках для delete action
			if (form.type === 'scheduled' && form.error) {
				// Ошибка при планировании отложенного удаления
				toastMessage = $_('profile.deleteErrorScheduled') || form.error;
			} else if (form.error.includes('delete') || form.error.includes('Delete')) {
				// Ошибка при немедленном удалении (если immediate не установлен)
				toastMessage = $_('profile.deleteErrorImmediate') || form.error;
			} else {
				// Общая ошибка (update или другие)
				toastMessage = form.error;
			}

			toastType = 'error';
			showToast = true;
			isUpdating = false;
		}
	}

	// Обработка успешного удаления с запланированной датой
	$: if (form?.type === 'scheduled' && form.deleteDate) {
		toastMessage = $_('profile.deleteScheduled', {
			values: { days: calculateDaysUntil(form.deleteDate) },
		});
		toastType = 'success';
		showToast = true;
	}

	// Функция для расчёта дней до удаления
	function calculateDaysUntil(dateString: string): number {
		const targetDate = new Date(dateString);
		const now = new Date();
		const diffTime = targetDate.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays > 0 ? diffDays : 0;
	}

	// Открытие модала отмены регистрации
	function openCancelModal(registrationId: number) {
		selectedRegistrationId = registrationId;
		selectedRegistration = data.registrations.find((r) => r.id === registrationId) || null;
		showCancelModal = true;
	}

	// Закрытие модала отмены
	function closeCancelModal() {
		showCancelModal = false;
		selectedRegistrationId = null;
		selectedRegistration = null;
	}

	// Отмена регистрации
	async function handleCancelRegistration() {
		if (!selectedRegistrationId) return;

		// Находим event_id по registration_id
		const registration = data.registrations.find((r) => r.id === selectedRegistrationId);
		if (!registration) {
			toastMessage = $_('errors.genericError');
			toastType = 'error';
			showToast = true;
			closeCancelModal();
			return;
		}

		try {
			const response = await fetch('/api/events/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: registration.event_id,
					cancellation_reason: 'User cancelled via profile',
				}),
			});

			const result = await response.json();

			if (response.ok) {
				toastMessage = $_('events.cancelSuccess');
				toastType = 'success';
				showToast = true;
				closeCancelModal();

				// Перезагружаем страницу для обновления списка
				window.location.reload();
			} else {
				toastMessage = result.error || $_('events.cancelError');
				toastType = 'error';
				showToast = true;
				closeCancelModal();
			}
		} catch (error) {
			console.error('Error cancelling registration:', error);
			toastMessage = $_('errors.genericError');
			toastType = 'error';
			showToast = true;
			closeCancelModal();
		}
	}

	// Определение статуса регистрации
	function getRegistrationStatus(registration: (typeof data.registrations)[0]) {
		if (registration.cancelled_at) {
			return {
				label: $_('profile.statusCancelled'),
				color: 'text-gray-500',
			};
		}

		const eventDate = new Date(registration.event_date);
		const now = new Date();

		if (eventDate < now) {
			return {
				label: $_('profile.statusPast'),
				color: 'text-gray-600',
			};
		}

		return {
			label: $_('profile.statusUpcoming'),
			color: 'text-green-600',
		};
	}

	// Проверка: можно ли отменить регистрацию
	function canCancelRegistration(registration: (typeof data.registrations)[0]): boolean {
		if (registration.cancelled_at) return false;

		const eventDate = new Date(registration.event_date);
		const now = new Date();
		const daysUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		return daysUntil > 3 && eventDate > now;
	}

	// Форматирование даты
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString($locale || 'de', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Выбор заголовка мероприятия по текущей локали с fallback на немецкий
	function displayTitle(registration: (typeof data.registrations)[0]): string {
		const lang = $locale || 'de';
		const key = `event_title_${lang}` as keyof typeof registration;
		const title = registration[key];

		// Если заголовок на текущем языке существует и не пустой, используем его
		if (title && typeof title === 'string' && title.trim()) {
			return title;
		}

		// Иначе возвращаем немецкий заголовок (он всегда есть)
		return registration.event_title_de;
	}

	// ====== ФУНКЦИИ ДЛЯ ОТЗЫВОВ ======

	/**
	 * Вычисляет окно возможности оставить отзыв
	 * Правила: старт = end_date - 45 минут, конец = start + 7 дней
	 */
	function getReviewWindow(endDate: string): { start: Date; end: Date } {
		const endDateTime = new Date(endDate);
		const start = new Date(endDateTime.getTime() - 45 * 60 * 1000);
		const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
		return { start, end };
	}

	/**
	 * Проверяет, находится ли текущее время внутри окна отзывов
	 */
	function isNowWithinReviewWindow(endDate: string): boolean {
		const now = new Date();
		const window = getReviewWindow(endDate);
		return now >= window.start && now <= window.end;
	}

	/**
	 * Проверяет, можно ли показать кнопку "Добавить отзыв"
	 */
	function canShowReviewButton(registration: (typeof data.registrations)[0]): boolean {
		// Не показываем если регистрация отменена
		if (registration.cancelled_at) return false;

		// Не показываем если мероприятие отменено
		if (registration.event_status === 'cancelled') return false;

		// Не показываем если нет end_date
		if (!registration.event_end_date) return false;

		// Не показываем если уже есть отзыв
		if (registration.review_status) return false;

		// Показываем только если внутри окна отзывов
		return isNowWithinReviewWindow(registration.event_end_date);
	}

	/**
	 * Получает бейдж статуса отзыва
	 */
	function getReviewStatusBadge(status: ReviewStatus): { label: string; colorClass: string } {
		switch (status) {
			case 'pending':
				return {
					label: $_('profile.reviews.status.pending'),
					colorClass: 'bg-yellow-100 text-yellow-800',
				};
			case 'approved':
				return {
					label: $_('profile.reviews.status.approved'),
					colorClass: 'bg-green-100 text-green-800',
				};
			case 'rejected':
				return {
					label: $_('profile.reviews.status.rejected'),
					colorClass: 'bg-red-100 text-red-800',
				};
			default:
				return { label: String(status), colorClass: 'bg-gray-100 text-gray-800' };
		}
	}
</script>

<svelte:head>
	<title>{$_('profile.myProfile')} - Berufsorientierung</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-6xl">
	<h1 class="text-3xl font-bold mb-8">{$_('profile.myProfile')}</h1>

	<!-- Уведомление о запланированном удалении -->
	{#if data.pendingDeletion}
		<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
			<h3 class="text-lg font-semibold text-red-800 mb-2">
				{$_('profile.accountScheduledForDeletion')}
			</h3>
			<p class="text-red-700">
				{$_('profile.deleteScheduled', {
					values: { days: calculateDaysUntil(data.pendingDeletion.deletion_date) },
				})}
			</p>
			<p class="text-sm text-red-600 mt-2">{$_('profile.accessBlocked')}</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
		<!-- СЕКЦИЯ A: Личные данные -->
		<div class="lg:col-span-2 space-y-8">
			<div class="bg-white rounded-lg shadow-md p-6">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-2xl font-semibold">{$_('profile.personalData')}</h2>
					{#if !isEditMode && !data.pendingDeletion}
						<Button variant="secondary" on:click={() => (isEditMode = true)}>
							{$_('common.edit')}
						</Button>
					{/if}
				</div>

				{#if !isEditMode}
					<!-- Режим просмотра -->
					<div class="space-y-4">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p class="text-sm text-gray-600">{$_('form.firstName')}</p>
								<p class="font-medium">{data.user.first_name}</p>
							</div>
							<div>
								<p class="text-sm text-gray-600">{$_('form.lastName')}</p>
								<p class="font-medium">{data.user.last_name}</p>
							</div>
						</div>

						<div>
							<p class="text-sm text-gray-600">{$_('form.email')}</p>
							<p class="font-medium">{data.user.email}</p>
						</div>

						<div>
							<p class="text-sm text-gray-600">{$_('form.birthDate')}</p>
							<p class="font-medium">{data.user.birth_date}</p>
						</div>

						<div>
							<p class="text-sm text-gray-600">{$_('form.address')}</p>
							<p class="font-medium">
								{data.user.address_street || '-'}
								{data.user.address_number || ''}
							</p>
							<p class="font-medium">
								{data.user.address_zip || '-'}
								{data.user.address_city || '-'}
							</p>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p class="text-sm text-gray-600">{$_('form.phone')}</p>
								<p class="font-medium">{data.user.phone}</p>
							</div>
							<div>
								<p class="text-sm text-gray-600">{$_('form.whatsapp')}</p>
								<p class="font-medium">{data.user.whatsapp || '-'}</p>
							</div>
						</div>

						<div>
							<p class="text-sm text-gray-600">{$_('form.telegram')}</p>
							<p class="font-medium">{data.user.telegram || '-'}</p>
						</div>

						<div>
							<p class="text-sm text-gray-600">{$_('profile.language')}</p>
							<p class="font-medium">{data.user.preferred_language.toUpperCase()}</p>
						</div>

						<!-- Данные опекуна (если есть) -->
						{#if data.user.guardian_first_name}
							<div class="pt-4 mt-4 border-t">
								<h3 class="text-lg font-semibold mb-3 text-gray-900">
									{$_('auth.guardianSectionTitle', {
										default: 'Данные родителя/опекуна',
									})}
								</h3>
								<div class="space-y-3">
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<p class="text-sm text-gray-600">
												{$_('form.guardianFirstName', {
													default: 'Имя опекуна',
												})}
											</p>
											<p class="font-medium">
												{data.user.guardian_first_name}
											</p>
										</div>
										<div>
											<p class="text-sm text-gray-600">
												{$_('form.guardianLastName', {
													default: 'Фамилия опекуна',
												})}
											</p>
											<p class="font-medium">
												{data.user.guardian_last_name || '-'}
											</p>
										</div>
									</div>
									<div>
										<p class="text-sm text-gray-600">
											{$_('form.guardianPhone', {
												default: 'Телефон опекуна',
											})}
										</p>
										<p class="font-medium">{data.user.guardian_phone || '-'}</p>
									</div>
								</div>
							</div>
						{/if}

						<div class="pt-4 border-t">
							<label class="flex items-center space-x-2">
								<input
									type="checkbox"
									checked={data.user.photo_video_consent}
									disabled
									class="rounded"
								/>
								<span class="text-sm">{$_('gdpr.photoConsent')}</span>
							</label>
						</div>
					</div>
				{:else}
					<!-- Режим редактирования -->
					<form
						method="POST"
						action="?/update"
						use:enhance={() => {
							isUpdating = true;
							return async ({ result, update }) => {
								isUpdating = false;
								if (result.type !== 'failure') {
									await update();
								}
							};
						}}
					>
						<div class="space-y-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									label={$_('form.firstName')}
									name="first_name"
									type="text"
									bind:value={formData.firstName}
									required
								/>
								<FormField
									label={$_('form.lastName')}
									name="last_name"
									type="text"
									bind:value={formData.lastName}
									required
								/>
							</div>

							<FormField
								label={$_('form.email')}
								name="email"
								type="email"
								bind:value={formData.email}
								required
							/>

							<FormField
								label={$_('form.birthDate')}
								name="birth_date"
								type="date"
								bind:value={formData.birthDate}
								required
							/>

							<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div class="col-span-2 md:col-span-2">
									<FormField
										label={$_('form.addressStreet')}
										name="address_street"
										type="text"
										bind:value={formData.addressStreet}
									/>
								</div>
								<div class="col-span-1">
									<FormField
										label={$_('form.addressNumber')}
										name="address_number"
										type="text"
										bind:value={formData.addressNumber}
									/>
								</div>
								<div class="col-span-1">
									<FormField
										label={$_('form.addressZip')}
										name="address_zip"
										type="text"
										bind:value={formData.addressZip}
									/>
								</div>
							</div>

							<FormField
								label={$_('form.addressCity')}
								name="address_city"
								type="text"
								bind:value={formData.addressCity}
							/>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									label={$_('form.phone')}
									name="phone"
									type="tel"
									bind:value={formData.phone}
									required
								/>
								<FormField
									label={$_('form.whatsapp')}
									name="whatsapp"
									type="tel"
									bind:value={formData.whatsapp}
								/>
							</div>

							<FormField
								label={$_('form.telegram')}
								name="telegram"
								type="text"
								bind:value={formData.telegram}
							/>

							<div>
								<label
									for="preferred_language"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									{$_('profile.language')}
								</label>
								<select
									id="preferred_language"
									name="preferred_language"
									bind:value={formData.preferredLanguage}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								>
									<option value="de">Deutsch</option>
									<option value="en">English</option>
									<option value="ru">Русский</option>
									<option value="uk">Українська</option>
								</select>
							</div>

							<div class="pt-4 border-t space-y-3">
								<label class="flex items-center space-x-2">
									<input
										type="checkbox"
										name="photo_video_consent"
										bind:checked={formData.photoVideoConsent}
										class="rounded"
									/>
									<span class="text-sm">{$_('gdpr.photoConsent')}</span>
								</label>

								{#if isMinor}
									<label class="flex items-center space-x-2">
										<input
											type="checkbox"
											name="parental_consent"
											bind:checked={formData.parentalConsent}
											class="rounded"
											required
										/>
										<span class="text-sm"
											>{$_('gdpr.parentalConsent')}
											<span class="text-red-500">*</span></span
										>
									</label>
									<p class="text-xs text-gray-600 ml-6">
										{$_('gdpr.parentalConsentRequired')}
									</p>
								{/if}
							</div>
						</div>

						<div class="flex gap-4 mt-6">
							<Button type="submit" loading={isUpdating}>
								{$_('common.save')}
							</Button>
							<Button
								variant="secondary"
								on:click={() => {
									isEditMode = false;
									// Сбрасываем изменения
									formData = {
										firstName: data.user.first_name,
										lastName: data.user.last_name,
										email: data.user.email,
										birthDate: data.user.birth_date,
										addressStreet: data.user.address_street || '',
										addressNumber: data.user.address_number || '',
										addressZip: data.user.address_zip || '',
										addressCity: data.user.address_city || '',
										phone: data.user.phone,
										whatsapp: data.user.whatsapp || '',
										telegram: data.user.telegram || '',
										photoVideoConsent: data.user.photo_video_consent,
										preferredLanguage: data.user.preferred_language,
										parentalConsent: data.user.parental_consent || false,
									};
								}}
							>
								{$_('common.cancel')}
							</Button>
						</div>
					</form>
				{/if}
			</div>

			<!-- СЕКЦИЯ B: Мои мероприятия -->
			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-2xl font-semibold mb-6">{$_('profile.myEvents')}</h2>

				{#if data.registrations.length === 0}
					<p class="text-gray-600">{$_('profile.noRegistrations')}</p>
				{:else}
					<!-- Desktop: Таблица -->
					<div class="hidden md:block overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-50">
								<tr>
									<th
										class="px-4 py-3 text-left text-sm font-semibold text-gray-700"
									>
										{$_('events.eventTitle')}
									</th>
									<th
										class="px-4 py-3 text-left text-sm font-semibold text-gray-700"
									>
										{$_('events.date')}
									</th>
									<th
										class="px-4 py-3 text-left text-sm font-semibold text-gray-700"
									>
										{$_('profile.status')}
									</th>
									<th
										class="px-4 py-3 text-left text-sm font-semibold text-gray-700"
									>
										{$_('common.actions')}
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200">
								{#each data.registrations as registration}
									{@const status = getRegistrationStatus(registration)}
									{@const canCancel = canCancelRegistration(registration)}
									{@const canReview = canShowReviewButton(registration)}
									<tr>
										<td class="px-4 py-4 text-sm">
											{displayTitle(registration)}
										</td>
										<td class="px-4 py-4 text-sm text-gray-600">
											{formatDate(registration.event_date)}
										</td>
										<td class="px-4 py-4 text-sm">
											<span class={status.color}>{status.label}</span>
										</td>
										<td class="px-4 py-4 text-sm">
											<div class="flex flex-wrap items-center gap-2">
												{#if canReview}
													<a
														href={`/events/${registration.event_id}/review`}
														class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
													>
														{$_('profile.reviews.add')}
													</a>
												{/if}
												{#if registration.review_status}
													{@const badge = getReviewStatusBadge(
														registration.review_status
													)}
													<span
														class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {badge.colorClass}"
													>
														{badge.label}
													</span>
												{/if}
												{#if canCancel}
													<button
														type="button"
														on:click={() =>
															openCancelModal(registration.id)}
														class="text-red-600 hover:text-red-700 font-medium"
													>
														{$_('common.cancel')}
													</button>
												{:else if !registration.cancelled_at && new Date(registration.event_date) > new Date() && !canReview && !registration.review_status}
													<span class="text-gray-400"
														>{$_('profile.cannotCancel')}</span
													>
												{:else if !canReview && !registration.review_status && !registration.cancelled_at}
													<span class="text-gray-400">-</span>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Mobile: Карточки -->
					<div class="md:hidden space-y-4">
						{#each data.registrations as registration}
							{@const status = getRegistrationStatus(registration)}
							{@const canCancel = canCancelRegistration(registration)}
							{@const canReview = canShowReviewButton(registration)}
							<div class="border border-gray-200 rounded-lg p-4">
								<h3 class="font-semibold mb-2">{displayTitle(registration)}</h3>
								<p class="text-sm text-gray-600 mb-2">
									{formatDate(registration.event_date)}
								</p>
								<p class="text-sm mb-3">
									<span class="font-medium">{$_('profile.status')}:</span>
									<span class={status.color}>{status.label}</span>
								</p>

								<!-- Бейдж статуса отзыва -->
								{#if registration.review_status}
									{@const badge = getReviewStatusBadge(
										registration.review_status
									)}
									<div class="mb-3">
										<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {badge.colorClass}"
										>
											{badge.label}
										</span>
									</div>
								{/if}

								<div class="flex flex-wrap gap-2">
									{#if canReview}
										<a
											href={`/events/${registration.event_id}/review`}
											class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors min-h-11"
										>
											{$_('profile.reviews.add')}
										</a>
									{/if}
									{#if canCancel}
										<Button
											variant="danger"
											size="sm"
											on:click={() => openCancelModal(registration.id)}
										>
											{$_('common.cancel')}
										</Button>
									{:else if !registration.cancelled_at && new Date(registration.event_date) > new Date() && !canReview && !registration.review_status}
										<p class="text-sm text-gray-400">
											{$_('profile.cannotCancel')}
										</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- СЕКЦИЯ C: Управление аккаунтом -->
		<div class="lg:col-span-1">
			<div class="bg-white rounded-lg shadow-md p-6 sticky top-4">
				<h2 class="text-xl font-semibold mb-4">{$_('profile.accountManagement')}</h2>

				<div class="space-y-4">
					<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
						<h3 class="font-semibold text-red-800 mb-2">
							{$_('profile.deleteProfile')}
						</h3>

						{#if data.pendingDeletion}
							<p class="text-sm text-red-700 mb-3">
								{$_('profile.deleteScheduled', {
									values: {
										days: calculateDaysUntil(
											data.pendingDeletion.deletion_date
										),
									},
								})}
							</p>
							<p class="text-sm text-red-600">{$_('profile.accessBlocked')}</p>
						{:else}
							<p class="text-sm text-gray-700 mb-4">{$_('gdpr.deleteExplanation')}</p>
							<Button
								variant="danger"
								on:click={() => (showDeleteAccountModal = true)}
							>
								{$_('profile.deleteProfile')}
							</Button>
						{/if}
					</div>

					<div class="text-xs text-gray-500 pt-4 border-t">
						<p class="mb-2">{$_('gdpr.dataRetention')}</p>
						<a href="/privacy" class="text-blue-600 hover:underline">
							{$_('gdpr.privacyPolicy')}
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Модал подтверждения отмены регистрации -->
<Modal
	isOpen={showCancelModal}
	onClose={closeCancelModal}
	title={$_('profile.cancelRegistrationTitle')}
>
	<div class="space-y-4">
		{#if selectedRegistration}
			<p class="mb-2">
				<strong>{$_('profile.eventTitle')}:</strong>
				{displayTitle(selectedRegistration)}
			</p>
			<p class="mb-2">
				<strong>{$_('form.date')}:</strong>
				{formatDate(selectedRegistration.event_date)}
			</p>
		{/if}
		<p class="mb-4">{$_('profile.cancelRegistrationConfirm')}</p>

		<div class="flex gap-4 justify-end">
			<Button variant="secondary" on:click={closeCancelModal}>{$_('common.cancel')}</Button>
			<Button variant="danger" on:click={handleCancelRegistration}>
				{$_('common.confirm')}
			</Button>
		</div>
	</div>
</Modal>

<!-- Модал подтверждения удаления аккаунта -->
<Modal
	isOpen={showDeleteAccountModal}
	onClose={() => (showDeleteAccountModal = false)}
	title={$_('profile.deleteAccountTitle')}
>
	<div class="space-y-4">
		<div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
			<p class="text-sm text-yellow-800 font-semibold mb-2">
				{$_('profile.deleteWarning')}
			</p>
			<p class="text-sm text-gray-700">{$_('gdpr.deleteExplanation')}</p>
		</div>

		<div class="text-sm text-gray-600">
			<p class="font-medium mb-2">{$_('profile.whatWillHappen')}:</p>
			<ul class="list-disc list-inside space-y-1 ml-2">
				<li>{$_('profile.deletePoint1')}</li>
				<li>{$_('profile.deletePoint2')}</li>
				<li>{$_('profile.deletePoint3')}</li>
			</ul>
		</div>

		<form method="POST" action="?/delete" use:enhance class="flex gap-4 justify-end">
			<Button variant="secondary" on:click={() => (showDeleteAccountModal = false)}>
				{$_('common.cancel')}
			</Button>
			<Button type="submit" variant="danger">{$_('profile.confirmDelete')}</Button>
		</form>
	</div>
</Modal>

<!-- Toast уведомления -->
{#if showToast}
	<Toast message={toastMessage} type={toastType} onClose={() => (showToast = false)} />
{/if}
