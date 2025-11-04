# Cloudflare Turnstile - Защита от ботов

## 📋 Оглавление

- [Обзор](#обзор)
- [Получение ключей](#получение-ключей)
- [Настройка окружения](#настройка-окружения)
- [Архитектура](#архитектура)
- [Интеграция](#интеграция)
- [Где включено](#где-включено)
- [Тестирование](#тестирование)
- [Отладка](#отладка)
- [Best Practices](#best-practices)

---

## Обзор

**Cloudflare Turnstile** — это невидимая альтернатива CAPTCHA от Cloudflare для защиты форм от ботов. В отличие от традиционных CAPTCHA, Turnstile:

- ✅ **Невидимый для пользователей** — работает в фоне без необходимости решать головоломки
- ✅ **Бесплатный** — неограниченное количество запросов
- ✅ **Быстрый** — минимальная задержка верификации
- ✅ **Privacy-friendly** — не использует cookies и не отслеживает пользователей
- ✅ **Интегрирован с Cloudflare** — нативная поддержка в Workers

### Принцип работы

1. **Клиент**: Пользователь загружает форму → Turnstile SDK анализирует браузер в фоне
2. **Клиент**: Turnstile генерирует токен и добавляет его в форму
3. **Сервер**: При отправке формы сервер верифицирует токен через Turnstile API
4. **Сервер**: Если токен валиден — запрос обрабатывается, иначе — возвращается ошибка 403

---

## Получение ключей

### 1. Перейдите в Cloudflare Dashboard

[https://dash.cloudflare.com/?to=/:account/turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)

### 2. Создайте новый Site

- **Site Name**: `Berufsorientierung` (любое описательное имя)
- **Domain**: `kolibri-dresden.de` (или `localhost` для разработки)
- **Widget Mode**:
  - **Managed** (рекомендуется) — автоматически определяет ботов
  - **Non-Interactive** — всегда невидимый
  - **Invisible** — можно вызвать программно

### 3. Сохраните ключи

После создания вы получите:

- **Site Key** (публичный) — используется на клиенте
- **Secret Key** (приватный) — используется на сервере для верификации

**⚠️ ВАЖНО**: Secret Key **НИКОГДА** не должен попадать в клиентский код!

---

## Настройка окружения

### 1. Локальная разработка

Добавьте в `.env`:

```bash
# Cloudflare Turnstile (защита от ботов)
TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

### 2. Production (Cloudflare Workers)

#### Добавьте Site Key в `wrangler.toml`:

```toml
[vars]
TURNSTILE_SITE_KEY = "your_turnstile_site_key"
```

**Примечание**: Site Key безопасно хранить в plain text, так как он всё равно виден в клиентском коде.

#### Добавьте Secret Key через CLI:

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

Введите ваш **Secret Key** когда система попросит.

### 3. Проверка конфигурации

После настройки убедитесь, что:

- ✅ `TURNSTILE_SITE_KEY` доступен в `platform.env` на сервере
- ✅ `TURNSTILE_SECRET_KEY` НЕ виден в коде или конфиге
- ✅ В `src/app.d.ts` добавлены типы для ключей

---

## Архитектура

### Серверная часть

#### `src/lib/server/middleware/turnstile.ts`

Основной middleware для верификации токенов:

```typescript
/**
 * Верифицирует Turnstile токен на стороне сервера
 * @throws Error с кодом 403 при неуспешной верификации
 */
export async function verifyTurnstile(
	env: App.Platform['env'],
	token: string,
	ip?: string
): Promise<void>;

/**
 * Извлекает токен из FormData или JSON
 */
export function extractTurnstileToken(data: FormData | Record<string, unknown>): string;
```

**Процесс верификации:**

1. Проверяет наличие токена
2. Проверяет наличие `TURNSTILE_SECRET_KEY`
3. Отправляет POST запрос к `https://challenges.cloudflare.com/turnstile/v0/siteverify`
4. Парсит ответ и проверяет поле `success`
5. При неуспехе бросает понятную ошибку

### Клиентская часть

#### `src/lib/components/security/Turnstile.svelte`

Svelte компонент для рендеринга виджета:

```svelte
<Turnstile
  siteKey={data.turnstileSiteKey}
  action="register"  // Опционально: для аналитики
  theme="auto"       // light | dark | auto
/>
```

**Особенности:**

- Автоматически загружает Turnstile SDK
- Рендерит невидимый виджет
- Добавляет скрытое поле `cf-turnstile-response` в родительскую форму
- Автоматически обновляет токен при истечении

---

## Интеграция

### Шаг 1: Обновите `+page.server.ts`

Передайте `turnstileSiteKey` из окружения:

```typescript
export const load: ServerLoad = async ({ locals, platform }) => {
	return {
		csrfToken: locals.csrfToken,
		turnstileSiteKey: platform?.env.TURNSTILE_SITE_KEY || '',
	};
};
```

### Шаг 2: Добавьте компонент в форму

```svelte
<script lang="ts">
	import Turnstile from '$lib/components/security/Turnstile.svelte';

	export let data: { turnstileSiteKey?: string };
</script>

<form on:submit={handleSubmit}>
	<!-- Ваши поля формы -->

	<!-- Turnstile виджет -->
	{#if data.turnstileSiteKey}
		<Turnstile siteKey={data.turnstileSiteKey} action="login" />
	{/if}

	<button type="submit">Войти</button>
</form>
```

### Шаг 3: Извлеките токен при отправке

```typescript
async function handleSubmit(event: Event) {
	event.preventDefault();

	const form = event.target as HTMLFormElement;
	const turnstileToken =
		form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value || '';

	if (!turnstileToken) {
		errorMessage = 'Подтвердите, что вы не робот';
		return;
	}

	// Отправляем на сервер
	const response = await fetch('/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email,
			password,
			turnstileToken, // ← Добавляем токен
		}),
	});
}
```

### Шаг 4: Верифицируйте на сервере

```typescript
import { verifyTurnstile, extractTurnstileToken } from '$lib/server/middleware/turnstile';

export async function POST(event: RequestEvent) {
	const { request, platform } = event;
	const requestData = await request.json();

	// Извлекаем и верифицируем Turnstile токен
	const turnstileToken = extractTurnstileToken(requestData);
	const ipAddress = getClientIP(request);

	try {
		await verifyTurnstile(platform?.env, turnstileToken, ipAddress || undefined);
	} catch (error) {
		return json({ error: 'Turnstile verification failed' }, { status: 403 });
	}

	// Продолжаем обработку запроса...
}
```

---

## Где включено

Turnstile интегрирован в следующие критичные формы:

### ✅ 1. Регистрация

- **Клиент**: `src/routes/register/+page.svelte`
- **Сервер**: `src/routes/api/auth/register/+server.ts`
- **Action**: `"register"`

### ✅ 2. Вход в систему

- **Клиент**: `src/routes/login/+page.svelte`
- **Сервер**: `src/routes/api/auth/login/+server.ts`
- **Action**: `"login"`

### ✅ 3. Массовая рассылка (Newsletter)

- **Клиент**: `src/routes/admin/newsletter/+page.svelte` _(когда будет создан)_
- **Сервер**: `src/routes/api/admin/newsletter/send/+server.ts` _(когда будет создан)_
- **Action**: `"newsletter"`

---

## Тестирование

### Локальное тестирование

Для локальной разработки можно использовать **тестовые ключи** от Cloudflare:

```bash
# Тестовые ключи (всегда проходят верификацию)
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

**⚠️ НЕ используйте тестовые ключи в production!**

### Unit тесты

Для тестирования в `vitest` создайте моки для Turnstile API:

```typescript
// tests/unit/turnstile.test.ts
import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstile } from '$lib/server/middleware/turnstile';

describe('Turnstile verification', () => {
	it('должен успешно верифицировать валидный токен', async () => {
		// Мокируем fetch для успешного ответа
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			})
		) as any;

		const env = {
			TURNSTILE_SECRET_KEY: 'test_secret',
		};

		await expect(verifyTurnstile(env as any, 'valid_token', '127.0.0.1')).resolves.not.toThrow();
	});

	it('должен бросить ошибку для невалидного токена', async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: false,
						'error-codes': ['invalid-input-response'],
					}),
			})
		) as any;

		const env = {
			TURNSTILE_SECRET_KEY: 'test_secret',
		};

		await expect(verifyTurnstile(env as any, 'invalid_token', '127.0.0.1')).rejects.toThrow();
	});

	it('должен бросить ошибку для пустого токена', async () => {
		const env = {
			TURNSTILE_SECRET_KEY: 'test_secret',
		};

		await expect(verifyTurnstile(env as any, '', '127.0.0.1')).rejects.toThrow(
			'Токен Turnstile отсутствует'
		);
	});
});
```

### Integration тесты

```typescript
// tests/integration/auth-turnstile.test.ts
import { describe, it, expect } from 'vitest';

describe('POST /api/auth/register с Turnstile', () => {
	it('должен вернуть 403 без Turnstile токена', async () => {
		const response = await fetch('http://localhost:5173/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: 'test@example.com',
				password: 'password123',
				// turnstileToken отсутствует
			}),
		});

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toContain('Turnstile');
	});
});
```

---

## Отладка

### Проверка токена на клиенте

Откройте DevTools Console и выполните:

```javascript
// Проверить наличие Turnstile SDK
console.log(window.turnstile);

// Получить токен из формы
const token = document.querySelector('input[name="cf-turnstile-response"]')?.value;
console.log('Turnstile Token:', token);
```

### Логирование на сервере

Включите логирование в `turnstile.ts`:

```typescript
console.log('Turnstile verification successful:', {
	challenge_ts: data.challenge_ts,
	hostname: data.hostname,
});
```

### Частые ошибки

| Ошибка                   | Причина                        | Решение                                                        |
| ------------------------ | ------------------------------ | -------------------------------------------------------------- |
| `missing-input-response` | Токен не предоставлен клиентом | Убедитесь, что виджет рендерится и токен извлекается правильно |
| `invalid-input-response` | Токен истёк или невалиден      | Turnstile автоматически обновляет токены, проверьте таймауты   |
| `timeout-or-duplicate`   | Токен использован повторно     | Каждый токен можно использовать только один раз                |
| `invalid-input-secret`   | Неверный Secret Key            | Проверьте `TURNSTILE_SECRET_KEY` в окружении                   |

---

## Best Practices

### 🔒 Безопасность

1. **Никогда не храните Secret Key в коде или публичных конфигах**
   - ✅ Используйте `wrangler secret put`
   - ❌ Не коммитьте Secret Key в Git

2. **Всегда проверяйте токен на сервере**
   - ❌ Не полагайтесь только на клиентскую валидацию
   - ✅ Верифицируйте каждый запрос через `verifyTurnstile()`

3. **Добавляйте IP адрес при верификации**
   ```typescript
   const ip = getClientIP(request);
   await verifyTurnstile(env, token, ip || undefined);
   ```

### 🎨 UX

1. **Показывайте понятные сообщения при ошибках**

   ```typescript
   if (!turnstileToken) {
   	errorMessage = $_('validation.turnstile_required', {
   		default: 'Подтвердите, что вы не робот',
   	});
   }
   ```

2. **Не блокируйте форму во время загрузки виджета**
   - Turnstile загружается асинхронно
   - Форма должна оставаться интерактивной

3. **Используйте `action` для аналитики**
   ```svelte
   <Turnstile {siteKey} action="login" />
   ```
   Это поможет анализировать паттерны атак в Cloudflare Dashboard

### ⚡ Производительность

1. **Загружайте SDK только когда нужно**
   - Компонент автоматически проверяет `window.turnstile`
   - Не дублируйте скрипты

2. **Кешируйте Site Key на клиенте**
   ```typescript
   // Передаём через load функцию, а не на каждый рендер
   export const load: ServerLoad = async ({ platform }) => {
   	return { turnstileSiteKey: platform?.env.TURNSTILE_SITE_KEY };
   };
   ```

### 📊 Мониторинг

1. **Логируйте неудачные верификации**

   ```typescript
   console.error('Turnstile verification failed:', {
   	errorCodes,
   	ip: clientIP,
   	endpoint: '/api/auth/register',
   });
   ```

2. **Следите за метриками в Cloudflare Dashboard**
   - Количество challenges
   - Success rate
   - Блокированные боты

---

## Ссылки

- 📖 [Официальная документация Turnstile](https://developers.cloudflare.com/turnstile/)
- 🔧 [Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
- 🧪 [Testing Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- 💬 [Cloudflare Community](https://community.cloudflare.com/)

---

## Changelog

### 2025-11-04 - Начальная интеграция

- ✅ Создан middleware `verifyTurnstile()`
- ✅ Создан компонент `Turnstile.svelte`
- ✅ Интегрирован в формы регистрации и логина
- ✅ Добавлена документация
- ⏳ Ожидается интеграция в форму массовой рассылки (после её создания)
