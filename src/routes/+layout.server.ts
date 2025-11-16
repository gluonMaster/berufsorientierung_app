/**
 * Root Layout Server Load
 * Загружает данные текущего пользователя для всех страниц приложения
 * + инициализирует язык для SSR
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
 * Определяет предпочитаемый язык из заголовка Accept-Language
 */
function detectLanguageFromHeaders(request: Request): string {
	try {
		const acceptLanguage = request.headers.get('Accept-Language');
		if (!acceptLanguage) return DEFAULT_LANGUAGE;

		// Парсим Accept-Language заголовок (например: "de-DE,de;q=0.9,en;q=0.8")
		const languages = acceptLanguage
			.split(',')
			.map((lang) => {
				const parts = lang.trim().split(';');
				const code = parts[0].split('-')[0].toLowerCase();
				return code;
			})
			.filter((code) => SUPPORTED_LANGUAGES.includes(code as any));

		// Возвращаем первый поддерживаемый язык или дефолтный
		return languages[0] || DEFAULT_LANGUAGE;
	} catch (error) {
		console.error('Ошибка определения языка:', error);
		return DEFAULT_LANGUAGE;
	}
}

/**
 * Load функция для корневого layout
 * Проверяет авторизацию пользователя и возвращает его данные
 * НЕ редиректит неавторизованных - это публичное приложение
 */
export const load: ServerLoad = async ({ request, platform, cookies }) => {
	// Определяем язык: из cookie > из заголовка > дефолтный
	const storedLanguage = cookies.get('berufsorientierung_language');
	const locale =
		storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as any)
			? storedLanguage
			: detectLanguageFromHeaders(request);
	// Извлекаем токен из cookies
	const token = extractTokenFromRequest(request);

	// Если токена нет - возвращаем null user
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

		// Проверяем является ли пользователь админом
		const userIsAdmin = await isAdmin(db, user.id);

		// Возвращаем данные пользователя с флагом admin
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
