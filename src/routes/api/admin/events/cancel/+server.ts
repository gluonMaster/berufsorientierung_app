/**
 * API Endpoint: POST /api/admin/events/cancel
 *
 * Отмена мероприятия администратором с автоматической рассылкой всем участникам
 *
 * Процесс отмены:
 * 1. Аутентификация и проверка прав администратора (обязательно)
 * 2. Валидация event_id и причины отмены
 * 3. Проверка существования мероприятия
 * 4. Проверка что мероприятие активно (не отменено ранее)
 * 5. Получение списка всех зарегистрированных пользователей
 * 6. Обновление всех активных регистраций (отметка как cancelled)
 * 7. Обновление статуса мероприятия на 'cancelled'
 * 8. Логирование действия
 * 9. Массовая рассылка уведомлений всем участникам (с батчингом)
 *
 * @returns 200 OK с результатами рассылки
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAdmin, getClientIP } from '$lib/server/middleware/auth';
import { handleApiError, errors } from '$lib/server/middleware/errorHandler';
import { getDB } from '$lib/server/db';
import { getEventById, cancelEvent } from '$lib/server/db/events';
import { getEventRegistrations } from '$lib/server/db/registrations';
import { getUserById } from '$lib/server/db/users';
import { logActivity } from '$lib/server/db/activityLog';
import { sendBulkEmails } from '$lib/server/email';
import { getEventCancelledByAdminEmail } from '$lib/server/email/templates';
import type { LanguageCode } from '$lib/types';

/**
 * Zod схема для валидации запроса на отмену мероприятия
 * Принимает как snake_case (event_id, cancellation_reason), так и camelCase (eventId, reason)
 * для совместимости с промптом 9.4 и текущим UI
 */
const cancelEventSchema = z
	.object({
		// snake_case (текущая реализация)
		event_id: z.number().int().positive('Event ID must be a positive integer').optional(),
		cancellation_reason: z
			.string()
			.min(10, 'Cancellation reason must be at least 10 characters')
			.max(1000, 'Cancellation reason must not exceed 1000 characters')
			.optional(),
		// camelCase (из промпта 9.4)
		eventId: z.number().int().positive('Event ID must be a positive integer').optional(),
		reason: z
			.string()
			.min(10, 'Cancellation reason must be at least 10 characters')
			.max(1000, 'Cancellation reason must not exceed 1000 characters')
			.optional(),
	})
	.refine(
		(data) => {
			// Должен быть указан хотя бы один вариант ID
			return data.event_id !== undefined || data.eventId !== undefined;
		},
		{ message: 'Either event_id or eventId must be provided' }
	)
	.refine(
		(data) => {
			// Должна быть указана хотя бы одна причина
			return data.cancellation_reason !== undefined || data.reason !== undefined;
		},
		{ message: 'Either cancellation_reason or reason must be provided' }
	);

/**
 * POST /api/admin/events/cancel
 * Отмена мероприятия администратором
 */
export async function POST({ request, platform }: RequestEvent) {
	try {
		const DB = getDB(platform);

		if (!platform?.env?.JWT_SECRET) {
			throw errors.internal('JWT secret not configured');
		}

		const JWT_SECRET = platform.env.JWT_SECRET;

		// Шаг 1: Проверка аутентификации и прав администратора (обязательно)
		const admin = await requireAdmin(request, DB, JWT_SECRET);

		// Шаг 2: Парсинг и валидация запроса
		let requestData: unknown;
		try {
			requestData = await request.json();
		} catch (error) {
			throw errors.badRequest('Invalid JSON in request body');
		}

		const validationResult = cancelEventSchema.safeParse(requestData);

		if (!validationResult.success) {
			const validationErrors = validationResult.error.issues.map((err) => ({
				field: err.path.join('.'),
				message: err.message,
			}));

			throw errors.badRequest('Validation failed', { errors: validationErrors });
		}

		const rawData = validationResult.data;

		// Нормализация: принимаем оба варианта полей для совместимости
		const eventId = rawData.event_id ?? rawData.eventId!;
		const cancellationReason = rawData.cancellation_reason ?? rawData.reason!;

		// Шаг 3: Получение мероприятия
		const event = await getEventById(DB, eventId);

		if (!event) {
			throw errors.notFound('Event not found');
		}

		// Шаг 4: Проверка что мероприятие активно
		if (event.status === 'cancelled') {
			throw errors.badRequest('Event is already cancelled', {
				cancelled_at: event.cancelled_at,
				cancellation_reason: event.cancellation_reason,
			});
		}

		// Шаг 5: Получение списка всех зарегистрированных пользователей
		const registrations = await getEventRegistrations(DB, eventId);

		// Фильтруем только активные регистрации (не отменённые)
		const activeRegistrations = registrations.filter((reg) => !reg.cancelled_at);

		console.log(
			`[Admin Cancel Event] Found ${activeRegistrations.length} active registrations for event ${eventId}`
		);

		// Помечаем все активные регистрации этого события как отменённые
		if (activeRegistrations.length > 0) {
			try {
				await DB.prepare(
					`UPDATE registrations
					 SET cancelled_at = datetime('now'), cancellation_reason = ?
					 WHERE event_id = ? AND cancelled_at IS NULL`
				)
					.bind(cancellationReason, eventId)
					.run();

				console.log(
					`[Admin Cancel Event] Marked ${activeRegistrations.length} registrations as cancelled for event ${eventId}`
				);
			} catch (updateError) {
				console.error(
					'[Admin Cancel Event] Failed to mark registrations as cancelled:',
					updateError
				);
				// Используем стандартный helper для 500-й ошибки
				throw errors.internal('Failed to cancel registrations for this event', {
					eventId,
					error: updateError instanceof Error ? updateError.message : String(updateError),
				});
			}
		}

		// Шаг 6: Обновление статуса мероприятия на 'cancelled'
		await cancelEvent(DB, eventId, cancellationReason, admin.id);

		// Шаг 7: Логирование действия
		const clientIP = getClientIP(request);
		try {
			const logDetails = JSON.stringify({
				event_id: eventId,
				event_title: event.title_de,
				cancellation_reason: cancellationReason,
				affected_users: activeRegistrations.length,
			});

			await logActivity(DB, admin.id, 'event_cancel', logDetails, clientIP || undefined);
		} catch (error) {
			console.error('[Admin Cancel Event] Activity logging failed:', error);
		}

		// Шаг 8: Массовая рассылка уведомлений всем участникам
		let bulkEmailResult = {
			success: 0,
			failed: 0,
			errors: [] as string[],
		};

		if (activeRegistrations.length > 0) {
			// Собираем данные для массовой рассылки: группируем по языку
			const emailsByLanguage = new Map<LanguageCode, Array<{ email: string; user: any }>>();

			for (const registration of activeRegistrations) {
				try {
					const user = await getUserById(DB, registration.user_id);

					if (!user) {
						console.warn(
							`[Admin Cancel Event] User ${registration.user_id} not found, skipping email`
						);
						continue;
					}

					const userLanguage = (user.preferred_language || 'de') as LanguageCode;

					if (!emailsByLanguage.has(userLanguage)) {
						emailsByLanguage.set(userLanguage, []);
					}

					emailsByLanguage.get(userLanguage)!.push({
						email: user.email,
						user: user,
					});
				} catch (error) {
					console.error(
						`[Admin Cancel Event] Failed to get user ${registration.user_id}:`,
						error
					);
				}
			}

			// Отправляем письма для каждой языковой группы
			for (const [language, recipients] of emailsByLanguage) {
				try {
					console.log(
						`[Admin Cancel Event] Sending ${recipients.length} emails in language: ${language}`
					);

					// Для массовой отправки нужны только email адреса
					// Используем первого пользователя для генерации шаблона (имя будет общим)
					const sampleUser = recipients[0].user;
					const emailTemplate = getEventCancelledByAdminEmail(
						sampleUser,
						event,
						cancellationReason,
						language,
						'/events' // URL to events page
					);

					// Извлекаем только email адреса
					const emails = recipients.map((r) => r.email);

					// Отправляем массовую рассылку с батчингом
					const result = await sendBulkEmails(
						emails,
						emailTemplate.subject,
						emailTemplate.text,
						platform!.env
					);

					// Суммируем результаты
					bulkEmailResult.success += result.success;
					bulkEmailResult.failed += result.failed;
					bulkEmailResult.errors.push(...result.errors);

					console.log(
						`[Admin Cancel Event] Language ${language} completed: ${result.success} sent, ${result.failed} failed`
					);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					console.error(
						`[Admin Cancel Event] Failed to send emails in language ${language}:`,
						error
					);
					bulkEmailResult.errors.push(
						`Failed to send ${recipients.length} emails in language ${language}: ${errorMessage}`
					);
					bulkEmailResult.failed += recipients.length;
				}
			}
		}

		// Шаг 9: Возврат успешного ответа
		// Соответствует спецификации 9.4 + расширенная диагностика
		return json(
			{
				success: true, // Из промпта 9.4
				notifiedCount: bulkEmailResult.success, // Из промпта 9.4
				message: 'Event cancelled successfully',
				event: {
					id: event.id,
					title: {
						de: event.title_de,
						en: event.title_en,
						ru: event.title_ru,
						uk: event.title_uk,
					},
					date: event.date,
					status: 'cancelled',
					cancellation_reason: cancellationReason,
				},
				totalRegistrations: activeRegistrations.length, // Алиас для affected_users
				affected_users: activeRegistrations.length, // Оставлено для обратной совместимости
				email_notifications: {
					total: activeRegistrations.length,
					sent: bulkEmailResult.success,
					failed: bulkEmailResult.failed,
					errors:
						bulkEmailResult.errors.length > 0
							? bulkEmailResult.errors.slice(0, 10) // Первые 10 ошибок
							: undefined,
				},
			},
			{
				status: 200,
			}
		);
	} catch (error) {
		return handleApiError(error);
	}
}
