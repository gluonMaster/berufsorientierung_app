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

// TODO: Добавить экспорты для других таблиц:
// - events
// - registrations
// - admins
// - activity_log
// - deleted_users_archive
// - pending_deletions
