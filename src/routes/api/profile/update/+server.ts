/**
 * API Endpoint: Обновление профиля пользователя
 * PUT /api/profile/update
 *
 * Позволяет авторизованному пользователю обновить свои личные данные.
 * Поддерживает обновление всех полей профиля, включая смену пароля.
 *
 * Требования:
 * - Пользователь должен быть авторизован
 * - Если меняется email, он должен быть уникальным
 * - Если меняется пароль, требуется подтверждение текущего пароля
 * - Если новая дата рождения делает пользователя младше 18 лет, требуется parental_consent
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { requireAuth, getClientIP } from '$lib/server/middleware/auth';
import { userUpdateSchema } from '$lib/server/validation/schemas';
import { updateUser, emailExists } from '$lib/server/db/users';
import { logActivity } from '$lib/server/db/activityLog';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import type { UserProfile } from '$lib/types/user';

/**
 * Вычисляет возраст на основе даты рождения
 */
function calculateAge(birthDate: string): number {
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
 * Преобразует User в UserProfile (удаляет password_hash)
 */
function userToProfile(user: {
	id: number;
	email: string;
	password_hash: string;
	first_name: string;
	last_name: string;
	birth_date: string;
	address_street: string;
	address_number: string;
	address_zip: string;
	address_city: string;
	phone: string;
	whatsapp: string | null;
	telegram: string | null;
	photo_video_consent: boolean;
	preferred_language: 'de' | 'en' | 'ru' | 'uk';
	parental_consent: boolean;
	guardian_first_name: string | null;
	guardian_last_name: string | null;
	guardian_phone: string | null;
	guardian_consent: boolean;
	is_blocked: boolean;
	created_at: string;
	updated_at: string;
}): UserProfile {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { password_hash, ...profile } = user;
	return profile;
}

export const PUT = async ({ request, platform }: RequestEvent) => {
	try {
		// Шаг 1: Требуем авторизации
		const user = await requireAuth(request, platform!.env.DB, platform!.env.JWT_SECRET);

		// Шаг 2: Получаем и валидируем данные из запроса
		const rawData = await request.json();

		// Проверяем намерение изменить preferred_language (поле присутствует И не пустое)
		// Пустая строка из форм = "нет изменений", не устанавливаем default
		const hasPrefLang =
			Object.prototype.hasOwnProperty.call(rawData, 'preferred_language') &&
			rawData.preferred_language !== '';

		// Подготавливаем данные для валидации
		const dataToValidate: Record<string, unknown> = { ...rawData };

		// Если нет намерения менять язык (пустая строка или поле отсутствует) — убираем из валидации
		// Это endpoint частичного обновления, не подставляем default значения
		if (!hasPrefLang) {
			delete dataToValidate.preferred_language;
		}

		// Также убираем null значение (клиент не хочет менять язык)
		if (rawData.preferred_language === null) {
			delete dataToValidate.preferred_language;
		}

		const validationResult = userUpdateSchema.safeParse(dataToValidate);

		if (!validationResult.success) {
			return json(
				{
					error: 'Validation failed',
					details: validationResult.error.issues.map((issue) => ({
						field: issue.path.join('.'),
						message: issue.message,
					})),
				},
				{ status: 400 }
			);
		}

		const data = validationResult.data;

		// Шаг 3: Проверяем возраст - если < 18 в новой дате рождения, требуем parental_consent
		if (data.birth_date) {
			const age = calculateAge(data.birth_date);
			if (age < 18) {
				// Если пользователь обновляет дату рождения и становится младше 18
				// то parental_consent должен быть true в запросе ИЛИ уже был true
				if (!data.parental_consent && !user.parental_consent) {
					return json(
						{
							error: 'Parental consent is required for users under 18',
						},
						{ status: 400 }
					);
				}
			}
		}

		// Шаг 4: Если меняется email - проверяем уникальность
		if (data.email && data.email !== user.email) {
			const exists = await emailExists(platform!.env.DB, data.email);
			if (exists) {
				return json(
					{
						error: 'Email already exists',
					},
					{ status: 409 }
				);
			}
		}

		// Шаг 5: Если меняется пароль - проверяем текущий пароль и хешируем новый
		let passwordHash: string | undefined = undefined;

		if (data.new_password) {
			// Проверяем, что указан текущий пароль
			if (!data.current_password) {
				return json(
					{
						error: 'Current password is required to set a new password',
					},
					{ status: 400 }
				);
			}

			// Верифицируем текущий пароль
			const isCurrentPasswordValid = await verifyPassword(
				data.current_password,
				user.password_hash
			);

			if (!isCurrentPasswordValid) {
				return json(
					{
						error: 'Current password is incorrect',
					},
					{ status: 400 }
				);
			}

			// Хешируем новый пароль
			passwordHash = await hashPassword(data.new_password);
		}

		// Шаг 6: Подготавливаем данные для обновления
		// Удаляем поля, которые не должны попасть в БД напрямую
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { current_password, new_password, new_password_confirm, email, ...updateData } = data;

		// Создаём финальный объект для обновления
		const finalUpdateData: Record<string, unknown> = {
			...updateData,
		};

		// Удаляем preferred_language если он не был в оригинальном запросе
		// (предотвращаем непреднамеренную перезапись существующих настроек)
		if (!hasPrefLang) {
			delete finalUpdateData.preferred_language;
		}

		// Нормализуем опциональные поля мессенджеров: пустая строка → null
		// (для консистентности с createUser)
		if (finalUpdateData.whatsapp === '') {
			finalUpdateData.whatsapp = null;
		}
		if (finalUpdateData.telegram === '') {
			finalUpdateData.telegram = null;
		}

		// Добавляем email если он изменился
		if (email && email !== user.email) {
			finalUpdateData.email = email;
		}

		// Добавляем новый хеш пароля если он был изменён
		if (passwordHash) {
			finalUpdateData.password_hash = passwordHash;
		}

		// Шаг 7: Обновляем пользователя в БД
		const updatedUser = await updateUser(
			platform!.env.DB,
			user.id,
			finalUpdateData as Partial<{
				first_name?: string;
				last_name?: string;
				birth_date?: string;
				address_street?: string;
				address_number?: string;
				address_zip?: string;
				address_city?: string;
				phone?: string;
				whatsapp?: string | null;
				telegram?: string | null;
				photo_video_consent?: boolean;
				preferred_language?: 'de' | 'en' | 'ru' | 'uk';
				parental_consent?: boolean;
				is_blocked?: boolean;
				email?: string;
				password_hash?: string;
			}>
		);

		// Шаг 8: Логируем действие
		const ip = getClientIP(request);
		const updatedFields = Object.keys(finalUpdateData).filter(
			(key) => key !== 'password_hash' && key !== 'email'
		);
		if (passwordHash) updatedFields.push('password');
		if (email) updatedFields.push('email');

		await logActivity(
			platform!.env.DB,
			user.id,
			'user_update_profile',
			`Updated fields: ${updatedFields.join(', ')}`,
			ip || undefined
		);

		// Шаг 9: Возвращаем успешный ответ
		return json(
			{
				user: userToProfile(updatedUser),
				message: 'Profile updated successfully',
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		// Обработка ошибок middleware (401/403)
		if (error instanceof Error && 'status' in error) {
			const statusError = error as Error & { status: number };
			return json(
				{
					error: error.message,
				},
				{ status: statusError.status }
			);
		}

		// Обработка других ошибок
		console.error('[PUT /api/profile/update] Ошибка:', error);
		return json(
			{
				error: 'Internal server error',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
};
