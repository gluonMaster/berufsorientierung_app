import type { RequestEvent } from '@sveltejs/kit';

/**
 * Результат проверки прав администратора
 */
export interface AdminCheckResult {
	success: boolean;
	error?: string;
	userId?: number; // ID пользователя-администратора (только при success: true)
}

/**
 * Middleware для проверки прав администратора
 *
 * @param platform - Cloudflare platform с bindings
 * @param locals - SvelteKit locals с данными пользователя
 * @returns Результат проверки с success/error
 */
export async function requireAdmin(
	platform: App.Platform | undefined,
	locals: App.Locals
): Promise<AdminCheckResult> {
	// Проверка авторизации
	if (!locals.user) {
		return {
			success: false,
			error: 'Требуется авторизация',
		};
	}

	// Проверка прав администратора
	if (!locals.user.isAdmin) {
		return {
			success: false,
			error: 'Доступ запрещен: требуются права администратора',
		};
	}

	return {
		success: true,
		userId: locals.user.id, // Возвращаем ID для логирования
	};
}

/**
 * Middleware для использования в load функциях
 * Бросает error если проверка не прошла
 *
 * @param event - RequestEvent из SvelteKit
 * @throws error(403) если нет прав
 */
export async function requireAdminOrThrow(event: RequestEvent): Promise<void> {
	const result = await requireAdmin(event.platform, event.locals);

	if (!result.success) {
		const { error } = await import('@sveltejs/kit');
		throw error(403, result.error || 'Access denied');
	}
}
