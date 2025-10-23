# Changelog - Auth Middleware

Все изменения модуля `lib/server/middleware/auth.ts` документируются в этом файле.

---

## [1.0.0] - 2025-10-23

### ✅ Добавлено

#### Функции middleware

- **`getUserFromRequest()`** - Извлечение пользователя из запроса
  - Возвращает `User | null` (не бросает ошибку)
  - Проверяет JWT токен из cookies
  - Загружает пользователя из БД
  - Проверяет флаг `is_blocked`

- **`requireAuth()`** - Требование обязательной авторизации
  - Бросает `Error { status: 401 }` если не авторизован
  - Возвращает `User` если успешно

- **`requireAdmin()`** - Требование прав администратора
  - Проверяет авторизацию
  - Проверяет статус администратора через `isAdmin()`
  - Бросает `401` если не авторизован
  - Бросает `403` если не является админом

- **`getClientIP()`** - Получение IP адреса клиента
  - Приоритет: `CF-Connecting-IP` (Cloudflare)
  - Fallback: `X-Forwarded-For`, `X-Real-IP`
  - Возвращает `string | null`

#### Документация

- **`docs/features/auth/MIDDLEWARE.md`** - Полная документация модуля
- **`docs/features/auth/EXAMPLES.md`** - Примеры использования для разных сценариев

#### Интеграция

- Импорт типа `D1Database` из `@cloudflare/workers-types`
- Интеграция с `lib/server/auth` (JWT утилиты)
- Интеграция с `lib/server/db/users` (загрузка пользователей)
- Интеграция с `lib/server/db/admin` (проверка прав)

### 🔧 Технические детали

**Зависимости:**

- `$lib/server/auth` - extractTokenFromRequest, verifyToken
- `$lib/server/db/users` - getUserById
- `$lib/server/db/admin` - isAdmin
- `$lib/types` - User type

**Окружение:**

- Cloudflare Workers совместимость
- D1 Database
- WebCrypto API для JWT

### 📚 Примеры использования

См. полные примеры в [`docs/features/auth/EXAMPLES.md`](./EXAMPLES.md)

**Базовые сценарии:**

```typescript
// 1. Публичный endpoint - без middleware
export const GET = async ({ platform }) => { ... }

// 2. Защищённый endpoint - requireAuth()
export const POST = async ({ request, platform }) => {
  const user = await requireAuth(request, platform.env.DB, platform.env.JWT_SECRET);
  // ...
}

// 3. Админский endpoint - requireAdmin()
export const DELETE = async ({ request, platform }) => {
  const admin = await requireAdmin(request, platform.env.DB, platform.env.JWT_SECRET);
  // ...
}

// 4. Опциональная авторизация - getUserFromRequest()
export const load = async ({ request, platform }) => {
  const user = await getUserFromRequest(request, platform.env.DB, platform.env.JWT_SECRET);
  return { user }; // может быть null
}

// 5. Логирование с IP
const ip = getClientIP(request);
await logActivity(db, user.id, 'action', { ip });
```

---

## 🔮 Планируемые улучшения

### v1.1.0 (будущая версия)

- [ ] Rate limiting middleware
- [ ] CSRF token validation
- [ ] Session management
- [ ] Refresh token support
- [ ] Multi-factor authentication (MFA)

---

**Формат версий:** [Major.Minor.Patch]

- **Major** - Breaking changes (несовместимые изменения)
- **Minor** - Новый функционал (обратно совместимый)
- **Patch** - Исправления багов

---

[← Назад к документации](./MIDDLEWARE.md)
