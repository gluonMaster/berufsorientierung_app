/**
 * Утилиты для генерации QR-кодов
 *
 * Предоставляет функции для генерации QR-кодов для Telegram и WhatsApp ссылок
 */

import QRCode from 'qrcode';
import type { R2Bucket } from '@cloudflare/workers-types';
import { uploadFile, getPublicUrl } from './r2';

/**
 * Генерирует QR-код из ссылки и возвращает его в виде Uint8Array
 *
 * @param url - URL для кодирования в QR-код
 * @returns Promise<Uint8Array> - QR-код в формате PNG
 *
 * @example
 * ```ts
 * const qrData = await generateQRCode('https://t.me/example');
 * ```
 */
export async function generateQRCode(url: string): Promise<Uint8Array> {
	const buffer = await QRCode.toBuffer(url, {
		errorCorrectionLevel: 'M', // Средний уровень коррекции ошибок
		type: 'png',
		width: 300, // Размер 300x300 пикселей
		margin: 2, // Отступ от края
	});

	return new Uint8Array(buffer);
}

/**
 * Генерирует QR-код, загружает его в R2 и возвращает публичный URL
 *
 * @param bucket - R2Bucket инстанс
 * @param url - URL для кодирования в QR-код
 * @param key - Ключ (путь) файла в bucket
 * @param publicUrl - Публичный URL bucket из env.R2_PUBLIC_URL
 * @returns Promise<string> - Публичный URL загруженного QR-кода
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * const qrUrl = await generateAndUploadQRCode(
 *   bucket,
 *   'https://t.me/example',
 *   'qr/telegram-123.png',
 *   env.R2_PUBLIC_URL
 * );
 * ```
 */
export async function generateAndUploadQRCode(
	bucket: R2Bucket,
	url: string,
	key: string,
	publicUrl: string
): Promise<string> {
	// Генерируем QR-код
	const qrData = await generateQRCode(url);

	// Загружаем в R2
	await uploadFile(bucket, key, qrData, 'image/png');

	// Возвращаем публичный URL
	return getPublicUrl(key, publicUrl);
}

/**
 * Генерирует QR-коды для Telegram и WhatsApp ссылок мероприятия
 *
 * @param bucket - R2Bucket инстанс
 * @param eventId - ID мероприятия
 * @param telegramLink - Ссылка на Telegram группу/канал (может быть null)
 * @param whatsappLink - Ссылка на WhatsApp группу (может быть null)
 * @param publicUrl - Публичный URL bucket из env.R2_PUBLIC_URL
 * @returns Promise<{ telegramQR: string | null; whatsappQR: string | null }>
 *
 * @example
 * ```ts
 * const bucket = getR2Bucket(platform);
 * const { telegramQR, whatsappQR } = await generateEventQRCodes(
 *   bucket,
 *   123,
 *   'https://t.me/example',
 *   'https://chat.whatsapp.com/example',
 *   env.R2_PUBLIC_URL
 * );
 * ```
 */
export async function generateEventQRCodes(
	bucket: R2Bucket,
	eventId: number,
	telegramLink: string | null,
	whatsappLink: string | null,
	publicUrl: string
): Promise<{ telegramQR: string | null; whatsappQR: string | null }> {
	const result = {
		telegramQR: null as string | null,
		whatsappQR: null as string | null,
	};

	// Генерируем Telegram QR-код
	if (telegramLink) {
		const key = `qr/telegram-${eventId}.png`;
		result.telegramQR = await generateAndUploadQRCode(bucket, telegramLink, key, publicUrl);
	}

	// Генерируем WhatsApp QR-код
	if (whatsappLink) {
		const key = `qr/whatsapp-${eventId}.png`;
		result.whatsappQR = await generateAndUploadQRCode(bucket, whatsappLink, key, publicUrl);
	}

	return result;
}
