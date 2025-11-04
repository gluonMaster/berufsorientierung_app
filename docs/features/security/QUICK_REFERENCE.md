# 🛡️ CSRF Quick Reference - Памятка разработчика

Краткий справочник по использованию CSRF защиты в проекте Berufsorientierung.

## ⚡ TL;DR - Быстрая шпаргалка

### Новый API endpoint

```typescript
export async function POST(event: RequestEvent) {
	await verifyCsrf(event); // ← ОБЯЗАТЕЛЬНО первым делом!
	// Остальная логика...
}
```

### Новая страница с формой

```typescript
// +page.server.ts
export const load: ServerLoad = async ({ locals }) => {
	return { csrfToken: locals.csrfToken }; // ← ОБЯЗАТЕЛЬНО
};
```

### Форма в Svelte

```svelte
<script>
	export let data: { csrfToken?: string };
</script>

<form>
	<!-- Скрытое поле для без-JS -->
	{#if data.csrfToken}
		<input type="hidden" name="_csrf" value={data.csrfToken} />
	{/if}
</form>
```

### Fetch запрос

```typescript
const response = await fetch('/api/endpoint', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'X-CSRF-Token': data.csrfToken, // ← Основной способ
	},
	body: JSON.stringify({
		...formData,
		csrfToken: data.csrfToken, // ← Fallback
	}),
});
```

## 📋 Чеклист для нового функционала

### ✅ API Endpoint

- [ ] Вызывает `await verifyCsrf(event)` первым делом
- [ ] Импортирует `{ verifyCsrf } from '$lib/server/middleware/csrf'`
- [ ] Обрабатывает CSRF ошибки через `handleApiError()`

### ✅ Страница с формой

- [ ] `+page.server.ts` возвращает `{ csrfToken: locals.csrfToken }`
- [ ] Компонент получает `data: { csrfToken?: string }`
- [ ] Форма содержит скрытое поле `_csrf`
- [ ] Fetch запросы отправляют токен в заголовке и теле

### ✅ Тестирование

- [ ] Юнит-тест проверяет блокировку без токена
- [ ] Интеграционный тест проверяет полный цикл
- [ ] Тест проверяет fallback механизмы

## 🚨 Частые ошибки

### ❌ Забыл добавить CSRF проверку

```typescript
export async function POST(event: RequestEvent) {
	// ❌ Сразу парсим данные без проверки CSRF
	const data = await event.request.json();
}
```

### ✅ Правильно

```typescript
export async function POST(event: RequestEvent) {
	await verifyCsrf(event); // ✅ Первым делом
	const data = await event.request.json();
}
```

### ❌ Забыл передать токен на страницу

```typescript
// +page.server.ts
export const load = async () => {
	return {}; // ❌ Нет csrfToken
};
```

### ✅ Правильно

```typescript
export const load: ServerLoad = async ({ locals }) => {
	return { csrfToken: locals.csrfToken }; // ✅ Есть токен
};
```

### ❌ Отправляет только в заголовке

```typescript
fetch('/api/endpoint', {
	headers: { 'X-CSRF-Token': token },
	body: JSON.stringify(data), // ❌ Нет fallback
});
```

### ✅ Правильно (двойная защита)

```typescript
fetch('/api/endpoint', {
	headers: { 'X-CSRF-Token': token },
	body: JSON.stringify({ ...data, csrfToken: token }), // ✅ Есть fallback
});
```

## 🔧 Отладка

### Проверить CSRF cookie в DevTools

```javascript
// В browser console
document.cookie.includes('csrf_token');
// → true (но значение скрыто из-за httpOnly)
```

### Проверить токен в Network tab

- **Request Headers:** `X-CSRF-Token: abc123...`
- **Request Payload:** `{ "csrfToken": "abc123...", ... }`
- **Response:** `200 OK` или `403 Forbidden`

### Типичные CSRF ошибки и их причины

| Ошибка                    | Причина              | Решение                                               |
| ------------------------- | -------------------- | ----------------------------------------------------- |
| `CSRF cookie not found`   | Cookie не установлен | Проверить что `ensureCsrfCookie()` вызывается в hooks |
| `CSRF token not provided` | Токен не отправлен   | Добавить в заголовок или тело запроса                 |
| `Invalid CSRF token`      | Токены не совпадают  | Проверить что используется правильный токен           |

## 📚 Дополнительная документация

- [Полная документация CSRF](./CSRF.md)
- [Примеры интеграции](./CSRF.md#примеры)
- [Архитектура и безопасность](./CSRF.md#безопасность)

---

**💡 Помните:** Zod автоматически удаляет `csrfToken` из валидированных данных, поэтому он не попадает в бизнес-логику.

[← Назад к Security](./)
