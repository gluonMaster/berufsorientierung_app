/**
 * Unit тесты для eventFields утилит
 * Тестируем работу с дополнительными полями мероприятий
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setEventFields, getEventFields, deleteEventFields } from '$lib/server/db/eventFields';

// Mock D1 Database для тестирования
let mockDb: any;
let mockData: any[] = [];

beforeEach(() => {
	mockData = [];

	mockDb = {
		prepare: (sql: string) => ({
			bind: (...params: any[]) => ({
				run: async () => {
					// Mock DELETE
					if (sql.includes('DELETE')) {
						const eventId = params[0];
						mockData = mockData.filter((item) => item.event_id !== eventId);
						return { success: true };
					}
					// Mock INSERT
					if (sql.includes('INSERT')) {
						const newId = mockData.length + 1;
						mockData.push({
							id: newId,
							event_id: params[0],
							field_key: params[1],
							field_type: params[2],
							field_options: params[3],
							required: params[4],
							label_de: params[5],
							label_en: params[6],
							label_ru: params[7],
							label_uk: params[8],
							placeholder_de: params[9],
							placeholder_en: params[10],
							placeholder_ru: params[11],
							placeholder_uk: params[12],
						});
						return { success: true };
					}
					return { success: true };
				},
				all: async () => {
					const eventId = params[0];
					const results = mockData.filter((item) => item.event_id === eventId);
					return { results };
				},
			}),
		}),
		batch: async (statements: any[]) => {
			// Выполняем все statements последовательно
			for (const stmt of statements) {
				await stmt.run();
			}
			return [];
		},
	};
});

describe('eventFields DB utilities', () => {
	describe('setEventFields', () => {
		it('должна добавить новые поля для мероприятия', async () => {
			await setEventFields(mockDb, 1, [
				{
					field_key: 'dietary',
					field_type: 'text',
					field_options: null,
					required: true,
					label_de: 'Ernährung',
					label_en: 'Diet',
					label_ru: 'Питание',
					label_uk: 'Харчування',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(1);
			expect(fields[0].field_key).toBe('dietary');
			expect(fields[0].required).toBe(true);
		});

		it('должна заменить существующие поля', async () => {
			// Добавляем первое поле
			await setEventFields(mockDb, 1, [
				{
					field_key: 'old_field',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Altes Feld',
					label_en: 'Old Field',
					label_ru: 'Старое поле',
					label_uk: 'Старе поле',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			// Заменяем на новое поле
			await setEventFields(mockDb, 1, [
				{
					field_key: 'new_field',
					field_type: 'select',
					field_options: ['option1', 'option2'], // Передаём как массив
					required: true,
					label_de: 'Neues Feld',
					label_en: 'New Field',
					label_ru: 'Новое поле',
					label_uk: 'Нове поле',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(1);
			expect(fields[0].field_key).toBe('new_field');
			expect(fields[0].field_type).toBe('select');
			// Проверяем, что field_options корректно распарсились
			expect(fields[0].field_options).toEqual(['option1', 'option2']);
		});

		it('должна корректно сериализовать и десериализовать field_options (JSON round-trip)', async () => {
			// Передаём field_options как массив строк
			const inputOptions = ['vegetarisch', 'vegan', 'keine Einschränkungen'];

			await setEventFields(mockDb, 1, [
				{
					field_key: 'dietary',
					field_type: 'select',
					field_options: inputOptions, // Массив
					required: true,
					label_de: 'Ernährung',
					label_en: 'Diet',
					label_ru: 'Питание',
					label_uk: 'Харчування',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			// Проверяем, что в storage попала JSON строка
			const storedField = mockData.find((f) => f.field_key === 'dietary');
			expect(storedField).toBeDefined();
			expect(typeof storedField.field_options).toBe('string');
			expect(storedField.field_options).toBe(JSON.stringify(inputOptions));

			// Проверяем, что getEventFields вернул распарсенный массив
			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(1);
			expect(Array.isArray(fields[0].field_options)).toBe(true);
			expect(fields[0].field_options).toEqual(inputOptions);
		});

		it('должна удалить все поля при передаче пустого массива', async () => {
			// Добавляем поле
			await setEventFields(mockDb, 1, [
				{
					field_key: 'test',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Test',
					label_en: 'Test',
					label_ru: 'Тест',
					label_uk: 'Тест',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			// Удаляем все поля
			await setEventFields(mockDb, 1, []);

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(0);
		});
	});

	describe('getEventFields', () => {
		it('должна вернуть пустой массив если полей нет', async () => {
			const fields = await getEventFields(mockDb, 999);
			expect(fields).toHaveLength(0);
		});

		it('должна вернуть поля отсортированные по ID', async () => {
			await setEventFields(mockDb, 1, [
				{
					field_key: 'field1',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Feld 1',
					label_en: 'Field 1',
					label_ru: 'Поле 1',
					label_uk: 'Поле 1',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
				{
					field_key: 'field2',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Feld 2',
					label_en: 'Field 2',
					label_ru: 'Поле 2',
					label_uk: 'Поле 2',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(2);
			expect(fields[0].field_key).toBe('field1');
			expect(fields[1].field_key).toBe('field2');
		});

		it('должна корректно обработать битый JSON и вернуть null', async () => {
			// Вручную добавляем поле с невалидным JSON
			mockData.push({
				id: 1,
				event_id: 1,
				field_key: 'broken_field',
				field_type: 'select',
				field_options: '{invalid json[',
				required: 0,
				label_de: 'Broken',
				label_en: null,
				label_ru: null,
				label_uk: null,
				placeholder_de: null,
				placeholder_en: null,
				placeholder_ru: null,
				placeholder_uk: null,
			});

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(1);
			// При ошибке парсинга должен вернуться null
			expect(fields[0].field_options).toBeNull();
		});

		it('должна вернуть null для пустой строки field_options', async () => {
			mockData.push({
				id: 1,
				event_id: 1,
				field_key: 'empty_field',
				field_type: 'text',
				field_options: '',
				required: 0,
				label_de: 'Empty',
				label_en: null,
				label_ru: null,
				label_uk: null,
				placeholder_de: null,
				placeholder_en: null,
				placeholder_ru: null,
				placeholder_uk: null,
			});

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(1);
			expect(fields[0].field_options).toBeNull();
		});
	});

	describe('deleteEventFields', () => {
		it('должна удалить все поля для мероприятия', async () => {
			// Добавляем поля
			await setEventFields(mockDb, 1, [
				{
					field_key: 'test',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Test',
					label_en: 'Test',
					label_ru: 'Тест',
					label_uk: 'Тест',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			// Удаляем
			await deleteEventFields(mockDb, 1);

			const fields = await getEventFields(mockDb, 1);
			expect(fields).toHaveLength(0);
		});

		it('не должна влиять на поля других мероприятий', async () => {
			// Добавляем поля для двух мероприятий
			await setEventFields(mockDb, 1, [
				{
					field_key: 'test1',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Test 1',
					label_en: 'Test 1',
					label_ru: 'Тест 1',
					label_uk: 'Тест 1',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			await setEventFields(mockDb, 2, [
				{
					field_key: 'test2',
					field_type: 'text',
					field_options: null,
					required: false,
					label_de: 'Test 2',
					label_en: 'Test 2',
					label_ru: 'Тест 2',
					label_uk: 'Тест 2',
					placeholder_de: null,
					placeholder_en: null,
					placeholder_ru: null,
					placeholder_uk: null,
				},
			]);

			// Удаляем поля только для первого мероприятия
			await deleteEventFields(mockDb, 1);

			const fields1 = await getEventFields(mockDb, 1);
			const fields2 = await getEventFields(mockDb, 2);

			expect(fields1).toHaveLength(0);
			expect(fields2).toHaveLength(1);
		});
	});
});
