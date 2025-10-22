/**
 * Database утилиты для работы с дополнительными полями мероприятий
 * Prompt 2.4: Database утилиты - Additional Fields
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { EventAdditionalField, EventAdditionalFieldInput } from '$lib/types/event';

/**
 * Заменяет все дополнительные поля для мероприятия
 * Использует транзакцию для атомарности операции
 *
 * @param db - База данных D1
 * @param eventId - ID мероприятия
 * @param fields - Массив новых полей (если пустой - все поля будут удалены)
 *
 * @example
 * ```ts
 * await setEventFields(db, 1, [
 *   {
 *     field_key: 'dietary_requirements',
 *     field_type: 'select',
 *     field_options: ['vegetarisch', 'vegan', 'keine'], // Передаём как массив
 *     required: false,
 *     label_de: 'Ernährungseinschränkungen',
 *     label_en: 'Dietary requirements',
 *     label_ru: 'Диетические требования',
 *     label_uk: 'Дієтичні вимоги',
 *     placeholder_de: 'Bitte auswählen',
 *     placeholder_en: 'Please select',
 *     placeholder_ru: 'Пожалуйста, выберите',
 *     placeholder_uk: 'Будь ласка, оберіть'
 *   }
 * ]);
 * ```
 */
export async function setEventFields(
	db: D1Database,
	eventId: number,
	fields: EventAdditionalFieldInput[]
): Promise<void> {
	// Подготавливаем массив SQL-запросов для транзакции
	const statements = [];

	// 1. Удаляем все существующие поля для данного мероприятия
	statements.push(
		db.prepare('DELETE FROM event_additional_fields WHERE event_id = ?').bind(eventId)
	);

	// 2. Вставляем новые поля (если они есть)
	if (fields.length > 0) {
		for (const field of fields) {
			// Преобразуем field_options в JSON строку
			// field_options может быть массивом строк или null
			let fieldOptionsJson: string | null = null;
			if (field.field_options !== null) {
				fieldOptionsJson = JSON.stringify(field.field_options);
			}

			statements.push(
				db
					.prepare(
						`INSERT INTO event_additional_fields (
							event_id,
							field_key,
							field_type,
							field_options,
							required,
							label_de,
							label_en,
							label_ru,
							label_uk,
							placeholder_de,
							placeholder_en,
							placeholder_ru,
							placeholder_uk
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						eventId,
						field.field_key,
						field.field_type,
						fieldOptionsJson,
						field.required ? 1 : 0,
						field.label_de,
						field.label_en ?? null,
						field.label_ru ?? null,
						field.label_uk ?? null,
						field.placeholder_de ?? null,
						field.placeholder_en ?? null,
						field.placeholder_ru ?? null,
						field.placeholder_uk ?? null
					)
			);
		}
	}

	// Выполняем все операции в рамках одной транзакции
	await db.batch(statements);
}

/**
 * Получает все дополнительные поля для мероприятия
 * Поля сортируются по ID (порядок добавления)
 * Автоматически парсит field_options из JSON строки в массив
 *
 * @param db - База данных D1
 * @param eventId - ID мероприятия
 * @returns Массив дополнительных полей с распарсенными field_options
 *
 * @example
 * ```ts
 * const fields = await getEventFields(db, 1);
 * // [
 * //   {
 * //     id: 1,
 * //     event_id: 1,
 * //     field_key: 'dietary_requirements',
 * //     field_type: 'select',
 * //     field_options: ['vegetarisch', 'vegan', 'keine'], // Распарсенный массив
 * //     required: false,
 * //     label_de: 'Ernährungseinschränkungen',
 * //     ...
 * //   }
 * // ]
 * ```
 */
export async function getEventFields(
	db: D1Database,
	eventId: number
): Promise<EventAdditionalField[]> {
	// Тип для сырых данных из БД (field_options как строка)
	interface RawEventAdditionalField {
		id: number;
		event_id: number;
		field_key: string;
		field_type: string;
		field_options: string | null;
		required: number;
		label_de: string;
		label_en: string | null;
		label_ru: string | null;
		label_uk: string | null;
		placeholder_de: string | null;
		placeholder_en: string | null;
		placeholder_ru: string | null;
		placeholder_uk: string | null;
	}

	const result = await db
		.prepare(
			`SELECT 
				id,
				event_id,
				field_key,
				field_type,
				field_options,
				required,
				label_de,
				label_en,
				label_ru,
				label_uk,
				placeholder_de,
				placeholder_en,
				placeholder_ru,
				placeholder_uk
			FROM event_additional_fields
			WHERE event_id = ?
			ORDER BY id ASC`
		)
		.bind(eventId)
		.all<RawEventAdditionalField>();

	if (!result.results) {
		return [];
	}

	// Парсим field_options из JSON строки обратно в массив
	// И преобразуем required из числа (SQLite) в boolean
	return result.results.map((field) => {
		let parsedOptions: string[] | null = null;

		// Безопасный парсинг JSON с обработкой ошибок
		if (field.field_options !== null && field.field_options !== '') {
			try {
				const parsed = JSON.parse(field.field_options);
				// Проверяем, что распарсенное значение - массив строк
				if (Array.isArray(parsed)) {
					parsedOptions = parsed;
				}
			} catch (error) {
				console.error(
					`Failed to parse field_options for field ${field.id}:`,
					field.field_options,
					error
				);
				// Оставляем null при ошибке парсинга
				parsedOptions = null;
			}
		}

		return {
			...field,
			field_type: field.field_type as EventAdditionalField['field_type'],
			field_options: parsedOptions,
			// Преобразуем SQLite integer (0/1) в boolean
			required: Boolean(field.required),
		};
	});
}

/**
 * Удаляет все дополнительные поля для мероприятия
 * Используется при удалении самого мероприятия или при необходимости очистить все поля
 *
 * @param db - База данных D1
 * @param eventId - ID мероприятия
 *
 * @example
 * ```ts
 * await deleteEventFields(db, 1);
 * // Все поля для мероприятия с ID=1 удалены
 * ```
 */
export async function deleteEventFields(db: D1Database, eventId: number): Promise<void> {
	await db.prepare('DELETE FROM event_additional_fields WHERE event_id = ?').bind(eventId).run();
}
