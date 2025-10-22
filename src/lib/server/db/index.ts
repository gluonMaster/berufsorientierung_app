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

// TODO: Добавить экспорты для других таблиц:
// - registrations
// - admins
// - activity_log
// - deleted_users_archive
// - pending_deletions
