/**
 * Database utilities - Reviews
 * Утилиты для работы с отзывами и публичными ссылками
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
	Review,
	ReviewPublicLink,
	ReviewForAdminList,
	PublicReview,
	ReviewStatus,
	ReviewAdminFilters,
	ReviewAdminListResult,
	ReviewWindow,
} from '$lib/types/review';

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Вычисляет SHA-256 хеш токена
 * Использует Web Crypto API, совместимый с Cloudflare Workers
 *
 * @param token - Токен для хеширования
 * @returns Hex-строка SHA-256 хеша
 */
export async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Генерирует криптографически безопасный токен
 * Использует crypto.getRandomValues, совместимый с Cloudflare Workers
 *
 * @returns Base64url-encoded токен из 32 байт
 */
export function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	// Base64url encoding (без padding)
	// Используем Array.from для совместимости с TypeScript
	const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Вычисляет окно возможности оставить отзыв на основе даты окончания мероприятия
 *
 * Правила:
 * - Начало: end_date минус 45 минут
 * - Конец: начало плюс 7 дней
 *
 * @param endDate - Дата окончания мероприятия (ISO string)
 * @returns Объект с датами начала и конца окна
 */
export function getReviewWindow(endDate: string): ReviewWindow {
	const endDateTime = new Date(endDate);

	// Начало: 45 минут до окончания
	const start = new Date(endDateTime.getTime() - 45 * 60 * 1000);

	// Конец: 7 дней после начала окна (т.е. примерно 7 дней после окончания мероприятия)
	const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

	return { start, end };
}

/**
 * Проверяет, находится ли текущее время внутри окна отзывов
 *
 * @param now - Текущая дата/время
 * @param endDate - Дата окончания мероприятия (ISO string)
 * @returns true если сейчас можно оставить отзыв
 */
export function isNowWithinWindow(now: Date, endDate: string): boolean {
	const window = getReviewWindow(endDate);
	return now >= window.start && now <= window.end;
}

// ==========================================
// ПУБЛИЧНЫЕ ССЫЛКИ
// ==========================================

/**
 * Создает публичную ссылку для отзывов на мероприятие
 *
 * @param db - D1 Database instance
 * @param eventId - ID мероприятия
 * @param createdBy - ID администратора, создающего ссылку
 * @param expiresAt - Дата истечения срока действия (ISO string)
 * @returns Объект с ID, токеном (для передачи пользователю) и датой истечения
 */
export async function createReviewPublicLink(
	db: D1Database,
	eventId: number,
	createdBy: number,
	expiresAt: string
): Promise<{ id: number; token: string; expires_at: string }> {
	// Генерируем токен
	const token = generateToken();
	const tokenHash = await hashToken(token);

	const result = await db
		.prepare(
			`
			INSERT INTO review_public_links (event_id, token_hash, created_by, expires_at)
			VALUES (?, ?, ?, ?)
		`
		)
		.bind(eventId, tokenHash, createdBy, expiresAt)
		.run();

	if (!result.success) {
		throw new Error('Failed to create review public link');
	}

	return {
		id: result.meta.last_row_id as number,
		token,
		expires_at: expiresAt,
	};
}

/**
 * Получает публичную ссылку по токену (если она валидна и не истекла)
 *
 * @param db - D1 Database instance
 * @param token - Токен публичной ссылки
 * @returns Данные ссылки или null если не найдена/истекла/отозвана
 */
export async function getPublicLinkByToken(
	db: D1Database,
	token: string
): Promise<(ReviewPublicLink & { event_end_date: string | null }) | null> {
	const tokenHash = await hashToken(token);
	const now = new Date().toISOString();

	const result = await db
		.prepare(
			`
			SELECT 
				rpl.*,
				e.end_date as event_end_date
			FROM review_public_links rpl
			INNER JOIN events e ON rpl.event_id = e.id
			WHERE rpl.token_hash = ?
			  AND rpl.revoked_at IS NULL
			  AND rpl.expires_at > ?
		`
		)
		.bind(tokenHash, now)
		.first<ReviewPublicLink & { event_end_date: string | null }>();

	return result || null;
}

/**
 * Отзывает (деактивирует) публичную ссылку
 *
 * @param db - D1 Database instance
 * @param linkId - ID ссылки
 * @returns true если ссылка была отозвана
 */
export async function revokePublicLink(db: D1Database, linkId: number): Promise<boolean> {
	const result = await db
		.prepare(
			`
			UPDATE review_public_links 
			SET revoked_at = datetime('now')
			WHERE id = ? AND revoked_at IS NULL
		`
		)
		.bind(linkId)
		.run();

	return result.meta.changes > 0;
}

/**
 * Получает все публичные ссылки для мероприятия
 *
 * @param db - D1 Database instance
 * @param eventId - ID мероприятия
 * @returns Список публичных ссылок
 */
export async function getPublicLinksForEvent(
	db: D1Database,
	eventId: number
): Promise<ReviewPublicLink[]> {
	const result = await db
		.prepare(
			`
			SELECT * FROM review_public_links
			WHERE event_id = ?
			ORDER BY created_at DESC
		`
		)
		.bind(eventId)
		.all<ReviewPublicLink>();

	if (!result.success) {
		throw new Error('Failed to fetch public links');
	}

	return result.results || [];
}

// ==========================================
// СОЗДАНИЕ ОТЗЫВОВ
// ==========================================

/**
 * Создает отзыв от авторизованного пользователя
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @param eventId - ID мероприятия
 * @param rating - Оценка (1-10)
 * @param comment - Текст отзыва
 * @param isAnonymous - Флаг анонимности
 * @returns Созданный отзыв
 * @throws Error если пользователь не может оставить отзыв
 */
export async function createUserReview(
	db: D1Database,
	userId: number,
	eventId: number,
	rating: number,
	comment: string,
	isAnonymous: boolean
): Promise<Review> {
	// Проверяем событие
	const event = await db
		.prepare(
			`
			SELECT id, status, end_date
			FROM events
			WHERE id = ?
		`
		)
		.bind(eventId)
		.first<{ id: number; status: string; end_date: string | null }>();

	if (!event) {
		throw new Error('Event not found');
	}

	if (event.status === 'cancelled') {
		throw new Error('Cannot review a cancelled event');
	}

	if (!event.end_date) {
		throw new Error('Event has no end date, cannot accept reviews');
	}

	// Проверяем окно отзывов
	const now = new Date();
	if (!isNowWithinWindow(now, event.end_date)) {
		const window = getReviewWindow(event.end_date);
		throw new Error(
			`Review window is from ${window.start.toISOString()} to ${window.end.toISOString()}`
		);
	}

	// Проверяем активную регистрацию пользователя
	const registration = await db
		.prepare(
			`
			SELECT id FROM registrations
			WHERE user_id = ? AND event_id = ? AND cancelled_at IS NULL
		`
		)
		.bind(userId, eventId)
		.first<{ id: number }>();

	if (!registration) {
		throw new Error('User is not registered for this event');
	}

	// Проверяем, нет ли уже отзыва
	const existingReview = await db
		.prepare(
			`
			SELECT id FROM reviews
			WHERE user_id = ? AND event_id = ?
		`
		)
		.bind(userId, eventId)
		.first<{ id: number }>();

	if (existingReview) {
		throw new Error('User has already submitted a review for this event');
	}

	// Создаем отзыв
	const result = await db
		.prepare(
			`
			INSERT INTO reviews (event_id, user_id, rating, comment, is_anonymous, status)
			VALUES (?, ?, ?, ?, ?, 'pending')
		`
		)
		.bind(eventId, userId, rating, comment, isAnonymous ? 1 : 0)
		.run();

	if (!result.success) {
		throw new Error('Failed to create review');
	}

	// Получаем созданный отзыв
	const review = await db
		.prepare('SELECT * FROM reviews WHERE id = ?')
		.bind(result.meta.last_row_id)
		.first<Review>();

	if (!review) {
		throw new Error('Review created but not found');
	}

	return review;
}

/**
 * Создает отзыв через публичную ссылку (анонимный)
 *
 * @param db - D1 Database instance
 * @param token - Токен публичной ссылки
 * @param rating - Оценка (1-10)
 * @param comment - Текст отзыва
 * @param isAnonymous - Флаг анонимности
 * @param publicDisplayName - Отображаемое имя (опционально)
 * @returns Созданный отзыв
 * @throws Error если токен недействителен или отзыв невозможен
 */
export async function createPublicReview(
	db: D1Database,
	token: string,
	rating: number,
	comment: string,
	isAnonymous: boolean,
	publicDisplayName?: string
): Promise<Review> {
	// Получаем и валидируем ссылку
	const link = await getPublicLinkByToken(db, token);

	if (!link) {
		throw new Error('Invalid or expired public link');
	}

	// Проверяем событие
	const event = await db
		.prepare(
			`
			SELECT id, status, end_date
			FROM events
			WHERE id = ?
		`
		)
		.bind(link.event_id)
		.first<{ id: number; status: string; end_date: string | null }>();

	if (!event) {
		throw new Error('Event not found');
	}

	if (event.status === 'cancelled') {
		throw new Error('Cannot review a cancelled event');
	}

	// Проверяем окно отзывов (рекомендуется, но ссылка может быть специально продлена)
	if (event.end_date) {
		const now = new Date();
		if (!isNowWithinWindow(now, event.end_date)) {
			const window = getReviewWindow(event.end_date);
			throw new Error(
				`Review window is from ${window.start.toISOString()} to ${window.end.toISOString()}`
			);
		}
	}

	// Создаем отзыв (user_id = NULL для публичных отзывов)
	const result = await db
		.prepare(
			`
			INSERT INTO reviews (event_id, user_id, public_link_id, rating, comment, is_anonymous, public_display_name, status)
			VALUES (?, NULL, ?, ?, ?, ?, ?, 'pending')
		`
		)
		.bind(
			link.event_id,
			link.id,
			rating,
			comment,
			isAnonymous ? 1 : 0,
			publicDisplayName || null
		)
		.run();

	if (!result.success) {
		throw new Error('Failed to create review');
	}

	// Получаем созданный отзыв
	const review = await db
		.prepare('SELECT * FROM reviews WHERE id = ?')
		.bind(result.meta.last_row_id)
		.first<Review>();

	if (!review) {
		throw new Error('Review created but not found');
	}

	return review;
}

// ==========================================
// ПОЛУЧЕНИЕ ОТЗЫВОВ
// ==========================================

/**
 * Получает список отзывов для админ-панели с пагинацией
 *
 * @param db - D1 Database instance
 * @param filters - Параметры фильтрации
 * @returns Список отзывов и общее количество
 */
export async function listReviewsForAdmin(
	db: D1Database,
	filters: ReviewAdminFilters = {}
): Promise<ReviewAdminListResult> {
	const { status = 'pending', limit = 20, offset = 0, event_id } = filters;

	// Строим WHERE условия
	const conditions: string[] = ['r.status = ?'];
	const params: (string | number)[] = [status];

	if (event_id !== undefined) {
		conditions.push('r.event_id = ?');
		params.push(event_id);
	}

	const whereClause = conditions.join(' AND ');

	// Получаем общее количество
	const countResult = await db
		.prepare(
			`
			SELECT COUNT(*) as total
			FROM reviews r
			WHERE ${whereClause}
		`
		)
		.bind(...params)
		.first<{ total: number }>();

	const total = countResult?.total || 0;

	// Получаем отзывы с JOIN
	const reviewsResult = await db
		.prepare(
			`
			SELECT 
				r.*,
				e.title_de as event_title_de,
				e.date as event_date,
				e.end_date as event_end_date,
				u.email as author_email,
				u.first_name as author_first_name,
				u.last_name as author_last_name,
				CASE WHEN r.user_id IS NULL THEN 1 ELSE 0 END as is_public_link_review
			FROM reviews r
			INNER JOIN events e ON r.event_id = e.id
			LEFT JOIN users u ON r.user_id = u.id
			WHERE ${whereClause}
			ORDER BY r.created_at DESC
			LIMIT ? OFFSET ?
		`
		)
		.bind(...params, limit, offset)
		.all<ReviewForAdminList>();

	if (!reviewsResult.success) {
		throw new Error('Failed to fetch reviews');
	}

	// Преобразуем is_public_link_review из числа в boolean
	const items = (reviewsResult.results || []).map((review) => ({
		...review,
		is_public_link_review: Boolean(review.is_public_link_review),
	}));

	return { items, total };
}

/**
 * Получает один отзыв по ID
 *
 * @param db - D1 Database instance
 * @param reviewId - ID отзыва
 * @returns Отзыв или null
 */
export async function getReviewById(db: D1Database, reviewId: number): Promise<Review | null> {
	const result = await db
		.prepare('SELECT * FROM reviews WHERE id = ?')
		.bind(reviewId)
		.first<Review>();

	return result || null;
}

// ==========================================
// МОДЕРАЦИЯ ОТЗЫВОВ
// ==========================================

/**
 * Модерирует отзывы (approve/reject)
 *
 * @param db - D1 Database instance
 * @param adminId - ID модератора
 * @param options - Параметры модерации
 * @returns Количество обновленных отзывов
 */
export async function moderateReviews(
	db: D1Database,
	adminId: number,
	options: {
		reviewIds?: number[];
		allPending?: boolean;
		status: 'approved' | 'rejected';
	}
): Promise<number> {
	const { reviewIds, allPending, status } = options;
	const now = new Date().toISOString();

	if (allPending) {
		// Модерируем все pending отзывы
		const result = await db
			.prepare(
				`
				UPDATE reviews
				SET status = ?, moderated_at = ?, moderated_by = ?
				WHERE status = 'pending'
			`
			)
			.bind(status, now, adminId)
			.run();

		return result.meta.changes;
	}

	if (!reviewIds || reviewIds.length === 0) {
		throw new Error('No review IDs provided');
	}

	// Модерируем конкретные отзывы
	// D1 не поддерживает IN (?) с массивом, поэтому используем batch
	const statements = reviewIds.map((id) =>
		db
			.prepare(
				`
				UPDATE reviews
				SET status = ?, moderated_at = ?, moderated_by = ?
				WHERE id = ? AND status = 'pending'
			`
			)
			.bind(status, now, adminId, id)
	);

	const results = await db.batch(statements);
	const totalChanges = results.reduce(
		(acc: number, result: { meta: { changes: number } }) => acc + (result.meta.changes || 0),
		0
	);

	return totalChanges;
}

// ==========================================
// ПУБЛИЧНЫЕ ОТЗЫВЫ (ДЛЯ САЙТА)
// ==========================================

/**
 * Получает последние одобренные отзывы
 *
 * @param db - D1 Database instance
 * @param limit - Количество отзывов
 * @returns Список публичных отзывов
 */
export async function getLatestApprovedReviews(
	db: D1Database,
	limit: number = 10
): Promise<PublicReview[]> {
	const result = await db
		.prepare(
			`
			SELECT 
				r.id,
				r.event_id,
				e.title_de as event_title_de,
				e.date as event_date,
				r.rating,
				r.comment,
				CASE 
					WHEN r.is_anonymous = 1 THEN NULL
					WHEN r.user_id IS NOT NULL THEN u.first_name
					ELSE r.public_display_name
				END as display_name,
				r.created_at
			FROM reviews r
			INNER JOIN events e ON r.event_id = e.id
			LEFT JOIN users u ON r.user_id = u.id
			WHERE r.status = 'approved'
			ORDER BY r.created_at DESC
			LIMIT ?
		`
		)
		.bind(limit)
		.all<PublicReview>();

	if (!result.success) {
		throw new Error('Failed to fetch approved reviews');
	}

	return result.results || [];
}

/**
 * Получает одобренные отзывы с пагинацией
 *
 * @param db - D1 Database instance
 * @param options - Параметры пагинации
 * @returns Список отзывов и общее количество
 */
export async function getApprovedReviews(
	db: D1Database,
	options: { limit?: number; offset?: number; eventId?: number } = {}
): Promise<{ items: PublicReview[]; total: number }> {
	const { limit = 20, offset = 0, eventId } = options;

	// Условия фильтрации
	const conditions: string[] = ["r.status = 'approved'"];
	const params: (string | number)[] = [];

	if (eventId !== undefined) {
		conditions.push('r.event_id = ?');
		params.push(eventId);
	}

	const whereClause = conditions.join(' AND ');

	// Общее количество
	const countResult = await db
		.prepare(
			`
			SELECT COUNT(*) as total
			FROM reviews r
			WHERE ${whereClause}
		`
		)
		.bind(...params)
		.first<{ total: number }>();

	const total = countResult?.total || 0;

	// Отзывы с пагинацией
	const result = await db
		.prepare(
			`
			SELECT 
				r.id,
				r.event_id,
				e.title_de as event_title_de,
				e.date as event_date,
				r.rating,
				r.comment,
				CASE 
					WHEN r.is_anonymous = 1 THEN NULL
					WHEN r.user_id IS NOT NULL THEN u.first_name
					ELSE r.public_display_name
				END as display_name,
				r.created_at
			FROM reviews r
			INNER JOIN events e ON r.event_id = e.id
			LEFT JOIN users u ON r.user_id = u.id
			WHERE ${whereClause}
			ORDER BY r.created_at DESC
			LIMIT ? OFFSET ?
		`
		)
		.bind(...params, limit, offset)
		.all<PublicReview>();

	if (!result.success) {
		throw new Error('Failed to fetch approved reviews');
	}

	return { items: result.results || [], total };
}

/**
 * Получает статистику отзывов для мероприятия
 *
 * @param db - D1 Database instance
 * @param eventId - ID мероприятия
 * @returns Средний рейтинг и количество одобренных отзывов
 */
export async function getEventReviewStats(
	db: D1Database,
	eventId: number
): Promise<{ averageRating: number | null; reviewCount: number }> {
	const result = await db
		.prepare(
			`
			SELECT 
				AVG(rating) as average_rating,
				COUNT(*) as review_count
			FROM reviews
			WHERE event_id = ? AND status = 'approved'
		`
		)
		.bind(eventId)
		.first<{ average_rating: number | null; review_count: number }>();

	return {
		averageRating: result?.average_rating || null,
		reviewCount: result?.review_count || 0,
	};
}

/**
 * Проверяет, может ли пользователь оставить отзыв на мероприятие
 *
 * @param db - D1 Database instance
 * @param userId - ID пользователя
 * @param eventId - ID мероприятия
 * @returns Объект с флагом возможности и причиной
 */
export async function canUserReviewEvent(
	db: D1Database,
	userId: number,
	eventId: number
): Promise<{ canReview: boolean; reason?: string }> {
	// Проверяем событие
	const event = await db
		.prepare('SELECT id, status, end_date FROM events WHERE id = ?')
		.bind(eventId)
		.first<{ id: number; status: string; end_date: string | null }>();

	if (!event) {
		return { canReview: false, reason: 'Event not found' };
	}

	if (event.status === 'cancelled') {
		return { canReview: false, reason: 'Event is cancelled' };
	}

	if (!event.end_date) {
		return { canReview: false, reason: 'Event has no end date' };
	}

	// Проверяем окно отзывов
	const now = new Date();
	if (!isNowWithinWindow(now, event.end_date)) {
		const window = getReviewWindow(event.end_date);
		if (now < window.start) {
			return { canReview: false, reason: 'Review period has not started yet' };
		}
		return { canReview: false, reason: 'Review period has ended' };
	}

	// Проверяем регистрацию
	const registration = await db
		.prepare(
			'SELECT id FROM registrations WHERE user_id = ? AND event_id = ? AND cancelled_at IS NULL'
		)
		.bind(userId, eventId)
		.first<{ id: number }>();

	if (!registration) {
		return { canReview: false, reason: 'User is not registered for this event' };
	}

	// Проверяем существующий отзыв
	const existingReview = await db
		.prepare('SELECT id FROM reviews WHERE user_id = ? AND event_id = ?')
		.bind(userId, eventId)
		.first<{ id: number }>();

	if (existingReview) {
		return { canReview: false, reason: 'User has already submitted a review' };
	}

	return { canReview: true };
}
