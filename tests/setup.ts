/**
 * Настройка окружения для unit-тестов
 * Мокирование SvelteKit модулей и зависимостей
 */

import { vi } from 'vitest';

// Мокируем $app/environment для работы с browser-специфичным кодом
vi.mock('$app/environment', () => ({
	browser: false, // В тестах мы не в браузере
	dev: true,
	building: false,
	version: 'test',
}));

// Мокируем svelte-i18n для тестирования мультиязычности
vi.mock('svelte-i18n', () => ({
	init: vi.fn(),
	locale: {
		subscribe: vi.fn(),
		set: vi.fn(),
	},
	locales: {
		subscribe: vi.fn(),
	},
	getLocaleFromNavigator: vi.fn(() => 'de'),
	_: {
		subscribe: vi.fn(),
	},
	addMessages: vi.fn(),
}));
