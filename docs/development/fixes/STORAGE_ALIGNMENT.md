# Исправление несоответствий Storage модуля

**Дата**: 2025-10-28  
**Тип**: Bugfix / Alignment

## Проблемы

1. **Неверные экспорты в `storage/index.ts`**: экспортировались несуществующие функции
2. **Отсутствие хелперов**: `deleteFileByUrl`, `deleteFilesByUrls`, `fileExists` использовались в коде но не были реализованы
3. **Неверное имя binding**: код ожидал `R2_BUCKET`, но типы и конфиг использовали `QR_BUCKET`
4. **Отсутствие Node.js совместимости**: QR-код генерация требует Buffer support для Workers

## Решения

### 1. Исправлен `src/lib/server/storage/index.ts`

**Было:**

```typescript
export { deleteFileByUrl, deleteFilesByUrls, uploadFile, fileExists } from './r2';
```

**Стало:**

```typescript
export * from './r2';
export * from './qr';
```

**Причина**: Используем wildcard exports для автоматического экспорта всех функций из модулей.

---

### 2. Добавлены хелперы в `src/lib/server/storage/r2.ts`

Новые функции:

#### `extractKey(input: string): string`

- Извлекает ключ файла из полного URL
- Поддерживает как URL так и уже готовые ключи
- Обрабатывает leading slashes

```typescript
extractKey('https://bucket.r2.dev/qr/telegram-123.png');
// → 'qr/telegram-123.png'
```

#### `deleteFileByUrl(bucket, fileUrl): Promise<void>`

- Удаляет файл по URL или ключу
- Автоматически извлекает ключ через `extractKey()`
- Null-safe (пропускает null/undefined)

#### `deleteFilesByUrls(bucket, urls): Promise<number>`

- Удаляет несколько файлов параллельно через `Promise.all`
- Возвращает количество успешно удалённых файлов
- Фильтрует null/undefined значения

#### `fileExists(bucket, keyOrUrl): Promise<boolean>`

- Проверяет существование файла через `bucket.head()`
- Поддерживает как ключ так и URL
- Возвращает `false` при ошибке (fail-safe)

---

### 3. Исправлен `src/app.d.ts`

**Изменения:**

1. Добавлен импорт типов:

```typescript
import type { R2Bucket, D1Database } from '@cloudflare/workers-types';
```

2. Переименован binding:

```typescript
// Было: QR_BUCKET: R2Bucket
// Стало: R2_BUCKET: R2Bucket
```

**Причина**: Код использует `platform.env.R2_BUCKET`, типы должны соответствовать.

---

### 4. Обновлен `wrangler.toml`

**Добавлено:**

```toml
# Node.js совместимость для QR-кодов (Buffer support)
compatibility_flags = ["nodejs_compat"]
```

**Раскомментирован R2 binding:**

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "berufsorientierung-qr-codes"
preview_bucket_name = "berufsorientierung-qr-codes-preview"
```

**Причина**:

- `nodejs_compat` включает поддержку Node.js Buffer API в Cloudflare Workers
- Необходимо для `QRCode.toBuffer()` в `qr.ts`
- Альтернатива: переход на SVG генерацию (но PNG качественнее)

---

### 5. Обновлена документация

**Файл**: `docs/README.md`

Добавлены ссылки на новую документацию:

- `features/storage/README.md` - обзор модуля
- `features/storage/QR.md` - генерация QR-кодов

---

## Влияние на существующий код

### `src/lib/server/db/events.ts`

Импорты теперь работают корректно:

```typescript
import { deleteFilesByUrls } from '$lib/server/storage';
```

Функция `deleteFilesByUrls` теперь реализована и доступна.

### Типизация

App.Platform теперь корректно типизирован:

- `platform.env.R2_BUCKET` → корректный тип `R2Bucket`
- `platform.env.DB` → корректный тип `D1Database`
- TypeScript автоматически подхватывает типы из `@cloudflare/workers-types`

---

## Проверка

Выполните для проверки работоспособности:

```bash
# Проверка TypeScript компиляции
npm run check

# Сборка проекта
npm run build

# Запуск dev сервера (с wrangler)
npm run dev
```

**Ожидаемый результат**: Нет ошибок компиляции, все импорты разрешаются корректно.

---

## Совместимость

### Cloudflare Workers

- ✅ `nodejs_compat` включен в `wrangler.toml`
- ✅ Buffer API доступен для QR генерации
- ✅ R2 binding корректно настроен

### TypeScript

- ✅ Все типы импортированы из `@cloudflare/workers-types`
- ✅ Нет использования `any` без необходимости
- ✅ Platform types корректно декларированы

### Существующий код

- ✅ Все существующие вызовы `deleteFilesByUrls` работают
- ✅ Импорты из `$lib/server/storage` разрешаются
- ✅ Обратная совместимость сохранена

---

## Следующие шаги

1. **Создание R2 bucket** (если ещё не создан):

   ```bash
   wrangler r2 bucket create berufsorientierung-qr-codes
   wrangler r2 bucket create berufsorientierung-qr-codes-preview
   ```

2. **Настройка публичного URL**:
   - Создайте Custom Domain в Cloudflare Dashboard
   - Или используйте автоматический R2.dev subdomain
   - Установите `R2_PUBLIC_URL` в `.dev.vars` и production secrets

3. **Тестирование QR генерации**:

   ```typescript
   import { generateEventQRCodes } from '$lib/server/storage/qr';

   const { telegramQR, whatsappQR } = await generateEventQRCodes(
   	bucket,
   	123,
   	'https://t.me/example',
   	'https://chat.whatsapp.com/example',
   	env.R2_PUBLIC_URL
   );
   ```

---

## См. также

- [R2 Storage Documentation](../features/storage/R2.md)
- [QR Code Generation Documentation](../features/storage/QR.md)
- [Storage Module Overview](../features/storage/README.md)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
