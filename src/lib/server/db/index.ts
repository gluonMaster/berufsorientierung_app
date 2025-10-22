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

// GDPR utilities (user deletion and archiving)
export {
	canDeleteUser,
	scheduleUserDeletion,
	archiveUser as archiveUserGDPR,
	deleteUserCompletely,
	processScheduledDeletions,
	getScheduledDeletions,
} from './gdpr';

export type { CanDeleteUserResult } from './gdpr';
