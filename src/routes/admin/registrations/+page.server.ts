import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/middleware/admin';
import { getDB } from '$lib/server/db';

interface RegistrationWithDetails {
	id: number;
	user_id: number;
	event_id: number;
	additional_data: string | null;
	registered_at: string;
	cancelled_at: string | null;
	cancellation_reason: string | null;
	// User fields
	user_first_name: string;
	user_last_name: string;
	user_email: string;
	// Event fields
	event_title_de: string;
	event_title_en: string | null;
	event_title_ru: string | null;
	event_title_uk: string | null;
	event_date: string;
	event_status: string;
}

export const load: ServerLoad = async ({ platform, locals, url }) => {
	// Проверка прав администратора
	const adminCheck = await requireAdmin(platform, locals);
	if (!adminCheck.success) {
		throw error(403, adminCheck.error || 'Access denied');
	}

	const db = getDB(platform);

	// Получение параметров фильтрации из URL
	const eventId = url.searchParams.get('eventId');
	const status = url.searchParams.get('status'); // 'active', 'cancelled', 'all'
	const dateFrom = url.searchParams.get('dateFrom');
	const dateTo = url.searchParams.get('dateTo');
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const limit = 50;
	const offset = (page - 1) * limit;

	// Построение WHERE условий
	const conditions: string[] = [];
	const params: any[] = [];

	if (eventId && eventId !== 'all') {
		conditions.push('r.event_id = ?');
		params.push(parseInt(eventId, 10));
	}

	if (status === 'active') {
		conditions.push('r.cancelled_at IS NULL');
	} else if (status === 'cancelled') {
		conditions.push('r.cancelled_at IS NOT NULL');
	}
	// Если 'all' или не указан - не добавляем условие

	if (dateFrom) {
		conditions.push('DATE(r.registered_at) >= ?');
		params.push(dateFrom);
	}

	if (dateTo) {
		conditions.push('DATE(r.registered_at) <= ?');
		params.push(dateTo);
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	// Получение списка регистраций с JOIN
	const registrationsQuery = `
		SELECT 
			r.id,
			r.user_id,
			r.event_id,
			r.additional_data,
			r.registered_at,
			r.cancelled_at,
			r.cancellation_reason,
			u.first_name as user_first_name,
			u.last_name as user_last_name,
			u.email as user_email,
			e.title_de as event_title_de,
			e.title_en as event_title_en,
			e.title_ru as event_title_ru,
			e.title_uk as event_title_uk,
			e.date as event_date,
			e.status as event_status
		FROM registrations r
		INNER JOIN users u ON r.user_id = u.id
		INNER JOIN events e ON r.event_id = e.id
		${whereClause}
		ORDER BY r.registered_at DESC
		LIMIT ? OFFSET ?
	`;

	const registrations = await db
		.prepare(registrationsQuery)
		.bind(...params, limit, offset)
		.all<RegistrationWithDetails>();

	// Получение общего количества
	const countQuery = `
		SELECT COUNT(*) as total
		FROM registrations r
		INNER JOIN users u ON r.user_id = u.id
		INNER JOIN events e ON r.event_id = e.id
		${whereClause}
	`;

	const countResult = await db
		.prepare(countQuery)
		.bind(...params)
		.first<{ total: number }>();

	const total = countResult?.total || 0;

	// Получение списка всех мероприятий для фильтра
	const eventsQuery = `
		SELECT id, title_de, title_en, title_ru, title_uk, date
		FROM events
		ORDER BY date DESC
	`;

	const events = await db.prepare(eventsQuery).all<{
		id: number;
		title_de: string;
		title_en: string | null;
		title_ru: string | null;
		title_uk: string | null;
		date: string;
	}>();

	return {
		registrations: registrations.results || [],
		events: events.results || [],
		filters: {
			eventId: eventId || 'all',
			status: status || 'all',
			dateFrom: dateFrom || '',
			dateTo: dateTo || '',
		},
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};
