/**
 * Auth Middleware
 * Middleware для проверки аутентификации и авторизации в Cloudflare Workers
 *
 * Предоставляет утилиты для:
 * - Извлечения и верификации пользователя из запроса
 * - Проверки требования авторизации (requireAuth)
 * - Проверки прав администратора (requireAdmin)
 * - Получения IP адреса клиента в Cloudflare окружении
 */

import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';
import { getUserById } from '$lib/server/db/users';
import { isAdmin } from '$lib/server/db/admin';
import type { User } from '$lib/types';

// Тип D1Database доступен глобально через @cloudflare/workers-types
type D1Database = import('@cloudflare/workers-types').D1Database;

/**
 * Извлекает пользователя из запроса используя JWT токен из cookies
 *
 * Эта функция НЕ бросает ошибку - возвращает null если:
 * - Токен отсутствует
 * - Токен невалидный или просрочен
 * - Пользователь не найден в БД
 * - Пользователь заблокирован
 *
 * @param request - Объект Request
 * @param db - D1 Database инстанс
 * @param jwtSecret - Секретный ключ для верификации JWT (из env.JWT_SECRET)
 * @returns User объект или null
 *
 * @example
 * // В SvelteKit endpoint
 * export async function GET({ request, platform }) {
 *   const user = await getUserFromRequest(
 *     request,
 *     platform.env.DB,
 *     platform.env.JWT_SECRET
 *   );
 *
 *   if (user) {
 *     return json({ message: `Hello, ${user.first_name}` });
 *   } else {
 *     return json({ message: 'Hello, guest' });
 *   }
 * }
 */
export async function getUserFromRequest(
	request: Request,
	db: D1Database,
	jwtSecret: string
): Promise<User | null> {
	try {
		// Шаг 1: Извлекаем токен из cookies
		const token = extractTokenFromRequest(request);
		if (!token) {
			return null;
		}

		// Шаг 2: Верифицируем токен и получаем payload
		const payload = await verifyToken(token, jwtSecret);
		if (!payload || !payload.userId) {
			return null;
		}

		// Шаг 3: Загружаем пользователя из БД
		const user = await getUserById(db, payload.userId);
		if (!user) {
			return null;
		}

		// Шаг 4: Проверяем, не заблокирован ли пользователь
		if (user.is_blocked) {
			return null;
		}

		return user;
	} catch (error) {
		// Логируем ошибку, но НЕ бросаем её дальше
		console.error('[getUserFromRequest] Ошибка при получении пользователя:', error);
		return null;
	}
}

/**
 * Требует обязательной авторизации для доступа
 *
 * Бросает ошибку со статусом 401 если:
 * - Пользователь не авторизован
 * - Токен невалидный
 * - Пользователь заблокирован
 *
 * @param request - Объект Request
 * @param db - D1 Database инстанс
 * @param jwtSecret - Секретный ключ для верификации JWT
 * @returns User объект
 * @throws Error с { status: 401, message: 'Unauthorized' }
 *
 * @example
 * // В защищённом API endpoint
 * export async function POST({ request, platform }) {
 *   try {
 *     const user = await requireAuth(
 *       request,
 *       platform.env.DB,
 *       platform.env.JWT_SECRET
 *     );
 *
 *     // Пользователь авторизован, продолжаем работу
 *     return json({ user_id: user.id });
 *   } catch (error: any) {
 *     return json({ error: error.message }, { status: error.status || 500 });
 *   }
 * }
 */
export async function requireAuth(
	request: Request,
	db: D1Database,
	jwtSecret: string
): Promise<User> {
	const user = await getUserFromRequest(request, db, jwtSecret);

	if (!user) {
		// Создаём ошибку с расширенными свойствами
		const error = new Error('Unauthorized') as Error & { status: number };
		error.status = 401;
		throw error;
	}

	return user;
}

/**
 * Требует обязательной авторизации И прав администратора
 *
 * Бросает ошибку:
 * - 401 если пользователь не авторизован
 * - 403 если пользователь авторизован, но не является администратором
 *
 * @param request - Объект Request
 * @param db - D1 Database инстанс
 * @param jwtSecret - Секретный ключ для верификации JWT
 * @returns User объект (гарантированно администратор)
 * @throws Error с { status: 401 | 403 }
 *
 * @example
 * // В админском API endpoint
 * export async function DELETE({ request, platform, params }) {
 *   try {
 *     const admin = await requireAdmin(
 *       request,
 *       platform.env.DB,
 *       platform.env.JWT_SECRET
 *     );
 *
 *     // Администратор подтверждён, можно выполнять операцию
 *     await deleteEvent(platform.env.DB, Number(params.id));
 *     return json({ success: true });
 *   } catch (error: any) {
 *     return json({ error: error.message }, { status: error.status || 500 });
 *   }
 * }
 */
export async function requireAdmin(
	request: Request,
	db: D1Database,
	jwtSecret: string
): Promise<User> {
	// Шаг 1: Проверяем авторизацию (может бросить 401)
	const user = await requireAuth(request, db, jwtSecret);

	// Шаг 2: Проверяем права администратора
	const userIsAdmin = await isAdmin(db, user.id);

	if (!userIsAdmin) {
		// Создаём ошибку 403 Forbidden
		const error = new Error('Forbidden: Admin access required') as Error & { status: number };
		error.status = 403;
		throw error;
	}

	return user;
}

/**
 * Получает IP адрес клиента в Cloudflare Workers окружении
 *
 * Cloudflare автоматически добавляет заголовок 'CF-Connecting-IP' с реальным IP клиента.
 * Fallback на стандартные заголовки 'X-Forwarded-For' и 'X-Real-IP' если нужно.
 *
 * ВАЖНО: В Cloudflare Workers всегда используйте CF-Connecting-IP как наиболее надёжный источник.
 *
 * @param request - Объект Request
 * @returns IP адрес клиента или null если не удалось определить
 *
 * @example
 * // Логирование действия с IP адресом
 * const ip = getClientIP(request);
 * await logActivity(db, user.id, 'login', { ip });
 */
export function getClientIP(request: Request): string | null {
	// Шаг 1: Cloudflare добавляет заголовок CF-Connecting-IP (приоритетный)
	const cfIP = request.headers.get('cf-connecting-ip');
	if (cfIP) {
		return cfIP;
	}

	// Шаг 2: Fallback на X-Forwarded-For (может содержать список IP через запятую)
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		// Берём первый IP из списка (реальный клиент)
		const firstIP = forwardedFor.split(',')[0].trim();
		if (firstIP) {
			return firstIP;
		}
	}

	// Шаг 3: Fallback на X-Real-IP
	const realIP = request.headers.get('x-real-ip');
	if (realIP) {
		return realIP;
	}

	// Не удалось определить IP
	return null;
}
