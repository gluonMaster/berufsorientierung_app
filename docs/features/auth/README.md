# Модуль аутентификации

## 📋 Обзор

Модуль аутентификации предоставляет утилиты для безопасной работы с паролями и JWT токенами в среде Cloudflare Workers.

**Местоположение:** `src/lib/server/auth/index.ts`

## 🔧 Используемые библиотеки

- **bcryptjs** - Хеширование паролей (salt rounds: 10)
- **jose** - Генерация и проверка JWT токенов (WebCrypto API)

## 🔐 Функции

### 1. `hashPassword(password: string): Promise<string>`

Хеширует пароль с использованием bcrypt.

**Параметры:**

- `password` - Пароль в открытом виде

**Возвращает:**

- `Promise<string>` - Хешированный пароль

**Особенности:**

- Salt rounds: 10
- Каждый хеш уникален благодаря автоматической генерации salt
- Подходит для хранения в базе данных

**Пример:**

```typescript
const hash = await hashPassword('mySecurePassword123');
// Сохраняем hash в БД
await db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').bind(email, hash).run();
```

---

### 2. `verifyPassword(password: string, hash: string): Promise<boolean>`

Проверяет соответствие пароля хешу.

**Параметры:**

- `password` - Пароль в открытом виде
- `hash` - Хеш из базы данных

**Возвращает:**

- `Promise<boolean>` - `true` если пароль совпадает, `false` в противном случае

**Особенности:**

- При ошибке проверки возвращает `false` (не бросает исключение)
- Безопасно обрабатывает невалидные хеши

**Пример:**

```typescript
const user = await getUserByEmail(email);
const isValid = await verifyPassword(password, user.password_hash);

if (isValid) {
	// Пароль верный - логиним пользователя
	const token = await generateToken(user.id, user.email, env.JWT_SECRET);
} else {
	// Пароль неверный
	throw new Error('Неверный email или пароль');
}
```

---

### 3. `generateToken(userId: number, email: string, secret: string): Promise<string>`

Генерирует JWT токен для пользователя.

**Параметры:**

- `userId` - ID пользователя
- `email` - Email пользователя
- `secret` - Секретный ключ (из `env.JWT_SECRET`)

**Возвращает:**

- `Promise<string>` - JWT токен

**Особенности:**

- Алгоритм: HS256 (HMAC SHA-256)
- Использует WebCrypto API (совместимо с Cloudflare Workers)
- Срок действия: 7 дней
- Включает `iat` (issued at) и `exp` (expiration time)
- Payload: `{ userId, email, iat, exp }`

**Пример:**

```typescript
// После успешного логина
const token = await generateToken(user.id, user.email, env.JWT_SECRET);

// Отправляем токен в cookie
return new Response(JSON.stringify({ success: true }), {
	headers: {
		'Content-Type': 'application/json',
		'Set-Cookie': setAuthCookie(token),
	},
});
```

---

### 4. `verifyToken(token: string, secret: string): Promise<{ userId: number; email: string } | null>`

Проверяет и декодирует JWT токен.

**Параметры:**

- `token` - JWT токен
- `secret` - Секретный ключ (должен совпадать с тем, что использовался при генерации)

**Возвращает:**

- `Promise<{ userId: number; email: string } | null>` - Данные пользователя или `null` если токен невалидный/просрочен

**Особенности:**

- При ошибке проверки или просроченном токене возвращает `null` (не бросает исключение)
- Проверяет подпись токена
- Проверяет срок действия
- Валидирует структуру payload

**Пример:**

```typescript
const token = extractTokenFromRequest(request);
if (!token) {
	throw new Error('Не авторизован');
}

const payload = await verifyToken(token, env.JWT_SECRET);
if (!payload) {
	throw new Error('Невалидный или просроченный токен');
}

// Используем данные пользователя
const user = await getUserById(payload.userId);
```

---

### 5. `extractTokenFromRequest(request: Request): string | null`

Извлекает JWT токен из cookie запроса.

**Параметры:**

- `request` - Объект `Request`

**Возвращает:**

- `string | null` - Токен или `null` если не найден

**Особенности:**

- Парсит header `Cookie`
- Ищет cookie с именем `auth_token`
- Безопасно обрабатывает отсутствие cookie

**Пример:**

```typescript
// В middleware или API route
export async function load({ request, platform }) {
	const token = extractTokenFromRequest(request);

	if (!token) {
		return { user: null };
	}

	const payload = await verifyToken(token, platform.env.JWT_SECRET);
	if (!payload) {
		return { user: null };
	}

	const user = await getUserById(payload.userId);
	return { user };
}
```

---

### 6. `setAuthCookie(token: string, secure?: boolean): string`

Генерирует `Set-Cookie` header для установки auth токена.

**Параметры:**

- `token` - JWT токен для сохранения
- `secure` - (опционально) Использовать Secure флаг. По умолчанию `true`

**Возвращает:**

- `string` - Значение для header `Set-Cookie`

**Настройки cookie:**

- `httpOnly: true` - Недоступно из JavaScript (защита от XSS)
- `secure: configurable` - Только HTTPS (рекомендуется `true` для production)
- `sameSite: 'strict'` - Защита от CSRF
- `maxAge: 7 дней` - Срок действия
- `path: '/'` - Доступно для всего сайта

**Пример:**

```typescript
// Production (Cloudflare Workers - HTTPS обязателен)
const token = await generateToken(user.id, user.email, env.JWT_SECRET);

return new Response(JSON.stringify({ success: true }), {
	headers: {
		'Content-Type': 'application/json',
		'Set-Cookie': setAuthCookie(token, true), // или просто setAuthCookie(token)
	},
});

// Development (локальный HTTP сервер)
return new Response(JSON.stringify({ success: true }), {
	headers: {
		'Content-Type': 'application/json',
		'Set-Cookie': setAuthCookie(token, false), // Отключаем Secure для HTTP
	},
});
```

---

### 7. `clearAuthCookie(secure?: boolean): string`

Генерирует `Set-Cookie` header для удаления auth токена.

**Параметры:**

- `secure` - (опционально) Использовать Secure флаг. По умолчанию `true`

**Возвращает:**

- `string` - Значение для header `Set-Cookie`

**Особенности:**

- Устанавливает `maxAge: 0` для немедленного удаления
- Используется при logout

**Пример:**

```typescript
// При выходе пользователя (Production)
export async function POST({ request }) {
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearAuthCookie(true), // или просто clearAuthCookie()
		},
	});
}

// Development (локальный HTTP)
export async function POST({ request }) {
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearAuthCookie(false),
		},
	});
}
```

---

## 🔄 Типичные сценарии использования

### Регистрация нового пользователя

```typescript
import { hashPassword, generateToken, setAuthCookie } from '$lib/server/auth';

export async function POST({ request, platform }) {
	const { email, password } = await request.json();

	// 1. Хешируем пароль
	const passwordHash = await hashPassword(password);

	// 2. Сохраняем пользователя
	const result = await platform.env.DB.prepare(
		'INSERT INTO users (email, password_hash) VALUES (?, ?)'
	)
		.bind(email, passwordHash)
		.run();

	const userId = result.meta.last_row_id;

	// 3. Генерируем токен
	const token = await generateToken(userId, email, platform.env.JWT_SECRET);

	// 4. Отправляем токен в cookie
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': setAuthCookie(token),
		},
	});
}
```

### Вход пользователя

```typescript
import { verifyPassword, generateToken, setAuthCookie } from '$lib/server/auth';

export async function POST({ request, platform }) {
	const { email, password } = await request.json();

	// 1. Получаем пользователя
	const user = await platform.env.DB.prepare(
		'SELECT id, email, password_hash FROM users WHERE email = ?'
	)
		.bind(email)
		.first();

	if (!user) {
		return new Response(JSON.stringify({ error: 'Неверный email или пароль' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// 2. Проверяем пароль
	const isValid = await verifyPassword(password, user.password_hash);

	if (!isValid) {
		return new Response(JSON.stringify({ error: 'Неверный email или пароль' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// 3. Генерируем токен
	const token = await generateToken(user.id, user.email, platform.env.JWT_SECRET);

	// 4. Отправляем токен в cookie
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': setAuthCookie(token),
		},
	});
}
```

### Проверка аутентификации в middleware

```typescript
import { extractTokenFromRequest, verifyToken } from '$lib/server/auth';

export async function load({ request, platform }) {
	// 1. Извлекаем токен
	const token = extractTokenFromRequest(request);

	if (!token) {
		return { user: null };
	}

	// 2. Проверяем токен
	const payload = await verifyToken(token, platform.env.JWT_SECRET);

	if (!payload) {
		return { user: null };
	}

	// 3. Загружаем полные данные пользователя
	const user = await platform.env.DB.prepare(
		'SELECT id, email, first_name, last_name FROM users WHERE id = ?'
	)
		.bind(payload.userId)
		.first();

	return { user };
}
```

### Выход пользователя

```typescript
import { clearAuthCookie } from '$lib/server/auth';

export async function POST() {
	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearAuthCookie(),
		},
	});
}
```

---

## 🧪 Тестирование

Модуль покрыт unit тестами: `tests/unit/auth.test.ts`

**Запуск тестов:**

```bash
npm test -- auth.test.ts
```

**Покрытие тестами:**

- ✅ Хеширование паролей
- ✅ Проверка паролей (правильные/неправильные)
- ✅ Генерация JWT токенов
- ✅ Проверка JWT токенов (валидные/невалидные/просроченные)
- ✅ Извлечение токена из cookies
- ✅ Установка/удаление auth cookies
- ✅ Интеграционные тесты полного цикла auth

---

## 🔒 Безопасность

### Хеширование паролей

- ✅ Используется bcrypt с 10 rounds (рекомендованное значение)
- ✅ Автоматическая генерация уникальных salt для каждого пароля
- ✅ Защита от rainbow table attacks

### JWT токены

- ✅ Алгоритм HS256 (HMAC SHA-256)
- ✅ Использование WebCrypto API
- ✅ Срок действия 7 дней
- ✅ Проверка подписи при каждой верификации
- ✅ Автоматическая проверка срока действия

### Cookies

- ✅ `httpOnly: true` - Защита от XSS атак
- ✅ `secure: configurable` - Рекомендуется `true` для production (HTTPS)
- ✅ `sameSite: 'strict'` - Защита от CSRF атак
- ✅ Короткий срок жизни (7 дней)
- ✅ Совместимо с Cloudflare Workers (не использует `process.env`)

### Error Handling

- ✅ Все ошибки безопасно обрабатываются
- ✅ Не раскрывается чувствительная информация
- ✅ При ошибках возвращается `false` или `null` (не бросаются исключения)

---

## 📝 Переменные окружения

Требуется переменная окружения в `wrangler.toml` или `.env`:

```toml
[vars]
JWT_SECRET = "your-secret-key-minimum-32-characters-long"
```

**⚠️ ВАЖНО:**

- Секрет должен быть минимум 32 символа
- Использовать криптографически стойкий случайный ключ
- НЕ коммитить секреты в Git
- Использовать разные секреты для dev/staging/production

**📌 Примечание о Cloudflare Workers:**

Модуль не использует `process.env.NODE_ENV` в runtime коде, так как это недоступно в Cloudflare Workers. Вместо этого функции `setAuthCookie()` и `clearAuthCookie()` принимают параметр `secure` для явного управления Secure флагом cookie:

```typescript
// Production (Cloudflare Workers)
setAuthCookie(token, true); // Secure=true по умолчанию

// Development (локальный HTTP)
setAuthCookie(token, false); // Явно отключаем Secure
```

- Использовать разные секреты для dev/staging/production

**Генерация секрета:**

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# OpenSSL
openssl rand -base64 32
```

---

## 🔗 Связанные модули

- **[Auth Middleware](./MIDDLEWARE.md)** - Middleware для проверки аутентификации и авторизации
- **Database Users** (`src/lib/server/db/users.ts`) - Операции с пользователями
- **Database Admin** (`src/lib/server/db/admin.ts`) - Проверка прав администратора
- **API Routes** (`src/routes/api/auth/`) - API endpoints для регистрации/логина/logout

---

## 📚 Дополнительные ресурсы

- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)
- [jose Documentation](https://github.com/panva/jose)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
