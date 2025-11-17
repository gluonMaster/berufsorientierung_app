/**
 * Server-side загрузка данных для страницы списка мероприятий (/events)
 *
 * Переиспользует логику из главной страницы для отображения активных мероприятий.
 * Загружает мероприятия с подсчётом статистики:
 * - Количество записей
 * - Оставшиеся места
 * - Истёк ли дедлайн
 * - Записан ли текущий пользователь (если авторизован)
 */

import { getActiveEvents } from '$lib/server/db/events';
import { getRegistrationCount, isUserRegistered } from '$lib/server/db/registrations';
import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';
import type { Event } from '$lib/types/event';

/**
 * Расширенная информация о мероприятии для страницы списка
 */
export interface EventWithStats extends Event {
	/** Количество зарегистрированных участников */
	registeredCount: number;
	/** Оставшиеся места */
	spotsLeft: number;
	/** Истёк ли дедлайн регистрации */
	isDeadlinePassed: boolean;
	/** Записан ли текущий пользователь (только для авторизованных) */
	isUserRegistered?: boolean;
}

export const load = async ({ platform, request }: { platform: any; request: Request }) => {
	try {
		// Получаем D1 базу данных и JWT secret из platform
		const db = platform?.env?.DB;
		const jwtSecret = platform?.env?.JWT_SECRET;

		if (!db) {
			console.error('Database not available in /events');
			return { events: [] };
		}

		// Получаем активные мероприятия
		const activeEvents = await getActiveEvents(db);

		// Получаем ID пользователя через JWT токен из cookies
		let userId: number | undefined;

		if (jwtSecret) {
			const token = extractTokenFromRequest(request);
			if (token) {
				try {
					const payload = await verifyToken(token, jwtSecret);
					if (payload) {
						userId = payload.userId;
					}
				} catch (error) {
					// Токен невалидный или истёк - игнорируем, показываем мероприятия без статуса регистрации
					console.warn('Invalid or expired token in /events:', error);
				}
			}
		}

		// Текущее время для проверки дедлайна
		const now = new Date();

		// Обогащаем каждое мероприятие статистикой
		const eventsWithStats: EventWithStats[] = await Promise.all(
			activeEvents.map(async (event) => {
				// Получаем количество записей
				const registeredCount = await getRegistrationCount(db, event.id);

				// Вычисляем оставшиеся места (null = безлимит)
				const spotsLeft =
					event.max_participants !== null
						? event.max_participants - registeredCount
						: Infinity;

				// Проверяем истёк ли дедлайн
				const deadline = new Date(event.registration_deadline);
				const isDeadlinePassed = now > deadline;

				// Базовый объект со статистикой
				const eventWithStats: EventWithStats = {
					...event,
					registeredCount,
					spotsLeft,
					isDeadlinePassed,
				};

				// Если пользователь авторизован - проверяем записан ли он
				if (userId) {
					try {
						const isRegistered = await isUserRegistered(db, userId, event.id);
						eventWithStats.isUserRegistered = isRegistered;
					} catch (error) {
						// Ошибка проверки регистрации - не критично, просто не показываем статус
						console.warn(
							`Error checking registration for user ${userId} on event ${event.id}:`,
							error
						);
					}
				}

				return eventWithStats;
			})
		);

		return {
			events: eventsWithStats,
		};
	} catch (error) {
		console.error('Error loading events page data:', error);

		// Возвращаем пустой массив в случае ошибки
		// +page.svelte покажет сообщение "нет мероприятий"
		return {
			events: [],
		};
	}
};
