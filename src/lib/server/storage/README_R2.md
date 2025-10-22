# R2 Storage Utilities

Утилиты для работы с Cloudflare R2 Storage.

## Функции

### deleteFileByUrl

Удаляет файл из R2 bucket по полному URL.

```typescript
import { deleteFileByUrl } from '$lib/server/storage/r2';

const deleted = await deleteFileByUrl(
	platform.env.QR_CODES_BUCKET,
	'https://cdn.example.com/qr-codes/telegram-123.png'
);

if (deleted) {
	console.log('File deleted successfully');
}
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket instance
- `url: string | null` - Полный URL файла

**Возвращает:** `Promise<boolean>` - true если удалён, false если файл не найден

### deleteFilesByUrls

Удаляет несколько файлов из R2 bucket.

```typescript
import { deleteFilesByUrls } from '$lib/server/storage/r2';

const urls = [
	'https://cdn.example.com/qr-codes/telegram-123.png',
	'https://cdn.example.com/qr-codes/whatsapp-123.png',
	null, // будет пропущен
];

const deletedCount = await deleteFilesByUrls(platform.env.QR_CODES_BUCKET, urls);
console.log(`Deleted ${deletedCount} files`);
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket instance
- `urls: (string | null)[]` - Массив URL файлов

**Возвращает:** `Promise<number>` - Количество успешно удалённых файлов

### uploadFile

Загружает файл в R2 bucket.

```typescript
import { uploadFile } from '$lib/server/storage/r2';

const qrCodeBuffer = await generateQRCode('https://t.me/example');

const url = await uploadFile(
	platform.env.QR_CODES_BUCKET,
	'qr-codes/telegram-123.png',
	qrCodeBuffer,
	'image/png',
	'https://cdn.example.com' // Публичный URL bucket
);

console.log('File uploaded:', url);
// Output: https://cdn.example.com/qr-codes/telegram-123.png
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket instance
- `key: string` - Ключ (путь) файла в bucket
- `data: ArrayBuffer | string` - Данные файла
- `contentType: string` - MIME тип файла
- `publicUrl: string` - Базовый публичный URL bucket (из env)

**Возвращает:** `Promise<string>` - URL загруженного файла

### fileExists

Проверяет существование файла в R2 bucket.

```typescript
import { fileExists } from '$lib/server/storage/r2';

const exists = await fileExists(platform.env.QR_CODES_BUCKET, 'qr-codes/telegram-123.png');

if (exists) {
	console.log('File exists');
}
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket instance
- `key: string` - Ключ (путь) файла в bucket

**Возвращает:** `Promise<boolean>` - true если файл существует

## Использование в SvelteKit

### В API routes (+server.ts)

```typescript
import type { RequestHandler } from './$types';
import { deleteFileByUrl } from '$lib/server/storage/r2';

export const DELETE: RequestHandler = async ({ platform, params }) => {
	const bucket = platform?.env?.QR_CODES_BUCKET;
	if (!bucket) {
		return new Response('R2 bucket not configured', { status: 500 });
	}

	const fileUrl = params.url;
	await deleteFileByUrl(bucket, fileUrl);

	return new Response('Deleted', { status: 200 });
};
```

### В server load функциях (+page.server.ts)

```typescript
import type { PageServerLoad } from './$types';
import { uploadFile } from '$lib/server/storage/r2';

export const load: PageServerLoad = async ({ platform }) => {
	const bucket = platform?.env?.QR_CODES_BUCKET;
	const publicUrl = platform?.env?.R2_PUBLIC_URL || 'https://cdn.example.com';

	// ...
};
```

## Конфигурация

### wrangler.toml

```toml
[[r2_buckets]]
binding = "QR_CODES_BUCKET"
bucket_name = "berufsorientierung-qr-codes"
preview_bucket_name = "berufsorientierung-qr-codes-preview"
```

### Environment Variables

```bash
# .dev.vars (локальная разработка)
R2_PUBLIC_URL=http://localhost:8787

# Production (через Cloudflare Dashboard или wrangler secret)
R2_PUBLIC_URL=https://cdn.berufsorientierung.com
```

## Важные замечания

1. **URL формат**: Функция `deleteFileByUrl()` извлекает ключ файла из URL путём удаления hostname и начального `/`

2. **Ошибки**: При ошибке удаления функция `deleteFilesByUrls()` логирует ошибку, но продолжает удаление остальных файлов

3. **Null-safe**: Все функции корректно обрабатывают `null` значения URL

4. **Content Type**: При загрузке файлов обязательно указывайте правильный MIME тип для корректной работы браузеров

5. **Публичный доступ**: R2 bucket должен быть настроен на публичный доступ через Custom Domain или R2.dev subdomain

## Интеграция с Events

Утилита автоматически используется в `deleteEvent()`:

```typescript
import { deleteEvent } from '$lib/server/db';

// QR-коды будут автоматически удалены из R2
await deleteEvent(db, eventId, platform.env.QR_CODES_BUCKET);
```

## Типы

Импортируются из `@cloudflare/workers-types`:

- `R2Bucket` - Cloudflare R2 Bucket instance
- `R2Object` - Объект в R2 storage
