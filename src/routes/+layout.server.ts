/**
 * Root Layout Server Load
 * Загружает данные текущего пользователя для всех страниц приложения
 * + инициализирует язык для SSR
 * Язык: cookie → user.preferred_language → DEFAULT_LANGUAGE
 */

import type { ServerLoad } from '@sveltejs/kit';
import type { User } from '$lib/types';
import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';
import { getUserById } from '$lib/server/db/users';
import { isAdmin } from '$lib/server/db/admin';

/**
 * Тип данных, возвращаемых layout
 */
type RootLayoutData = {
	user: (User & { isAdmin: boolean }) | null;
	locale: string; // Язык для SSR
};

// Поддерживаемые языки
const SUPPORTED_LANGUAGES = ['de', 'en', 'ru', 'uk'] as const;
const DEFAULT_LANGUAGE = 'de';

/**
 * Load функция для корневого layout
 * Проверяет авторизацию пользователя и возвращает его данные
 * НЕ редиректит неавторизованных - это публичное приложение
 */
export const load: ServerLoad = async ({ request, platform, cookies }) => {
	// Шаг 1: Проверяем cookie с языком
	const storedLanguage = cookies.get('berufsorientierung_language');
	let locale: string;

	if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as any)) {
		// Если в cookie есть валидный язык - используем его
		locale = storedLanguage;
	} else {
		// Иначе - временно устанавливаем дефолт, но можем переопределить из профиля
		locale = DEFAULT_LANGUAGE;
	}

	// Извлекаем токен из cookies
	const token = extractTokenFromRequest(request);

	// Если токена нет - возвращаем null user с языком из cookie или дефолтным
	if (!token) {
		return {
			user: null,
			locale,
		} satisfies RootLayoutData;
	}

	try {
		// Проверяем JWT токен
		const jwtSecret = platform?.env?.JWT_SECRET;
		if (!jwtSecret) {
			console.error('JWT_SECRET не настроен');
			return { user: null, locale } satisfies RootLayoutData;
		}

		const payload = await verifyToken(token, jwtSecret);
		if (!payload) {
			// Токен невалидный или просрочен
			return { user: null, locale } satisfies RootLayoutData;
		}

		// Получаем полные данные пользователя из БД
		const db = platform?.env?.DB;
		if (!db) {
			console.error('DB не настроена');
			return { user: null, locale } satisfies RootLayoutData;
		}

		const user = await getUserById(db, payload.userId);
		if (!user) {
			// Пользователь не найден (возможно удалён)
			return { user: null, locale } satisfies RootLayoutData;
		}

		// Проверяем заблокирован ли пользователь
		if (user.is_blocked) {
			// Пользователь заблокирован - не возвращаем данные
			return { user: null, locale } satisfies RootLayoutData;
		}

		// Шаг 2: Если cookie не было, но у пользователя есть preferred_language - используем его
		if (!storedLanguage && user.preferred_language) {
			locale = user.preferred_language;

			// Сохраняем язык пользователя в cookie для следующих запросов
			cookies.set('berufsorientierung_language', locale, {
				path: '/',
				maxAge: 60 * 60 * 24 * 365, // 1 год
				sameSite: 'lax',
			});
		}

		// Проверяем является ли пользователь админом
		const userIsAdmin = await isAdmin(db, user.id);

		// Возвращаем данные пользователя с флагом admin и правильным locale
		return {
			user: {
				...user,
				isAdmin: userIsAdmin,
			},
			locale,
		} satisfies RootLayoutData;
	} catch (error) {
		// При любой ошибке возвращаем null user
		console.error('Ошибка загрузки данных пользователя:', error);
		return {
			user: null,
			locale,
		} satisfies RootLayoutData;
	}
};
