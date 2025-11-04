/**
 * Client-side Validation Schemas
 * Общие схемы валидации для клиента и сервера
 *
 * Этот модуль доступен как для браузерного кода, так и для серверных эндпоинтов.
 * Не содержит серверной логики, только Zod схемы.
 */

import { z } from 'zod';

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Вычисляет возраст на основе даты рождения
 */
export function calculateAge(birthDate: string): number {
	const birth = new Date(birthDate);
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();

	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age--;
	}

	return age;
}

/**
 * Проверяет формат телефонного номера (немецкий формат)
 * Разрешены форматы: +49..., 0..., с пробелами и дефисами
 */
function isValidPhone(phone: string): boolean {
	// Удаляем пробелы и дефисы для проверки
	const cleaned = phone.replace(/[\s\-]/g, '');
	// Разрешаем: +49... или 0... (минимум 10 цифр после кода)
	return /^(\+49|0)\d{9,}$/.test(cleaned);
}

/**
 * Проверяет формат немецкого почтового индекса
 */
function isValidGermanZip(zip: string): boolean {
	return /^\d{5}$/.test(zip);
}

/**
 * Проверяет, содержит ли пароль буквы и цифры
 */
function hasLettersAndNumbers(password: string): boolean {
	const hasLetter = /[a-zA-Z]/.test(password);
	const hasNumber = /\d/.test(password);
	return hasLetter && hasNumber;
}

/**
 * Проверяет, содержит ли строка только буквы (с учетом умлаутов и кириллицы)
 */
function isOnlyLetters(str: string): boolean {
	return /^[a-zA-ZäöüßÄÖÜа-яА-ЯіїєґІЇЄҐ\s\-']+$/.test(str);
}

// ==========================================
// БАЗОВЫЕ СХЕМЫ (ПЕРЕИСПОЛЬЗУЕМЫЕ)
// ==========================================

/**
 * Схема для email адреса
 */
const emailSchema = z
	.string()
	.min(1, { message: 'validation.emailRequired' })
	.email({ message: 'validation.emailInvalid' })
	.toLowerCase()
	.trim();

/**
 * Схема для пароля
 */
const passwordSchema = z
	.string()
	.min(8, { message: 'validation.passwordMinLength' })
	.refine(hasLettersAndNumbers, {
		message: 'validation.passwordComplexity',
	});

/**
 * Схема для имени/фамилии
 */
const nameSchema = z
	.string()
	.min(1, { message: 'validation.fieldRequired' })
	.max(100, { message: 'validation.nameMaxLength' })
	.trim()
	.refine(isOnlyLetters, {
		message: 'validation.nameOnlyLetters',
	});

/**
 * Схема для даты рождения
 */
const birthDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.dateFormat' })
	.refine(
		(date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		},
		{ message: 'validation.dateInvalid' }
	)
	.refine(
		(date) => {
			const parsed = new Date(date);
			return parsed < new Date();
		},
		{ message: 'validation.dateFuture' }
	)
	.refine(
		(date) => {
			const age = calculateAge(date);
			return age >= 10 && age <= 100;
		},
		{ message: 'validation.ageRange' }
	);

/**
 * Схема для телефона
 */
const phoneSchema = z
	.string()
	.min(1, { message: 'validation.phoneRequired' })
	.trim()
	.refine(isValidPhone, {
		message: 'validation.phoneInvalid',
	});

/**
 * Схема для опционального телефона (WhatsApp, Telegram)
 */
const optionalPhoneSchema = z
	.string()
	.trim()
	.refine((val) => val === '' || isValidPhone(val), {
		message: 'validation.phoneInvalid',
	})
	.optional()
	.or(z.literal(''));

/**
 * Схема для почтового индекса
 */
const zipSchema = z
	.string()
	.min(1, { message: 'validation.zipRequired' })
	.refine(isValidGermanZip, {
		message: 'validation.zipInvalid',
	});

// ==========================================
// СХЕМЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================

/**
 * Схема регистрации пользователя
 */
export const userRegistrationSchema = z
	.object({
		// Аутентификация
		email: emailSchema,
		password: passwordSchema,
		password_confirm: z.string().min(1, { message: 'validation.passwordConfirmRequired' }),

		// Личные данные
		first_name: nameSchema,
		last_name: nameSchema,
		birth_date: birthDateSchema,

		// Адрес
		address_street: z.string().min(1, { message: 'validation.streetRequired' }).trim(),
		address_number: z.string().min(1, { message: 'validation.houseNumberRequired' }).trim(),
		address_zip: zipSchema,
		address_city: z.string().min(1, { message: 'validation.cityRequired' }).trim(),

		// Контакты
		phone: phoneSchema,
		whatsapp: optionalPhoneSchema,
		telegram: z.string().trim().optional(),

		// Согласия
		photo_video_consent: z.boolean(),
		parental_consent: z.boolean(),
		gdpr_consent: z.boolean(),

		// Предпочтения
		preferred_language: z.enum(['de', 'en', 'ru', 'uk']).default('de'),
	})
	.refine((data) => data.password === data.password_confirm, {
		message: 'validation.passwordMismatch',
		path: ['password_confirm'],
	})
	.refine(
		(data) => {
			const age = calculateAge(data.birth_date);
			// Если возраст < 18, то parental_consent должен быть true
			if (age < 18) {
				return data.parental_consent === true;
			}
			return true;
		},
		{
			message: 'validation.parentalConsentRequired',
			path: ['parental_consent'],
		}
	)
	.refine((data) => data.gdpr_consent === true, {
		message: 'validation.gdprConsentRequired',
		path: ['gdpr_consent'],
	});

/**
 * Схема входа в систему
 */
export const userLoginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, { message: 'validation.passwordRequired' }),
});

/**
 * Схема обновления профиля пользователя
 * Все поля опциональны, валидация применяется только к заполненным
 */
export const userUpdateSchema = z
	.object({
		// Личные данные
		first_name: nameSchema.optional(),
		last_name: nameSchema.optional(),
		birth_date: birthDateSchema.optional(),

		// Адрес
		address_street: z.string().min(1).trim().optional(),
		address_number: z.string().min(1).trim().optional(),
		address_zip: zipSchema.optional(),
		address_city: z.string().min(1).trim().optional(),

		// Контакты
		phone: phoneSchema.optional(),
		whatsapp: optionalPhoneSchema,
		telegram: z.string().trim().optional(),

		// Согласия
		photo_video_consent: z.boolean().optional(),

		// Предпочтения
		preferred_language: z.enum(['de', 'en', 'ru', 'uk']).optional(),

		// Смена пароля
		current_password: z.string().optional(),
		new_password: passwordSchema.optional(),
		new_password_confirm: z.string().optional(),
	})
	.refine(
		(data) => {
			// Если указан new_password, то current_password обязателен
			if (data.new_password && !data.current_password) {
				return false;
			}
			return true;
		},
		{
			message: 'validation.currentPasswordRequired',
			path: ['current_password'],
		}
	)
	.refine(
		(data) => {
			// Если указан new_password, то new_password_confirm должен совпадать
			if (data.new_password && data.new_password !== data.new_password_confirm) {
				return false;
			}
			return true;
		},
		{
			message: 'validation.newPasswordMismatch',
			path: ['new_password_confirm'],
		}
	);

// ==========================================
// ТИПЫ, ВЫВЕДЕННЫЕ ИЗ СХЕМ
// ==========================================

export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
