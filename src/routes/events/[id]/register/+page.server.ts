import { error, redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { DB } from '$lib/server/db';

export async function load({ params, url, request, platform }: any) {
	if (!platform) {
		throw error(500, 'Platform not available');
	}

	const { DB: database, JWT_SECRET } = platform.env;

	// Проверяем авторизацию
	let user;
	try {
		user = await requireAuth(request, database, JWT_SECRET);
	} catch (err) {
		throw redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	const eventId = parseInt(params.id);
	if (isNaN(eventId)) {
		throw error(400, 'Invalid event ID');
	}

	try {
		// Получаем мероприятие
		const event = await DB.events.getEventById(database, eventId);
		if (!event) {
			throw error(404, 'Event not found');
		}

		// Получаем количество уже зарегистрированных пользователей
		const registrationsCount = await DB.registrations.getRegistrationCount(database, eventId);

		// Проверяем доступность регистрации через централизованную функцию
		const isOpen = DB.events.isRegistrationOpen(event, registrationsCount);

		if (!isOpen) {
			// Определяем конкретную причину для редиректа с понятной ошибкой
			if (event.status !== 'active') {
				throw redirect(302, '/?error=event_not_active');
			}

			const now = new Date();
			const deadline = new Date(event.registration_deadline);
			if (deadline <= now) {
				throw redirect(302, '/?error=registration_deadline_passed');
			}

			if (event.max_participants !== null && registrationsCount >= event.max_participants) {
				throw redirect(302, '/?error=event_full');
			}

			// Fallback для неизвестной причины
			throw redirect(302, '/?error=registration_closed');
		}

		// Проверяем, не записан ли пользователь уже
		const alreadyRegistered = await DB.registrations.isUserRegistered(
			database,
			user.id,
			eventId
		);

		if (alreadyRegistered) {
			throw redirect(302, '/?error=already_registered');
		}

		// Получаем полные данные пользователя (могут быть обновлены с момента входа)
		const fullUser = await DB.users.getUserById(database, user.id);
		if (!fullUser) {
			throw error(404, 'User not found');
		}

		// Получаем дополнительные поля мероприятия
		const additionalFields = await DB.eventFields.getEventFields(database, eventId);

		return {
			event,
			user: fullUser,
			additionalFields,
			availableSpots:
				event.max_participants !== null
					? event.max_participants - registrationsCount
					: Infinity,
		};
	} catch (err) {
		// Если это уже redirect или error - пробрасываем дальше
		if (err instanceof Response) {
			throw err;
		}

		console.error('Error loading event registration page:', err);
		throw error(500, 'Failed to load event registration page');
	}
}
