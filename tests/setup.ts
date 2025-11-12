/**
 * Настройка окружения для unit-тестов
 * Мокирование SvelteKit модулей и зависимостей
 */

import { vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { hashPassword } from '$lib/server/auth';

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

/**
 * Создаёт мок D1 Database для integration тестов
 *
 * ВАЖНО: Это упрощённый in-memory мок, не полноценная SQLite БД.
 * Для полноценного тестирования с реальной D1 используйте Miniflare или Wrangler.
 *
 * @returns Мок D1Database с базовыми таблицами
 */
export function createTestDB(): D1Database {
	// In-memory хранилище для тестов
	const storage = {
		users: [] as any[],
		events: [] as any[],
		registrations: [] as any[],
		admins: [] as any[],
		activity_log: [] as any[],
	};

	let nextUserId = 1;
	let nextEventId = 1;
	let nextRegistrationId = 1;

	// Мок D1Database с базовыми методами
	const mockDb = {
		prepare: (query: string) => {
			return {
				bind: (...params: any[]) => {
					return {
						first: async () => {
							// Простая логика для SELECT запросов
							if (
								query.includes('SELECT') &&
								query.includes('FROM users WHERE email')
							) {
								const email = params[0];
								return storage.users.find((u) => u.email === email) || null;
							}
							if (query.includes('SELECT') && query.includes('FROM users WHERE id')) {
								const id = params[0];
								return storage.users.find((u) => u.id === id) || null;
							}
							if (
								query.includes('SELECT') &&
								query.includes('FROM events WHERE id')
							) {
								const id = params[0];
								return storage.events.find((e) => e.id === id) || null;
							}
							if (query.includes('SELECT') && query.includes('FROM registrations')) {
								// Поддержка различных запросов к registrations
								if (
									query.includes('WHERE user_id') &&
									query.includes('AND event_id')
								) {
									const userId = params[0];
									const eventId = params[1];
									return (
										storage.registrations.find(
											(r) =>
												r.user_id === userId &&
												r.event_id === eventId &&
												!r.cancelled_at
										) || null
									);
								}
								return storage.registrations[0] || null;
							}
							return null;
						},
						all: async () => {
							// Простая логика для SELECT запросов, возвращающих массив
							if (query.includes('SELECT') && query.includes('FROM events')) {
								return { results: storage.events };
							}
							if (query.includes('SELECT') && query.includes('FROM registrations')) {
								return { results: storage.registrations };
							}
							return { results: [] };
						},
						run: async () => {
							// Простая логика для INSERT/UPDATE/DELETE
							if (query.includes('INSERT INTO users')) {
								const newUser = {
									id: nextUserId++,
									email: params[0],
									password_hash: params[1],
									first_name: params[2],
									last_name: params[3],
									birth_date: params[4],
									address_street: params[5],
									address_number: params[6],
									address_zip: params[7],
									address_city: params[8],
									phone: params[9],
									whatsapp: params[10] || null,
									telegram: params[11] || null,
									photo_video_consent: params[12] || 0,
									parental_consent: params[13] || 0,
									preferred_language: params[14] || 'de',
									is_blocked: 0,
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								};
								storage.users.push(newUser);
								return { success: true, meta: { last_row_id: newUser.id } };
							}

							if (query.includes('INSERT INTO events')) {
								const newEvent = {
									id: nextEventId++,
									title_de: params[0],
									description_de: params[1] || null,
									requirements_de: params[2] || null,
									location_de: params[3] || null,
									date: params[4],
									registration_deadline: params[5],
									max_participants: params[6],
									status: params[7] || 'draft',
									created_by: params[8],
									telegram_link: null,
									whatsapp_link: null,
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								};
								storage.events.push(newEvent);
								return { success: true, meta: { last_row_id: newEvent.id } };
							}

							if (query.includes('INSERT INTO registrations')) {
								const newRegistration = {
									id: nextRegistrationId++,
									user_id: params[0],
									event_id: params[1],
									additional_data: params[2] || null,
									registered_at: new Date().toISOString(),
									cancelled_at: null,
									cancellation_reason: null,
								};
								storage.registrations.push(newRegistration);
								return { success: true, meta: { last_row_id: newRegistration.id } };
							}

							if (query.includes('DELETE FROM users WHERE id')) {
								const id = params[0];
								const index = storage.users.findIndex((u) => u.id === id);
								if (index !== -1) {
									storage.users.splice(index, 1);
									return { success: true, meta: { changes: 1 } };
								}
								return { success: true, meta: { changes: 0 } };
							}

							return { success: true };
						},
					};
				},
			};
		},
	} as unknown as D1Database;

	return mockDb;
}

/**
 * Заполняет тестовую БД начальными данными
 *
 * @param db - Мок D1Database
 * @returns Объект с созданными тестовыми данными
 */
export async function seedTestData(db: D1Database) {
	// Создаём тестовых пользователей
	const testPassword = 'TestPass123';
	const passwordHash = await hashPassword(testPassword);

	// Пользователь 1: взрослый (>18)
	await db
		.prepare(
			`INSERT INTO users (
			email, password_hash, first_name, last_name, birth_date,
			address_street, address_number, address_zip, address_city, phone,
			photo_video_consent, parental_consent, preferred_language
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			'adult@test.com',
			passwordHash,
			'John',
			'Doe',
			'1990-01-01',
			'Hauptstraße',
			'10',
			'01234',
			'Dresden',
			'+491234567890',
			1,
			0,
			'de'
		)
		.run();

	// Пользователь 2: несовершеннолетний (<18) с согласием родителей
	await db
		.prepare(
			`INSERT INTO users (
			email, password_hash, first_name, last_name, birth_date,
			address_street, address_number, address_zip, address_city, phone,
			photo_video_consent, parental_consent, preferred_language
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			'teen@test.com',
			passwordHash,
			'Jane',
			'Young',
			'2010-05-15',
			'Nebenstraße',
			'5',
			'01234',
			'Dresden',
			'+491234567891',
			0,
			1,
			'en'
		)
		.run();

	// Создаём тестовое мероприятие
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + 30);
	const deadline = new Date();
	deadline.setDate(deadline.getDate() + 20);

	await db
		.prepare(
			`INSERT INTO events (
			title_de, description_de, location_de, date, registration_deadline,
			max_participants, status, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			'Test Event',
			'Test event description',
			'Dresden',
			futureDate.toISOString(),
			deadline.toISOString(),
			20,
			'active',
			1
		)
		.run();

	return {
		users: [
			{ id: 1, email: 'adult@test.com', password: testPassword },
			{ id: 2, email: 'teen@test.com', password: testPassword },
		],
		events: [{ id: 1, title_de: 'Test Event' }],
		password: testPassword,
	};
}
