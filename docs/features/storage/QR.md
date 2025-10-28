# QR Code Generation Utilities

Утилиты для генерации QR-кодов для Telegram и WhatsApp ссылок.

## Обзор

Модуль `src/lib/server/storage/qr.ts` предоставляет функции для:

- Генерации QR-кодов из URL
- Загрузки QR-кодов в R2 Storage
- Автоматической генерации QR-кодов для мероприятий

## Функции

### generateQRCode

Генерирует QR-код из ссылки и возвращает его в виде `Uint8Array`.

```typescript
import { generateQRCode } from '$lib/server/storage/qr';

const qrData = await generateQRCode('https://t.me/example');
// qrData - это Uint8Array с PNG изображением
```

**Параметры:**

- `url: string` - URL для кодирования в QR-код

**Возвращает:** `Promise<Uint8Array>` - QR-код в формате PNG (300x300px)

**Настройки QR-кода:**

- `errorCorrectionLevel: 'M'` - Средний уровень коррекции ошибок (восстанавливает ~15% данных)
- `type: 'png'` - Формат PNG
- `width: 300` - Размер 300x300 пикселей
- `margin: 2` - Отступ от края 2 модуля

---

### generateAndUploadQRCode

Генерирует QR-код, загружает его в R2 и возвращает публичный URL.

```typescript
import { getR2Bucket } from '$lib/server/storage/r2';
import { generateAndUploadQRCode } from '$lib/server/storage/qr';

const bucket = getR2Bucket(platform);
const qrUrl = await generateAndUploadQRCode(
	bucket,
	'https://t.me/example',
	'qr/telegram-123.png',
	platform.env.R2_PUBLIC_URL
);

console.log('QR код доступен по адресу:', qrUrl);
// Output: https://bucket.r2.dev/qr/telegram-123.png
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket инстанс
- `url: string` - URL для кодирования в QR-код
- `key: string` - Ключ (путь) файла в bucket
- `publicUrl: string` - Публичный URL bucket из env.R2_PUBLIC_URL

**Возвращает:** `Promise<string>` - Публичный URL загруженного QR-кода

**Процесс:**

1. Генерирует QR-код с помощью `generateQRCode()`
2. Загружает в R2 с помощью `uploadFile()`
3. Формирует публичный URL с помощью `getPublicUrl()`

---

### generateEventQRCodes

Генерирует QR-коды для Telegram и WhatsApp ссылок мероприятия.

```typescript
import { getR2Bucket } from '$lib/server/storage/r2';
import { generateEventQRCodes } from '$lib/server/storage/qr';

const bucket = getR2Bucket(platform);
const { telegramQR, whatsappQR } = await generateEventQRCodes(
	bucket,
	123, // eventId
	'https://t.me/kolibri_event',
	'https://chat.whatsapp.com/abc123',
	platform.env.R2_PUBLIC_URL
);

console.log('Telegram QR:', telegramQR);
console.log('WhatsApp QR:', whatsappQR);
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket инстанс
- `eventId: number` - ID мероприятия
- `telegramLink: string | null` - Ссылка на Telegram группу/канал (может быть null)
- `whatsappLink: string | null` - Ссылка на WhatsApp группу (может быть null)
- `publicUrl: string` - Публичный URL bucket из env.R2_PUBLIC_URL

**Возвращает:** `Promise<{ telegramQR: string | null; whatsappQR: string | null }>`

**Поведение:**

- Если `telegramLink` не null → генерирует QR-код с ключом `qr/telegram-{eventId}.png`
- Если `whatsappLink` не null → генерирует QR-код с ключом `qr/whatsapp-{eventId}.png`
- Если ссылка null → соответствующий QR возвращается как null

---

## Использование в приложении

### При создании мероприятия

```typescript
import type { RequestHandler } from './$types';
import { getR2Bucket } from '$lib/server/storage/r2';
import { generateEventQRCodes } from '$lib/server/storage/qr';
import { createEvent } from '$lib/server/db/events';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const db = locals.db;
	const data = await request.json();

	// 1. Создаём мероприятие
	const event = await createEvent(db, {
		...data,
		created_by: locals.user.id,
	});

	// 2. Генерируем QR-коды если есть ссылки
	if (data.telegram_link || data.whatsapp_link) {
		const bucket = getR2Bucket(platform);
		const { telegramQR, whatsappQR } = await generateEventQRCodes(
			bucket,
			event.id,
			data.telegram_link,
			data.whatsapp_link,
			platform.env.R2_PUBLIC_URL
		);

		// 3. Обновляем мероприятие с URL QR-кодов
		await updateEvent(db, event.id, {
			qr_telegram_url: telegramQR,
			qr_whatsapp_url: whatsappQR,
		});
	}

	return new Response(JSON.stringify({ success: true, event }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
```

### При обновлении ссылок мероприятия

```typescript
import type { RequestHandler } from './$types';
import { getR2Bucket, deleteFile } from '$lib/server/storage/r2';
import { generateEventQRCodes } from '$lib/server/storage/qr';
import { getEventById, updateEvent } from '$lib/server/db/events';

export const PUT: RequestHandler = async ({ request, platform, locals, params }) => {
	const db = locals.db;
	const eventId = parseInt(params.id);
	const data = await request.json();

	// Получаем текущее мероприятие
	const event = await getEventById(db, eventId);
	if (!event) {
		return new Response('Event not found', { status: 404 });
	}

	const bucket = getR2Bucket(platform);

	// Если ссылки изменились - удаляем старые QR-коды
	if (data.telegram_link !== event.telegram_link && event.qr_telegram_url) {
		const url = new URL(event.qr_telegram_url);
		await deleteFile(bucket, url.pathname.substring(1));
	}

	if (data.whatsapp_link !== event.whatsapp_link && event.qr_whatsapp_url) {
		const url = new URL(event.qr_whatsapp_url);
		await deleteFile(bucket, url.pathname.substring(1));
	}

	// Генерируем новые QR-коды
	const { telegramQR, whatsappQR } = await generateEventQRCodes(
		bucket,
		eventId,
		data.telegram_link,
		data.whatsapp_link,
		platform.env.R2_PUBLIC_URL
	);

	// Обновляем мероприятие
	await updateEvent(db, eventId, {
		...data,
		qr_telegram_url: telegramQR,
		qr_whatsapp_url: whatsappQR,
	});

	return new Response(JSON.stringify({ success: true }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
```

### Отображение QR-кодов в email

```typescript
import { generateEventQRCodes } from '$lib/server/storage/qr';

// В шаблоне email (текстовый формат)
const emailBody = `
Добро пожаловать на мероприятие!

Telegram группа: ${event.telegram_link}
QR-код: ${event.qr_telegram_url}

WhatsApp группа: ${event.whatsapp_link}
QR-код: ${event.qr_whatsapp_url}
`;
```

---

## Конфигурация

### Установка пакета qrcode

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

### package.json

```json
{
	"dependencies": {
		"qrcode": "^1.5.3"
	},
	"devDependencies": {
		"@types/qrcode": "^1.5.5"
	}
}
```

---

## Важные замечания

1. **Размер QR-кода:** Фиксированный размер 300x300px обеспечивает баланс между читаемостью и размером файла

2. **Формат PNG:** Используется PNG для лучшего качества (без артефактов сжатия JPEG)

3. **Коррекция ошибок:** Уровень 'M' (Medium) восстанавливает до 15% повреждённых данных - оптимально для печати

4. **Кэширование:** QR-коды загружаются в R2 с `Cache-Control: public, max-age=31536000` (1 год) - они статичны и не меняются

5. **Именование файлов:** Ключи формируются как `qr/{type}-{eventId}.png` для предсказуемости и избежания коллизий

6. **Null-safe:** Все функции корректно обрабатывают отсутствие ссылок (null) и возвращают null для соответствующих QR-кодов

7. **Идемпотентность:** При перегенерации QR-кода с тем же ключом старый файл перезаписывается в R2

---

## Производительность

### Размер файлов

Типичный QR-код (300x300px, PNG) весит ~2-5 KB в зависимости от длины URL.

### Время генерации

- Генерация одного QR-кода: ~50-100ms
- Загрузка в R2: ~100-200ms
- **Итого:** ~150-300ms на один QR-код

### Оптимизация

Для минимизации задержек при создании мероприятия:

```typescript
// ✅ Параллельная генерация (быстрее)
const [telegramQR, whatsappQR] = await Promise.all([
	telegramLink ? generateAndUploadQRCode(bucket, telegramLink, ...) : null,
	whatsappLink ? generateAndUploadQRCode(bucket, whatsappLink, ...) : null
]);

// ❌ Последовательная генерация (медленнее)
const telegramQR = telegramLink ? await generateAndUploadQRCode(...) : null;
const whatsappQR = whatsappLink ? await generateAndUploadQRCode(...) : null;
```

**Примечание:** Текущая реализация `generateEventQRCodes()` выполняет генерацию **последовательно**. При необходимости можно оптимизировать через `Promise.all()`.

---

## Типы

```typescript
import type { R2Bucket } from '@cloudflare/workers-types';

// Результат генерации QR-кодов для мероприятия
interface EventQRCodes {
	telegramQR: string | null;
	whatsappQR: string | null;
}
```

---

## См. также

- [R2 Storage Utilities](./R2.md) - Базовые утилиты для работы с R2
- [Event API Documentation](../../database/events/README.md) - API для работы с мероприятиями
- [QRCode package documentation](https://github.com/soldair/node-qrcode) - Документация библиотеки qrcode
