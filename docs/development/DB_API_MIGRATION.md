# Миграция на новый DB API

**Дата:** 23 октября 2025
**Статус:** ✅ Завершено

## Что изменилось

Агрегатор модулей БД переименован с `db` на `DB` (uppercase) для избежания конфликта имен с локальными переменными `db` (инстанс D1Database).

### Старый стиль (DEPRECATED):

```typescript
import { createUser, logActivity } from '$lib/server/db';

const db = platform.env.DB; // ❌ Конфликт имен
const user = await createUser(db, userData);
await logActivity(db, { ... });
```

### Новый стиль (АКТУАЛЬНЫЙ):

```typescript
import { DB, getDB } from '$lib/server/db';

const db = getDB(platform); // ✅ Нет конфликта
const user = await DB.users.createUser(db, userData);
await DB.activityLog.logActivity(db, { ... });
```

## Преимущества нового подхода

1. **Нет конфликта имен** - `DB` (модули) vs `db` (инстанс)
2. **Явная группировка** - сразу видно к какому модулю относится функция
3. **Лучший автокомплит** - IDE показывает все доступные модули
4. **Читаемость** - `DB.users.createUser` понятнее чем просто `createUser`

## Модули DB API

- `DB.users.*` - операции с пользователями
- `DB.events.*` - операции с мероприятиями
- `DB.eventFields.*` - дополнительные поля мероприятий
- `DB.registrations.*` - регистрации на мероприятия
- `DB.admin.*` - управление администраторами
- `DB.activityLog.*` - логирование действий
- `DB.gdpr.*` - GDPR-операции (удаление данных)

## Статус обновления

### Код приложения

- ✅ `src/lib/server/db/index.ts` - обновлен экспорт на `DB`
- ⚠️ API routes - пока не создано
- ⚠️ Server pages - пока не создано

### Документация

- ⚠️ `docs/database/events/README.md` - частично обновлено
- ⚠️ `docs/database/gdpr/EXAMPLES.md` - частично обновлено
- ⚠️ `docs/database/activitylog/EXAMPLES.md` - частично обновлено
- ❌ `docs/database/activitylog/QUICK_REFERENCE.md` - не обновлено
- ❌ `docs/features/storage/R2.md` - не обновлено
- ❌ `docs/development/fixes/ADMIN_ACTIVITYLOG.md` - не обновлено

## TODO

При создании нового кода использовать ТОЛЬКО новый стиль с `DB.*`.

Документацию можно обновлять по мере необходимости, так как она содержит примеры для справки, а не рабочий код.

## Пример миграции

Если у вас есть старый код с индивидуальными импортами, обновите его так:

```typescript
// ❌ СТАРЫЙ
import { createUser, getUserById, logActivity } from '$lib/server/db';

export const load = async ({ platform }) => {
  const db = platform.env.DB;
  const user = await getUserById(db, userId);
  await logActivity(db, { ... });
};

// ✅ НОВЫЙ
import { DB, getDB } from '$lib/server/db';

export const load = async ({ platform }) => {
  const db = getDB(platform);
  const user = await DB.users.getUserById(db, userId);
  await DB.activityLog.logActivity(db, { ... });
};
```

## Ссылки

- Основной файл: `src/lib/server/db/index.ts`
- Документация модулей: `docs/database/`
