/**
 * Admin Layout Server Load
 * Проверка прав администратора для доступа к админ-панели
 */

import { redirect, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/auth';
import { getDB } from '$lib/server/db';

export async function load({ request, platform }: RequestEvent) {
	try {
		// Получаем DB и JWT_SECRET безопасно
		const db = getDB(platform);
		const jwtSecret = platform?.env?.JWT_SECRET;

		if (!jwtSecret) {
			throw new Error('JWT_SECRET is not configured');
		}

		// Проверяем что пользователь авторизован И является администратором
		const user = await requireAdmin(request, db, jwtSecret);

		return {
			user,
		};
	} catch (error: any) {
		console.error('[Admin Layout] Ошибка при проверке прав администратора:', error);

		// Если пользователь не авторизован (401) или не админ (403)
		// Редиректим на главную страницу с сообщением об ошибке
		const errorMessage =
			error.status === 403
				? 'admin_access_required' // Нет прав администратора
				: 'login_required'; // Не авторизован

		throw redirect(303, `/?error=${errorMessage}`);
	}
}
