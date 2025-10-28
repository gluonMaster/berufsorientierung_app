/**
 * Утилиты для работы с Cloudflare R2 Storage
 *
 * Предоставляет функции для загрузки, удаления файлов и получения публичных URL
 */

import type { R2Bucket } from '@cloudflare/workers-types';

/**
 * Получает R2 bucket из platform environment
 *
 * @param platform - Platform объект из SvelteKit (содержит env)
 * @returns R2Bucket инстанс
 * @throws Error если R2_BUCKET недоступен
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * ```
 */
export function getR2Bucket(platform: any): R2Bucket {
	if (!platform?.env?.R2_BUCKET) {
		throw new Error('R2_BUCKET is not available in platform environment');
	}

	return platform.env.R2_BUCKET as R2Bucket;
}

/**
 * Загружает файл в R2 bucket
 *
 * @param bucket - R2Bucket инстанс
 * @param key - Ключ (путь) файла в bucket
 * @param data - Содержимое файла в виде Uint8Array
 * @param contentType - MIME тип файла (например, 'image/png')
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * const qrData = new Uint8Array([...]);
 * await uploadFile(bucket, 'qr/telegram-123.png', qrData, 'image/png');
 * ```
 */
export async function uploadFile(
	bucket: R2Bucket,
	key: string,
	data: Uint8Array,
	contentType: string
): Promise<void> {
	await bucket.put(key, data, {
		httpMetadata: {
			contentType,
			cacheControl: 'public, max-age=31536000', // Кэшировать на 1 год
		},
	});
}

/**
 * Удаляет файл из R2 bucket
 *
 * @param bucket - R2Bucket инстанс
 * @param key - Ключ (путь) файла в bucket
 * @returns Promise<void>
 *
 * @remarks
 * Не бросает ошибку если файл не существует (идемпотентная операция)
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * await deleteFile(bucket, 'qr/telegram-123.png');
 * ```
 */
export async function deleteFile(bucket: R2Bucket, key: string): Promise<void> {
	await bucket.delete(key);
}

/**
 * Формирует публичный URL для файла в R2
 *
 * @param key - Ключ (путь) файла в bucket
 * @param publicUrl - Публичный URL bucket из env.R2_PUBLIC_URL
 * @returns Полный публичный URL файла
 *
 * @example
 * ```ts
 * const url = getPublicUrl('qr/telegram-123.png', env.R2_PUBLIC_URL);
 * // Результат: 'https://bucket.r2.dev/qr/telegram-123.png'
 * ```
 */
export function getPublicUrl(key: string, publicUrl: string): string {
	// Убираем trailing slash из publicUrl если есть
	const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;

	// Убираем leading slash из key если есть
	const cleanKey = key.startsWith('/') ? key.slice(1) : key;

	return `${baseUrl}/${cleanKey}`;
}

/**
 * Извлекает ключ (путь) файла из полного URL
 *
 * @param input - Полный URL файла или уже ключ
 * @returns Ключ файла (путь в bucket)
 *
 * @example
 * ```ts
 * extractKey('https://bucket.r2.dev/qr/telegram-123.png')
 * // Результат: 'qr/telegram-123.png'
 *
 * extractKey('qr/telegram-123.png')
 * // Результат: 'qr/telegram-123.png'
 * ```
 */
export function extractKey(input: string): string {
	// Если это уже ключ (не URL), возвращаем как есть
	if (!input.startsWith('http://') && !input.startsWith('https://')) {
		return input.startsWith('/') ? input.slice(1) : input;
	}

	try {
		const url = new URL(input);
		// Удаляем начальный слэш из pathname
		return url.pathname.substring(1);
	} catch {
		// Если парсинг URL не удался, возвращаем как есть
		return input.startsWith('/') ? input.slice(1) : input;
	}
}

/**
 * Удаляет файл из R2 bucket по полному URL или ключу
 *
 * @param bucket - R2Bucket инстанс
 * @param fileUrl - Полный URL файла или ключ
 * @returns Promise<void>
 *
 * @remarks
 * Автоматически извлекает ключ из URL если передан полный URL.
 * Не бросает ошибку если файл не существует.
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * await deleteFileByUrl(bucket, 'https://bucket.r2.dev/qr/telegram-123.png');
 * // или
 * await deleteFileByUrl(bucket, 'qr/telegram-123.png');
 * ```
 */
export async function deleteFileByUrl(bucket: R2Bucket, fileUrl: string | null): Promise<void> {
	if (!fileUrl) {
		return;
	}

	const key = extractKey(fileUrl);
	await deleteFile(bucket, key);
}

/**
 * Удаляет несколько файлов из R2 bucket параллельно
 *
 * @param bucket - R2Bucket инстанс
 * @param urls - Массив URL файлов или ключей для удаления
 * @returns Promise<number> - Количество успешно удалённых файлов
 *
 * @remarks
 * Выполняет удаление параллельно через Promise.all.
 * Пропускает null/undefined значения в массиве.
 * Не бросает ошибку при неудачном удалении отдельного файла.
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * const count = await deleteFilesByUrls(bucket, [
 *   'https://bucket.r2.dev/qr/telegram-123.png',
 *   'qr/whatsapp-123.png',
 *   null
 * ]);
 * console.log(`Удалено ${count} файлов`);
 * ```
 */
export async function deleteFilesByUrls(
	bucket: R2Bucket,
	urls: (string | null)[]
): Promise<number> {
	const validUrls = urls.filter((url): url is string => url !== null && url !== undefined);

	if (validUrls.length === 0) {
		return 0;
	}

	try {
		// Удаляем файлы параллельно
		await Promise.all(validUrls.map((url) => deleteFileByUrl(bucket, url)));
		return validUrls.length;
	} catch (error) {
		console.error('Error deleting files from R2:', error);
		// Даже при ошибке некоторые файлы могли быть удалены
		// Возвращаем 0 для безопасности
		return 0;
	}
}

/**
 * Проверяет существование файла в R2 bucket
 *
 * @param bucket - R2Bucket инстанс
 * @param keyOrUrl - Ключ файла или полный URL
 * @returns Promise<boolean> - true если файл существует
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * const exists = await fileExists(bucket, 'qr/telegram-123.png');
 * if (exists) {
 *   console.log('Файл существует');
 * }
 * ```
 */
export async function fileExists(bucket: R2Bucket, keyOrUrl: string): Promise<boolean> {
	try {
		const key = extractKey(keyOrUrl);
		const object = await bucket.head(key);
		return object !== null;
	} catch (error) {
		console.error('Error checking file existence in R2:', error);
		return false;
	}
}
