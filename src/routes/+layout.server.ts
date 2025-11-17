/**
 * Root Layout Server Load
 * Загружает данные текущего пользователя для всех страниц приложения
 * + инициализирует язык для SSR
 * Язык: cookie → user.preferred_language → DEFAULT_LANGUAGE
 */

import type { ServerLoad } from '@sveltejs/kit';
import type { User } from '$lib/types';
import { getUserById } from '$lib/server/db/users';

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
export const load: ServerLoad = async ({ locals, platform, cookies }) => {
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

	// Шаг 2: Проверяем, есть ли пользователь в locals (заполнен в hooks.server.ts)
	if (locals.user) {
		// Используем уже готовые данные из hooks.server.ts
		// Но нам нужны полные данные пользователя (включая preferred_language)
		// Поэтому загружаем полный профиль из БД
		const db = platform?.env?.DB;
		if (!db) {
			console.error('DB не настроена');
			return { user: null, locale } satisfies RootLayoutData;
		}

		try {
			const fullUser = await getUserById(db, locals.user.id);
			if (!fullUser) {
				// Пользователь не найден (возможно удалён)
				return { user: null, locale } satisfies RootLayoutData;
			}

			// Проверяем заблокирован ли пользователь (дополнительная проверка)
			if (fullUser.is_blocked) {
				return { user: null, locale } satisfies RootLayoutData;
			}

			// Если cookie не было, но у пользователя есть preferred_language - используем его
			if (!storedLanguage && fullUser.preferred_language) {
				locale = fullUser.preferred_language;

				// Сохраняем язык пользователя в cookie для следующих запросов
				cookies.set('berufsorientierung_language', locale, {
					path: '/',
					maxAge: 60 * 60 * 24 * 365, // 1 год
					sameSite: 'lax',
				});
			}

			// Возвращаем данные пользователя с флагом admin из locals (уже проверен в hooks)
			return {
				user: {
					...fullUser,
					isAdmin: locals.user.isAdmin,
				},
				locale,
			} satisfies RootLayoutData;
		} catch (error) {
			console.error('Ошибка загрузки полного профиля пользователя:', error);
			return { user: null, locale } satisfies RootLayoutData;
		}
	}

	// Шаг 3: Если locals.user нет - пользователь не авторизован
	// Возвращаем null user с языком из cookie или дефолтным
	return {
		user: null,
		locale,
	} satisfies RootLayoutData;
};
