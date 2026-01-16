/**
 * Profile page - Server-side logic
 * Загрузка данных пользователя, регистраций и обработка actions
 */

import { error, fail, redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { DB } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';
import type { ReviewStatus } from '$lib/types/review';

/**
 * Load функция - загружает данные профиля
 *
 * Требует аутентификации (requireAuth)
 * Загружает:
 * - Данные пользователя
 * - Список регистраций пользователя с информацией о мероприятиях
 * - Статусы отзывов для каждого мероприятия
 * - Информацию о запланированном удалении (если есть)
 */
export const load = async ({ request, platform }: RequestEvent) => {
	if (!platform?.env?.DB || !platform?.env?.JWT_SECRET) {
		throw error(500, 'Server configuration error');
	}

	// Проверяем аутентификацию
	const user = await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);

	if (!platform?.env?.DB) {
		throw error(500, 'Database not available');
	}

	try {
		// 1. Загружаем регистрации пользователя
		const registrations = await DB.registrations.getUserRegistrations(platform.env.DB, user.id);

		// 2. Получаем статусы отзывов для всех мероприятий
		const eventIds = registrations.map((r) => r.event_id);
		const reviewsMap = await DB.reviews.getUserReviewsByEventIds(
			platform.env.DB,
			user.id,
			eventIds
		);

		// 3. Расширяем registrations информацией об отзывах
		const registrationsWithReviews = registrations.map((r) => {
			const reviewInfo = reviewsMap.get(r.event_id);
			return {
				...r,
				review_id: reviewInfo?.review_id || null,
				review_status: (reviewInfo?.status || null) as ReviewStatus | null,
			};
		});

		// 4. Проверяем есть ли запланированное удаление
		const allScheduled = await DB.gdpr.getScheduledDeletions(platform.env.DB);
		const pendingDeletion = allScheduled.find((item) => item.user_id === user.id) || null;

		return {
			user,
			registrations: registrationsWithReviews,
			pendingDeletion,
		};
	} catch (err) {
		console.error('Error loading profile:', err);

		// Если ошибка уже типа Error от SvelteKit, пробрасываем её
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to load profile data');
	}
};

/**
 * Form actions для обработки обновления и удаления профиля
 */
export const actions = {
	/**
	 * Update action - обновление профиля
	 *
	 * Вызывает API endpoint /api/profile/update
	 * При успехе возвращает success с сообщением
	 * При ошибке возвращает fail с деталями
	 */
	update: async ({ request, fetch, platform }: RequestEvent) => {
		if (!platform?.env?.DB || !platform?.env?.JWT_SECRET) {
			return fail(500, { error: 'Server configuration error' });
		}

		try {
			// Проверяем аутентификацию
			await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);

			// Получаем данные формы
			const formData = await request.formData();

			// Отправляем данные на API endpoint
			const response = await fetch('/api/profile/update', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(Object.fromEntries(formData)),
			});

			const result = await response.json();

			if (!response.ok) {
				return fail(response.status, {
					error: result.error || 'Failed to update profile',
					fields: Object.fromEntries(formData),
				});
			}

			return {
				success: true,
			};
		} catch (err: any) {
			console.error('Error in update action:', err);

			if (err.status === 401) {
				return fail(401, { error: 'Unauthorized' });
			}

			return fail(500, {
				error: 'An error occurred while updating profile',
			});
		}
	},

	/**
	 * Delete action - удаление профиля
	 *
	 * Вызывает API endpoint /api/profile/delete
	 * Результат: профиль удалён сразу (редирект на главную)
	 */
	delete: async ({ request, fetch, platform }: RequestEvent) => {
		if (!platform?.env?.DB || !platform?.env?.JWT_SECRET) {
			return fail(500, { error: 'Server configuration error' });
		}

		try {
			// Проверяем аутентификацию
			await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);

			// Отправляем запрос на удаление
			const response = await fetch('/api/profile/delete', {
				method: 'POST',
			});

			const result = await response.json();

			if (!response.ok) {
				return fail(response.status, {
					error: result.error || 'Failed to delete profile',
				});
			}

			// Удаление всегда немедленное — редирект на главную
			throw redirect(303, '/?deleted=true');
		} catch (err: any) {
			// Проверяем, что это не redirect (который тоже throw)
			if (err?.status === 303) {
				throw err;
			}

			console.error('Error in delete action:', err);

			if (err?.status === 401) {
				return fail(401, { error: 'Unauthorized' });
			}

			return fail(500, {
				error: 'An error occurred while deleting profile',
			});
		}
	},
};
