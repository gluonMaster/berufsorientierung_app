/**
 * Database utilities - Main export file
 * Центральный файл для экспорта всех утилит работы с БД
 */

// Users utilities
export {
	createUser,
	getUserByEmail,
	getUserById,
	updateUser,
	deleteUser,
	archiveUser,
	getAllUsers,
	searchUsers,
	getUsersList,
	blockUser,
	emailExists,
} from './users';

// Events utilities
export {
	createEvent,
	updateEvent,
	deleteEvent,
	getEventById,
	getAllEvents,
	getActiveEvents,
	getPastEvents,
	publishEvent,
	cancelEvent,
	getEventWithFields,
} from './events';

// Event Additional Fields utilities
export { setEventFields, getEventFields, deleteEventFields } from './eventFields';

// Registrations utilities
export {
	registerUserForEvent,
	cancelRegistration,
	getUserRegistrations,
	getEventRegistrations,
	getRegistrationCount,
	isUserRegistered,
	getRegistrationById,
	parseAdditionalData,
} from './registrations';

// Admin utilities
export { isAdmin, addAdmin, removeAdmin, getAllAdmins, getAdminByUserId } from './admin';

// Activity Log utilities
export {
	logActivity,
	getActivityLog,
	getRecentActivity,
	getUserActivityLog,
	getActivityStats,
	cleanOldLogs,
} from './activityLog';

export type { ActivityLogFilters, ActivityLogResult } from './activityLog';

// TODO: Добавить экспорты для других таблиц:
// - deleted_users_archive
// - pending_deletions
