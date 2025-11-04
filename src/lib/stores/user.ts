/**
 * User Store
 * Svelte store для управления состоянием текущего пользователя
 *
 * Хранит информацию о залогиненном пользователе и предоставляет
 * удобные методы для работы с ним.
 */

import { writable, derived } from 'svelte/store';
import type { UserProfile } from '$lib/types/user';

/**
 * Store с данными текущего пользователя
 * null - если пользователь не залогинен
 */
const userStore = writable<UserProfile | null>(null);

/**
 * Derived store - является ли пользователь залогиненным
 */
export const isLoggedInStore = derived(userStore, ($user) => $user !== null);

/**
 * Вспомогательная функция для проверки авторизации (non-reactive)
 * Возвращает текущее состояние без подписки на изменения
 */
export function isLoggedIn(): boolean {
	let currentUser: UserProfile | null = null;
	const unsubscribe = userStore.subscribe((value) => {
		currentUser = value;
	});
	unsubscribe();
	return currentUser !== null;
}

/**
 * Derived store - является ли пользователь заблокированным
 */
export const isBlocked = derived(userStore, ($user) => $user?.is_blocked ?? false);

/**
 * Derived store - полное имя пользователя
 */
export const fullName = derived(userStore, ($user) =>
	$user ? `${$user.first_name} ${$user.last_name}` : ''
);

/**
 * Устанавливает данные текущего пользователя
 *
 * @param user - Профиль пользователя
 */
export function setUser(user: UserProfile): void {
	userStore.set(user);
}

/**
 * Очищает данные текущего пользователя (logout)
 */
export function clearUser(): void {
	userStore.set(null);
}

/**
 * Обновляет поля профиля текущего пользователя
 *
 * @param updates - Частичные данные для обновления
 */
export function updateUser(updates: Partial<UserProfile>): void {
	userStore.update((currentUser) => {
		if (!currentUser) return null;
		return { ...currentUser, ...updates };
	});
}

/**
 * Экспорт основного store для прямого доступа (если нужно)
 * Используется с синтаксисом $user в Svelte компонентах
 */
export const user = {
	subscribe: userStore.subscribe,
	set: setUser,
	update: updateUser,
	clear: clearUser,
};
