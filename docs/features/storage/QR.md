# QR Code Generation Utilities (SVG)

Утилиты для генерации SVG QR-кодов для Telegram и WhatsApp ссылок.

## Обзор

Модуль `src/lib/server/storage/qr.ts` предоставляет функции для:

- Генерации SVG QR-кодов из текста (URL)
- Загрузки SVG QR-кодов в R2 Storage
- Автоматического удаления QR-кодов мероприятий

**Почему SVG вместо PNG:**

- ✅ Меньший размер файла (~1-2 KB против ~10-15 KB)
- ✅ Масштабирование без потери качества
- ✅ Совместимость с Cloudflare Workers (не требует Canvas API)
- ✅ Быстрая генерация (не требует рендеринга растра)

## Функции

### generateQRsvg

Генерирует SVG QR-код из текста.

```typescript
import { generateQRsvg } from '$lib/server/storage/qr';

const svg = await generateQRsvg('https://t.me/example');
// svg - это строка с SVG разметкой
console.log(svg);
// Output: <svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>
```

**Параметры:**

- `text: string` - Текст для кодирования (обычно URL)

**Возвращает:** `Promise<string>` - Строка с SVG разметкой

**Настройки QR-кода:**

- `type: 'svg'` - Формат SVG (vector)
- `errorCorrectionLevel: 'H'` - Высокий уровень коррекции ошибок (восстанавливает ~30% данных)
- `margin: 2` - Отступ от края 2 модуля

**Ошибки:**

Бросает ошибку если генерация не удалась:

```typescript
try {
	const svg = await generateQRsvg(url);
} catch (error) {
	console.error('Failed to generate QR code SVG:', error);
}
```

---

### generateAndUploadQR

Генерирует SVG QR-код, загружает его в R2 и возвращает публичный URL.

```typescript
import { getR2Bucket } from '$lib/server/storage/r2';
import { generateAndUploadQR } from '$lib/server/storage/qr';

const bucket = getR2Bucket(platform);
const qrUrl = await generateAndUploadQR(
	bucket,
	platform.env.R2_PUBLIC_URL,
	123, // eventId
	'https://t.me/example',
	'telegram'
);

console.log('QR код доступен по адресу:', qrUrl);
// Output: https://cdn.domain.com/qr-codes/event-123-telegram.svg
```

**Параметры:**

- `bucket: R2Bucket` - R2 Bucket инстанс
- `publicUrl: string` - Публичный URL bucket из env.R2_PUBLIC_URL
- `eventId: number` - ID мероприятия
- `link: string` - Ссылка для кодирования (Telegram/WhatsApp invite)
- `type: 'telegram' | 'whatsapp'` - Тип ссылки

**Возвращает:** `Promise<string>` - Публичный URL загруженного SVG

**Процесс:**

1. Генерирует SVG QR-код с помощью `generateQRsvg(link)`
2. Формирует ключ: `qr-codes/event-{eventId}-{type}.svg`
3. Преобразует строку SVG в байты через `TextEncoder`
4. Загружает в R2 с `contentType: 'image/svg+xml'` и кешированием на 1 год
5. Формирует публичный URL через `getPublicUrl()` из `r2.ts`

**Примеры ключей:**

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

1. **Формат SVG:** Используется SVG вместо PNG для меньшего размера (~1-2 KB против ~10-15 KB) и масштабируемости без потери качества

2. **Коррекция ошибок:** Уровень 'H' (High) восстанавливает до 30% повреждённых данных - максимальная надёжность для печати и сканирования

3. **Кэширование:** SVG QR-коды загружаются в R2 с `Cache-Control: public, max-age=31536000` (1 год) - они статичны и не меняются

4. **Именование файлов:** Ключи формируются как `qr-codes/event-{eventId}-{type}.svg` для предсказуемости и избежания коллизий

5. **Идемпотентность:** При перегенерации QR-кода с тем же ключом старый файл перезаписывается в R2

6. **Безопасное удаление:** `deleteEventQRs()` не падает при отсутствии файлов - идемпотентная операция

7. **Cloudflare Workers совместимость:** SVG не требует Canvas API или Node.js буферов - работает в edge runtime

---

## Производительность

### Размер файлов

Типичный SVG QR-код весит ~1-2 KB (в 5-10 раз меньше PNG).

### Время генерации

- Генерация одного SVG QR-кода: ~20-50ms (быстрее PNG)
- Загрузка в R2: ~100-200ms
- **Итого:** ~120-250ms на один QR-код

### Оптимизация

Функция `generateAndUploadQR()` оптимизирована:

✅ Использует `getPublicUrl()` из `r2.ts` для избежания дублирования логики URL
✅ Применяет долгосрочное кэширование автоматически
✅ Минимальный размер файлов благодаря SVG формату

---

## Типы

```typescript
import type { R2Bucket } from '@cloudflare/workers-types';

// Тип ссылки для QR-кода
type QRLinkType = 'telegram' | 'whatsapp';
```

---

## Миграция с PNG на SVG

Если у вас уже есть события с PNG QR-кодами в старом формате (`qr/telegram-*.png`):

1. Перегенерируйте QR-коды через админку или миграционный скрипт
2. Старые PNG файлы можно удалить вручную или оставить (не занимают много места)
3. Новые события автоматически будут использовать SVG формат

---

## См. также

- [R2 Storage Utilities](./R2.md) - Базовые утилиты для работы с R2
- [Event API Documentation](../../database/events/README.md) - API для работы с мероприятиями
- [QRCode package documentation](https://github.com/soldair/node-qrcode) - Документация библиотеки qrcode
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)

```

```
