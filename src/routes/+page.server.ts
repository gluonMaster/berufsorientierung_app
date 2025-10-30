/**
 * Server-side загрузка данных для главной страницы
 *
 * Загружает активные мероприятия с подсчётом статистики:
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
 * Расширенная информация о мероприятии для главной страницы
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
			throw new Error('Database not available');
		}

		// Получаем активные мероприятия
		const activeEvents = await getActiveEvents(db);

		// Получаем ID пользователя через JWT токен из cookies
		let userId: number | undefined;

		if (jwtSecret) {
			const token = extractTokenFromRequest(request);
			if (token) {
				const payload = await verifyToken(token, jwtSecret);
				if (payload) {
					userId = payload.userId;
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

				// Вычисляем оставшиеся места
				const spotsLeft = event.max_participants - registeredCount;

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
					const isRegistered = await isUserRegistered(db, userId, event.id);
					eventWithStats.isUserRegistered = isRegistered;
				}

				return eventWithStats;
			})
		);

		return {
			events: eventsWithStats,
		};
	} catch (error) {
		console.error('Error loading homepage data:', error);

		// Возвращаем пустой массив в случае ошибки
		// SvelteKit автоматически обработает это в +page.svelte
		return {
			events: [],
		};
	}
};
