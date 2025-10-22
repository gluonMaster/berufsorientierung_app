/**
 * Storage utilities - R2
 * Утилиты для работы с Cloudflare R2 Storage
 */

import type { R2Bucket } from '@cloudflare/workers-types';

/**
 * Удаляет файл из R2 bucket по URL
 *
 * @param bucket - R2 Bucket instance
 * @param url - Полный URL файла в R2
 * @returns true если файл удалён, false если файл не найден
 * @throws Error если произошла ошибка при удалении
 */
export async function deleteFileByUrl(bucket: R2Bucket, url: string | null): Promise<boolean> {
	if (!url) {
		return false;
	}

	try {
		// Извлекаем ключ файла из URL
		// Формат URL: https://bucket-name.r2.cloudflarestorage.com/path/to/file
		// или custom domain: https://cdn.example.com/path/to/file
		const urlObj = new URL(url);
		const key = urlObj.pathname.substring(1); // Убираем начальный /

		if (!key) {
			console.warn('Empty key extracted from URL:', url);
			return false;
		}

		// Удаляем объект из R2
		await bucket.delete(key);
		console.log('Deleted file from R2:', key);
		return true;
	} catch (error) {
		console.error('Error deleting file from R2:', error);
		throw new Error(
			`Failed to delete file from R2: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Удаляет несколько файлов из R2 bucket по URL
 *
 * @param bucket - R2 Bucket instance
 * @param urls - Массив URL файлов для удаления
 * @returns Количество успешно удалённых файлов
 */
export async function deleteFilesByUrls(
	bucket: R2Bucket,
	urls: (string | null)[]
): Promise<number> {
	let deletedCount = 0;

	for (const url of urls) {
		if (url) {
			try {
				const deleted = await deleteFileByUrl(bucket, url);
				if (deleted) {
					deletedCount++;
				}
			} catch (error) {
				// Логируем ошибку, но продолжаем удаление остальных файлов
				console.error('Failed to delete file:', url, error);
			}
		}
	}

	return deletedCount;
}

/**
 * Загружает файл в R2 bucket
 *
 * @param bucket - R2 Bucket instance
 * @param key - Ключ (путь) файла в bucket
 * @param data - Данные файла (Buffer, ArrayBuffer, string, etc.)
 * @param contentType - MIME тип файла
 * @param publicUrl - Базовый публичный URL bucket (из env)
 * @returns URL загруженного файла
 * @throws Error если произошла ошибка при загрузке
 */
export async function uploadFile(
	bucket: R2Bucket,
	key: string,
	data: ArrayBuffer | string,
	contentType: string,
	publicUrl: string
): Promise<string> {
	try {
		await bucket.put(key, data, {
			httpMetadata: {
				contentType,
			},
		});

		// Формируем полный URL файла
		const url = `${publicUrl.replace(/\/$/, '')}/${key}`;
		console.log('Uploaded file to R2:', key);
		return url;
	} catch (error) {
		console.error('Error uploading file to R2:', error);
		throw new Error(
			`Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Проверяет существование файла в R2 bucket
 *
 * @param bucket - R2 Bucket instance
 * @param key - Ключ (путь) файла в bucket
 * @returns true если файл существует, false если нет
 */
export async function fileExists(bucket: R2Bucket, key: string): Promise<boolean> {
	try {
		const object = await bucket.head(key);
		return object !== null;
	} catch (error) {
		console.error('Error checking file existence in R2:', error);
		return false;
	}
}
