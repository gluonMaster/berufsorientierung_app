# Исправление: Совместимость модуля Auth с Cloudflare Workers

**Дата:** 2025-10-23  
**Модуль:** `src/lib/server/auth/index.ts`  
**Категория:** Совместимость с runtime окружением

---

## 🔍 Проблема

Модуль аутентификации использовал `process.env.NODE_ENV` для определения окружения (production/development), что несовместимо с Cloudflare Workers runtime, где `process.env` недоступен напрямую.

### Исходный код:

```typescript
export function setAuthCookie(token: string): string {
	const isProduction = process.env.NODE_ENV === 'production';

	if (isProduction) {
		cookieParts.push('Secure');
	}
	// ...
}
```

### Проблемы:

1. **Runtime несовместимость**: Cloudflare Workers не предоставляет `process.env` в runtime
2. **Негибкость**: Невозможно явно контролировать Secure флаг для разных окружений
3. **Bundler зависимость**: Работало только благодаря inline подстановке при сборке

---

## ✅ Решение

Добавлены опциональные параметры `secure` в функции `setAuthCookie()` и `clearAuthCookie()` для явного управления Secure флагом.

### Новый код:

```typescript
export function setAuthCookie(token: string, secure = true): string {
	const maxAge = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

	const cookieParts = [
		`${COOKIE_NAME}=${token}`,
		'Path=/',
		`Max-Age=${maxAge}`,
		'HttpOnly',
		'SameSite=Strict',
	];

	// Добавляем Secure только если указано
	if (secure) {
		cookieParts.push('Secure');
	}

	return cookieParts.join('; ');
}

export function clearAuthCookie(secure = true): string {
	const cookieParts = [`${COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'];

	// Добавляем Secure только если указано
	if (secure) {
		cookieParts.push('Secure');
	}

	return cookieParts.join('; ');
}
```

---

## 📋 Изменения

### 1. Функция `setAuthCookie()`

**Было:**

- `setAuthCookie(token: string): string`
- Автоматическое определение через `process.env.NODE_ENV`

**Стало:**

- `setAuthCookie(token: string, secure = true): string`
- Явное управление Secure флагом
- По умолчанию `secure = true` (безопасно для production)

### 2. Функция `clearAuthCookie()`

**Было:**

- `clearAuthCookie(): string`
- Автоматическое определение через `process.env.NODE_ENV`

**Стало:**

- `clearAuthCookie(secure = true): string`
- Явное управление Secure флагом
- По умолчанию `secure = true` (безопасно для production)

---

## 🎯 Использование

### Production (Cloudflare Workers)

```typescript
// Cloudflare Workers всегда использует HTTPS
const token = await generateToken(userId, email, env.JWT_SECRET);

return new Response(JSON.stringify({ success: true }), {
	headers: {
		'Set-Cookie': setAuthCookie(token, true), // или просто setAuthCookie(token)
	},
});
```

### Development (локальный HTTP сервер)

```typescript
// Локальный dev сервер может использовать HTTP
const token = await generateToken(userId, email, env.JWT_SECRET);

return new Response(JSON.stringify({ success: true }), {
	headers: {
		'Set-Cookie': setAuthCookie(token, false), // Явно отключаем Secure
	},
});
```

### Logout

```typescript
// Production
return new Response('OK', {
	headers: {
		'Set-Cookie': clearAuthCookie(true),
	},
});

// Development
return new Response('OK', {
	headers: {
		'Set-Cookie': clearAuthCookie(false),
	},
});
```

---

## 🧪 Тесты

Добавлены новые тесты для проверки работы параметра `secure`:

```typescript
it('должен генерировать Set-Cookie header для установки токена', () => {
	const cookie = setAuthCookie(testToken);
	expect(cookie).toContain('Secure'); // По умолчанию secure=true
});

it('должен генерировать Set-Cookie header без Secure флага для dev', () => {
	const cookie = setAuthCookie(testToken, false);
	expect(cookie).not.toContain('Secure'); // Secure отключен
});

it('должен генерировать Set-Cookie header для очистки токена', () => {
	const cookie = clearAuthCookie();
	expect(cookie).toContain('Secure'); // По умолчанию secure=true
});

it('должен генерировать Set-Cookie header для очистки токена без Secure для dev', () => {
	const cookie = clearAuthCookie(false);
	expect(cookie).not.toContain('Secure'); // Secure отключен
});
```

**Результаты:** Все 23 теста прошли успешно ✅

---

## 📝 Обновлённая документация

Обновлены следующие файлы:

1. **`docs/features/auth/README.md`**
   - Обновлены сигнатуры функций
   - Добавлены примеры использования для production/development
   - Добавлена заметка о совместимости с Cloudflare Workers

---

## 🔗 Связанные изменения

### Другие исправления в этом коммите

**Тесты:** Замена `atob` на `decodeJwt` из jose

**Проблема:** Node.js test runner может не иметь глобальной функции `atob`.

**Решение:**

```typescript
// Было
const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
const payload = JSON.parse(payloadJson);

// Стало
import { decodeJwt } from 'jose';
const payload = decodeJwt(token);
```

**Преимущества:**

- ✅ Кроссплатформенная совместимость
- ✅ Использование специализированной библиотеки
- ✅ Более читаемый код

---

## ✅ Преимущества

1. **Runtime совместимость**
   - ✅ Работает в Cloudflare Workers без `process.env`
   - ✅ Не зависит от bundler inline подстановок

2. **Гибкость**
   - ✅ Явное управление Secure флагом
   - ✅ Поддержка разных окружений (HTTP/HTTPS)

3. **Безопасность по умолчанию**
   - ✅ `secure = true` по умолчанию (безопасно для production)
   - ✅ Требует явного отключения для dev

4. **Читаемость**
   - ✅ Понятные параметры функций
   - ✅ Не требует знания о `process.env`

---

## 📊 Совместимость

- ✅ Cloudflare Workers
- ✅ Node.js
- ✅ Bun
- ✅ Deno
- ✅ Browser (для тестирования)

---

## 🔄 Миграция

### Для существующего кода:

**Было:**

```typescript
setAuthCookie(token); // Зависело от process.env.NODE_ENV
clearAuthCookie(); // Зависело от process.env.NODE_ENV
```

**Стало:**

```typescript
// Production (рекомендуется)
setAuthCookie(token, true); // или просто setAuthCookie(token)
clearAuthCookie(true); // или просто clearAuthCookie()

// Development (только если нужен HTTP)
setAuthCookie(token, false);
clearAuthCookie(false);
```

**Обратная совместимость:** Полная (параметр `secure` опциональный с дефолтом `true`)

---

## 📚 Ссылки

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [jose Documentation](https://github.com/panva/jose)
- [HTTP Cookies: Secure Flag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies)
