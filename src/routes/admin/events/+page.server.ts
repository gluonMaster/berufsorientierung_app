// Серверная логика для страницы управления мероприятиями (админка)

import { DB, getDB } from '$lib/server/db';
import type { Event } from '$lib/types';

// Интерфейс мероприятия со статистикой регистраций
export interface EventWithStats extends Event {
	registeredCount: number;
	spotsLeft: number;
}

/**
 * Загрузка всех мероприятий с подсчетом регистраций
 */
export const load = async ({ platform }: { platform: App.Platform | undefined }) => {
	try {
		const database = getDB(platform);

		// Получить все мероприятия из БД (без пагинации для админки)
		const { events } = await DB.events.getAllEvents(database);

		// Дополнить каждое мероприятие статистикой регистраций
		const eventsWithStats: EventWithStats[] = await Promise.all(
			events.map(async (event: Event) => {
				// Подсчитать количество активных регистраций
				const registeredCount = await DB.registrations.getRegistrationCount(
					database,
					event.id
				);

				// Вычислить оставшиеся места
				const spotsLeft = event.max_participants
					? event.max_participants - registeredCount
					: Infinity;

				return {
					...event,
					registeredCount,
					spotsLeft,
				};
			})
		);

		return {
			events: eventsWithStats,
		};
	} catch (error) {
		console.error('Failed to load events:', error);
		return {
			events: [],
		};
	}
};
