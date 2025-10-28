# Storage - Документация

Утилиты для работы с хранилищем файлов (Cloudflare R2 Storage).

## Обзор

Модуль storage предоставляет функционал для:

- Загрузки и удаления файлов в Cloudflare R2
- Генерации QR-кодов для Telegram/WhatsApp ссылок
- Управления публичными URL файлов

## Документация

### [R2 Storage Utilities](./R2.md)

Базовые утилиты для работы с Cloudflare R2 Storage.

**Основные функции:**

- `getR2Bucket(platform)` - Получение R2 bucket из platform environment
- `uploadFile(bucket, key, data, contentType)` - Загрузка файла в R2
- `deleteFile(bucket, key)` - Удаление файла из R2
- `getPublicUrl(key, publicUrl)` - Формирование публичного URL

**Использование:**

```typescript
import { getR2Bucket, uploadFile, getPublicUrl } from '$lib/server/storage/r2';

const bucket = getR2Bucket(platform);
await uploadFile(bucket, 'qr/telegram-123.png', qrData, 'image/png');
const url = getPublicUrl('qr/telegram-123.png', env.R2_PUBLIC_URL);
```

---

### [QR Code Generation](./QR.md)

Утилиты для генерации QR-кодов.

**Основные функции:**

- `generateQRCode(url)` - Генерация QR-кода из URL
- `generateAndUploadQRCode(bucket, url, key, publicUrl)` - Генерация и загрузка в R2
- `generateEventQRCodes(bucket, eventId, telegramLink, whatsappLink, publicUrl)` - Генерация QR для мероприятия

**Использование:**

```typescript
import { generateEventQRCodes } from '$lib/server/storage/qr';

const { telegramQR, whatsappQR } = await generateEventQRCodes(
	bucket,
	eventId,
	'https://t.me/example',
	'https://chat.whatsapp.com/abc',
	env.R2_PUBLIC_URL
);
```

---

## Конфигурация

### wrangler.toml

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "berufsorientierung-qr-codes"
preview_bucket_name = "berufsorientierung-qr-codes-preview"
```

### Environment Variables

```env
# Публичный URL для R2 bucket
R2_PUBLIC_URL=https://cdn.berufsorientierung.com
```

### Dependencies

```bash
npm install qrcode @cloudflare/workers-types
npm install --save-dev @types/qrcode
```

---

## Архитектура

```
src/lib/server/storage/
├── r2.ts        # Базовые операции с R2 (загрузка, удаление, URL)
└── qr.ts        # Генерация QR-кодов (использует r2.ts)
```

**Зависимости:**

- `qr.ts` → `r2.ts` (генерация QR зависит от функций R2)
- `r2.ts` → `@cloudflare/workers-types` (типы R2Bucket)
- `qr.ts` → `qrcode` (библиотека для генерации QR)

---

## Типовые сценарии

### 1. Создание мероприятия с QR-кодами

```typescript
import { getR2Bucket } from '$lib/server/storage/r2';
import { generateEventQRCodes } from '$lib/server/storage/qr';
import { createEvent, updateEvent } from '$lib/server/db/events';

// Создаём мероприятие
const event = await createEvent(db, eventData);

// Генерируем QR-коды
const bucket = getR2Bucket(platform);
const { telegramQR, whatsappQR } = await generateEventQRCodes(
	bucket,
	event.id,
	eventData.telegram_link,
	eventData.whatsapp_link,
	platform.env.R2_PUBLIC_URL
);

// Обновляем мероприятие с URL QR-кодов
await updateEvent(db, event.id, {
	qr_telegram_url: telegramQR,
	qr_whatsapp_url: whatsappQR,
});
```

### 2. Удаление мероприятия с очисткой QR-кодов

```typescript
import { getR2Bucket, deleteFile } from '$lib/server/storage/r2';
import { getEventById, deleteEvent } from '$lib/server/db/events';

const event = await getEventById(db, eventId);
const bucket = getR2Bucket(platform);

// Удаляем QR-коды из R2
if (event.qr_telegram_url) {
	const url = new URL(event.qr_telegram_url);
	await deleteFile(bucket, url.pathname.substring(1));
}

if (event.qr_whatsapp_url) {
	const url = new URL(event.qr_whatsapp_url);
	await deleteFile(bucket, url.pathname.substring(1));
}

// Удаляем мероприятие из БД
await deleteEvent(db, eventId);
```

### 3. Обновление ссылок с перегенерацией QR

```typescript
import { getR2Bucket, deleteFile } from '$lib/server/storage/r2';
import { generateEventQRCodes } from '$lib/server/storage/qr';

// Удаляем старые QR-коды
if (oldEvent.qr_telegram_url) {
	const url = new URL(oldEvent.qr_telegram_url);
	await deleteFile(bucket, url.pathname.substring(1));
}

// Генерируем новые QR-коды
const { telegramQR, whatsappQR } = await generateEventQRCodes(
	bucket,
	eventId,
	newTelegramLink,
	newWhatsappLink,
	platform.env.R2_PUBLIC_URL
);
```

---

## Лимиты Cloudflare R2 (Free tier)

- **Storage:** 10 GB
- **Class A operations** (put, list): 1,000,000/month
- **Class B operations** (get, head): 10,000,000/month
- **Egress:** 10 GB/month (для чтения файлов)

**Рекомендации:**

- Используйте долгосрочное кэширование (уже реализовано: `max-age=31536000`)
- Не перегенерируйте QR-коды без необходимости
- При удалении мероприятия всегда очищайте QR-коды

---

## См. также

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [QRCode library](https://github.com/soldair/node-qrcode)
- [Events Database Documentation](../../database/events/README.md)
