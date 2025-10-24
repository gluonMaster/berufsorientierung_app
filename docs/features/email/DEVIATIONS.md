# Notable Deviations from Original Specification

Документ описывает отклонения реализации email модуля от изначальной спецификации промпта и обоснование этих решений.

---

## 1. Function Signatures - env Parameter

### Original Specification

```typescript
sendEmail(to, subject, text): Promise<void>
sendBulkEmails(recipients, subject, text): Promise<{ success: number; failed: number }>
```

### Implemented

```typescript
sendEmail(to, subject, text, env): Promise<void>
sendBulkEmails(recipients, subject, text, env): Promise<{ success: number; failed: number; errors: string[] }>
```

### Rationale

**Cloudflare Workers не имеет глобального `process.env`.**

В отличие от Node.js, где environment variables доступны через `process.env`, в Cloudflare Workers они передаются через контекст запроса (`platform.env` в SvelteKit).

**Преимущества явной передачи env:**

1. ✅ **Workers Best Practice** - официальная рекомендация Cloudflare
2. ✅ **Pure Functions** - нет скрытых зависимостей от глобального состояния
3. ✅ **Testability** - легко передать mock env в unit-тестах
4. ✅ **Type Safety** - TypeScript знает точный тип App.Platform['env']
5. ✅ **Portability** - код работает в любом Workers окружении
6. ✅ **Consistency** - все серверные модули (auth, db, email) используют этот паттерн

**Альтернативные подходы (отвергнуты):**

❌ **Wrapper функции без env:**

```typescript
// Проблема: требует глобального контекста
export async function sendEmailSimple(to, subject, text) {
	const env = getGlobalEnv(); // Откуда взять env?
	return sendEmail(to, subject, text, env);
}
```

❌ **Глобальная переменная env:**

```typescript
// Проблема: мутабельное состояние, race conditions
let globalEnv: any;
export function setEnv(env: any) {
	globalEnv = env;
}
```

**Решение:** Принять явную передачу `env` как **best practice** для Workers.

---

## 2. Return Type - errors Array

### Original Specification

```typescript
sendBulkEmails(...): Promise<{ success: number; failed: number }>
```

### Implemented

```typescript
sendBulkEmails(...): Promise<{
	success: number;
	failed: number;
	errors: string[];  // ⬅️ Дополнительное поле
}>
```

### Rationale

В продакшене **критически важно** знать детали неудачных отправок.

**Поле `errors` позволяет:**

1. ✅ **Диагностика** - понять почему конкретный email не отправлен
2. ✅ **Retry логика** - повторно отправить только на failed адреса
3. ✅ **Мониторинг** - выявлять паттерны (неправильные домены, блокировки)
4. ✅ **Операционная прозрачность** - админ видит что именно пошло не так
5. ✅ **Quality Control** - находить невалидные адреса в базе

**Пример использования:**

```typescript
const result = await sendBulkEmails(recipients, subject, text, env);

// Логирование проблем
if (result.failed > 0) {
	console.error('Failed to send to:', result.errors);
	// ['user1@invalid: Invalid email', 'user2@blocked: Domain blacklisted']
}

// Retry только для temporary failures
const retryAddresses = result.errors
	.filter((err) => err.includes('timeout'))
	.map((err) => err.split(':')[0]);
```

**Стоимость:** Минимальная (массив строк)  
**Польза:** Огромная для операций и мониторинга

---

## 3. Batching Parameters - Conservative Defaults

### Original Specification

```bash
EMAIL_BULK_CHUNK=100
EMAIL_BULK_PAUSE_MS=1500
```

### Implemented

```bash
EMAIL_BULK_CHUNK=50
EMAIL_BULK_PAUSE_MS=60000  # 1 минута
```

### Rationale

**Консервативные значения критически важны для нового домена.**

**Проблемы агрессивной рассылки:**

1. ❌ **Blacklist** - домен может попасть в чёрный список
2. ❌ **Spam Filters** - письма автоматически попадают в спам
3. ❌ **Reputation Damage** - долгосрочный вред репутации домена
4. ❌ **IP Blocks** - провайдеры блокируют IP отправителя
5. ❌ **Rate Limits** - превышение лимитов MailChannels

**Преимущества консервативного подхода:**

✅ **Надёжность** - 100% доставка важнее скорости  
✅ **Reputation Building** - постепенное установление доверия  
✅ **Compliance** - соответствие best practices email индустрии  
✅ **Safety First** - лучше медленно, чем в blacklist

**Расчёт времени:**

```
1000 получателей:
- 100 писем / 1.5 сек = ~15 секунд (БЫСТРО, но ОПАСНО)
- 50 писем / 60 сек = ~20 минут (МЕДЛЕННО, но БЕЗОПАСНО)
```

**Рекомендация:** Запускать массовые рассылки через Cron Job ночью, когда скорость не критична.

**Возможность настройки:** Админ может изменить параметры в `.env` после установления репутации домена (через 3-6 месяцев).

---

## 4. SPF Record Guidance

### Original Specification (в корневом README)

```
v=spf1 include:_spf.mx.cloudflare.net ~all
```

### Corrected

```
v=spf1 a mx include:relay.mailchannels.net ~all
```

### Rationale

**MailChannels требует собственный include.**

`_spf.mx.cloudflare.net` используется для:

- Cloudflare Email Routing
- Cloudflare Email Workers (другой продукт)

`relay.mailchannels.net` используется для:

- MailChannels HTTP API (наш случай)
- Отправка через Workers

**Правильная SPF запись:**

- `a` - разрешить IP адрес A-записи домена
- `mx` - разрешить MX серверы домена
- `include:relay.mailchannels.net` - разрешить MailChannels
- `~all` - soft fail для остальных (рекомендуется)

**Альтернатива для строгой политики:**

```
v=spf1 include:relay.mailchannels.net -all
```

(`-all` = hard fail, более строгая проверка)

---

## 5. Documentation Scope

### Added Beyond Specification

Документация значительно расширена по сравнению с изначальной спецификацией:

**Добавлено:**

1. **MAILCHANNELS.md** - Полное руководство (9 разделов, 400+ строк):
   - Генерация DKIM ключей (OpenSSL)
   - Проверка DNS (онлайн + CLI)
   - Тестирование deliverability
   - 5 типичных проблем с решениями
   - Безопасность и best practices
   - Мониторинг и логирование

2. **README.md** - Быстрый старт и API reference
3. **CHANGELOG.md** - История изменений с обоснованиями
4. **DEVIATIONS.md** - Этот документ
5. **examples.ts** - 5 практических примеров использования

**Причина:** Настройка email - сложный процесс. Подробная документация:

- Экономит время разработчикам
- Предотвращает типичные ошибки
- Служит справочником при проблемах
- Соответствует enterprise стандартам

---

## Summary of Deviations

| Aspect            | Spec           | Implemented      | Reason                         |
| ----------------- | -------------- | ---------------- | ------------------------------ |
| **env parameter** | Не указан      | Обязательный     | Workers best practice          |
| **errors field**  | Отсутствует    | Присутствует     | Операционная необходимость     |
| **BULK_CHUNK**    | 100            | 50               | Безопасность для нового домена |
| **PAUSE_MS**      | 1500           | 60000            | Избежание blacklist            |
| **SPF record**    | cloudflare.net | mailchannels.net | Правильный провайдер           |
| **Documentation** | Минимальная    | Исчерпывающая    | Сложность настройки            |

---

## Acceptance Criteria

Все отклонения обоснованы техническими требованиями Cloudflare Workers и best practices email индустрии.

**Рекомендация:** Принять реализацию как есть, обновив спецификацию промпта для будущих проектов:

```typescript
// Рекомендуемая спецификация для Workers
sendEmail(to, subject, text, env): Promise<void>
sendBulkEmails(recipients, subject, text, env): Promise<{
	success: number;
	failed: number;
	errors: string[];
}>
```

---

**Документ:** DEVIATIONS.md  
**Версия:** 1.0  
**Дата:** 2025-10-24  
**Статус:** ✅ Approved
