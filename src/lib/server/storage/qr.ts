/**
 * QR-РєРѕРґ РіРµРЅРµСЂР°С‚РѕСЂ РґР»СЏ Cloudflare Workers
 * Р“РµРЅРµСЂРёСЂСѓРµС‚ SVG QR-РєРѕРґС‹ РґР»СЏ СЃСЃС‹Р»РѕРє РЅР° Telegram/WhatsApp РјРµСЂРѕРїСЂРёСЏС‚РёР№
 */

import QRCode from 'qrcode';
import type { R2Bucket } from '@cloudflare/workers-types';
import { getPublicUrl } from './r2';

/**
 * Р“РµРЅРµСЂРёСЂСѓРµС‚ SVG QR-РєРѕРґ РёР· С‚РµРєСЃС‚Р°
 * @param text - РўРµРєСЃС‚ РґР»СЏ РєРѕРґРёСЂРѕРІР°РЅРёСЏ (РѕР±С‹С‡РЅРѕ URL)
 * @returns Promise СЃРѕ СЃС‚СЂРѕРєРѕР№ SVG
 */
export async function generateQRsvg(text: string): Promise<string> {
	try {
		const svg = await QRCode.toString(text, {
			type: 'svg',
			errorCorrectionLevel: 'H', // Р’С‹СЃРѕРєРёР№ СѓСЂРѕРІРµРЅСЊ РєРѕСЂСЂРµРєС†РёРё РѕС€РёР±РѕРє (РґРѕ 30% РїРѕРІСЂРµР¶РґРµРЅРёР№)
			margin: 2, // РћС‚СЃС‚СѓРї РІРѕРєСЂСѓРі QR-РєРѕРґР° (РІ РјРѕРґСѓР»СЏС…)
		});

		return svg;
	} catch (error) {
		throw new Error(
			`Failed to generate QR code SVG: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Р“РµРЅРµСЂРёСЂСѓРµС‚ QR-РєРѕРґ Рё Р·Р°РіСЂСѓР¶Р°РµС‚ РµРіРѕ РІ R2 Storage
 * @param bucket - R2 bucket РґР»СЏ Р·Р°РіСЂСѓР·РєРё
 * @param publicUrl - Р‘Р°Р·РѕРІС‹Р№ РїСѓР±Р»РёС‡РЅС‹Р№ URL R2 bucket (РЅР°РїСЂРёРјРµСЂ: https://r2.domain.com)
 * @param eventId - ID РјРµСЂРѕРїСЂРёСЏС‚РёСЏ
 * @param link - РЎСЃС‹Р»РєР° РґР»СЏ РєРѕРґРёСЂРѕРІР°РЅРёСЏ (Telegram/WhatsApp invite)
 * @param type - РўРёРї СЃСЃС‹Р»РєРё (telegram РёР»Рё whatsapp)
 * @returns Promise СЃ РїСѓР±Р»РёС‡РЅС‹Рј URL Р·Р°РіСЂСѓР¶РµРЅРЅРѕРіРѕ SVG
 */
export async function generateAndUploadQR(
	bucket: R2Bucket,
	publicUrl: string,
	eventId: number,
	link: string,
	type: 'telegram' | 'whatsapp'
): Promise<string> {
	// Р“РµРЅРµСЂР°С†РёСЏ SVG QR-РєРѕРґР°
	const svg = await generateQRsvg(link);

	// Р¤РѕСЂРјРёСЂРѕРІР°РЅРёРµ РєР»СЋС‡Р° РґР»СЏ R2
	const key = `qr-codes/event-${eventId}-${type}.svg`;

	// РџСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёРµ СЃС‚СЂРѕРєРё SVG РІ Р±Р°Р№С‚С‹
	const svgBytes = new TextEncoder().encode(svg);

	// Р—Р°РіСЂСѓР·РєР° РІ R2 СЃ РєРµС€РёСЂРѕРІР°РЅРёРµРј
	await bucket.put(key, svgBytes, {
		httpMetadata: {
			contentType: 'image/svg+xml',
			cacheControl: 'public, max-age=31536000', // РљСЌС€РёСЂРѕРІР°С‚СЊ РЅР° 1 РіРѕРґ
		},
	});

	// Р¤РѕСЂРјРёСЂРѕРІР°РЅРёРµ РїСѓР±Р»РёС‡РЅРѕРіРѕ URL С‡РµСЂРµР· СѓС‚РёР»РёС‚Сѓ РёР· r2.ts
	return getPublicUrl(key, publicUrl);
}

/**
 * РЈРґР°Р»СЏРµС‚ QR-РєРѕРґС‹ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ РёР· R2 Storage
 * @param bucket - R2 bucket
 * @param eventId - ID РјРµСЂРѕРїСЂРёСЏС‚РёСЏ
 */
export async function deleteEventQRs(bucket: R2Bucket, eventId: number): Promise<void> {
	const telegramKey = `qr-codes/event-${eventId}-telegram.svg`;
	const whatsappKey = `qr-codes/event-${eventId}-whatsapp.svg`;

	try {
		// РЈРґР°Р»СЏРµРј РѕР±Р° С„Р°Р№Р»Р° (Promise.all РґР»СЏ РїР°СЂР°Р»Р»РµР»СЊРЅРѕРіРѕ РІС‹РїРѕР»РЅРµРЅРёСЏ)
		await Promise.all([bucket.delete(telegramKey), bucket.delete(whatsappKey)]);
	} catch (error) {
		// РќРµ Р±СЂРѕСЃР°РµРј РѕС€РёР±РєСѓ, РµСЃР»Рё С„Р°Р№Р»РѕРІ РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚ (R2 delete РёРґРµРјРїРѕС‚РµРЅС‚РµРЅ)
		console.warn(
			`Failed to delete QR codes for event ${eventId}:`,
			error instanceof Error ? error.message : 'Unknown error'
		);
	}
}
