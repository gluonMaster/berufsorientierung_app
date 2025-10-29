# UI Components - История изменений

Лог всех изменений в UI компонентах.

---

## [1.0.1] - 2025-10-29

### 🔧 Исправлено

#### Modal Component

- 🐛 Исправлен доступ к `document` при SSR - добавлена проверка `browser` из `$app/environment`
- ♿ Локализация `aria-label` для кнопки закрытия через i18n (`ui.modal.closeAriaLabel`)

#### Button Component

- ✨ Добавлен prop `htmlType` для разграничения HTML-типа (`button`/`submit`/`reset`) и визуального типа
- ♿ Добавлен `aria-busy` при состоянии loading
- 🔧 Автоматическая блокировка кнопки при `loading=true` (disabled={disabled || loading})

#### FormField Component

- 🐛 Исправлена генерация ID - теперь детерминированный на основе `name` (избежание SSR mismatch)
- ✨ Добавлен опциональный prop `id` для явного указания ID
- 🗑️ Удалены неиспользуемые обработчики `on:blur` и `on:focus` из разметки

#### Toast Component

- ♿ Улучшена ARIA семантика:
  - `error` → `role="alert"` + `aria-live="assertive"` (критические сообщения)
  - `success`/`info` → `role="status"` + `aria-live="polite"` (информационные)
- ♿ Локализация `aria-label` для кнопки закрытия через i18n (`ui.toast.closeAriaLabel`)

#### Переводы

- ✨ Добавлена секция `ui` во все языковые файлы (de, en, ru, uk) с переводами для:
  - `ui.modal.closeAriaLabel` - локализованный текст для кнопки закрытия модала
  - `ui.toast.closeAriaLabel` - локализованный текст для кнопки закрытия уведомления
  - `ui.button.loading` - текст состояния загрузки

### 📚 Документация

- 📝 Обновлен CHANGELOG.md с описанием всех исправлений
- 📝 README.md будет обновлен с новыми props и улучшениями

---

## [1.0.0] - 2025-10-29

### ✨ Добавлено

#### Button Component

- ✅ Создан компонент `Button.svelte`
- ✅ Поддержка 3 типов: `primary`, `secondary`, `danger`
- ✅ Поддержка 3 размеров: `sm`, `md`, `lg`
- ✅ Состояние загрузки с анимированным спиннером
- ✅ Поддержка `disabled` состояния
- ✅ Опция `fullWidth` для 100% ширины
- ✅ Минимальная высота 44px для тач-экранов
- ✅ Плавные transitions (200ms)
- ✅ Focus ring для accessibility
- ✅ Распространение атрибутов через `$$restProps`

#### FormField Component

- ✅ Создан компонент `FormField.svelte`
- ✅ Поддержка типов: `text`, `email`, `password`, `date`, `tel`, `textarea`
- ✅ Автоматическая генерация уникального ID
- ✅ Связь label с input через `for`/`id`
- ✅ Валидация с красной обводкой при ошибке
- ✅ Отображение сообщения об ошибке под полем
- ✅ ARIA атрибуты: `aria-invalid`, `aria-describedby`
- ✅ Поддержка `required` с визуальной звездочкой
- ✅ Поддержка `disabled` состояния
- ✅ Поддержка `autocomplete` атрибута
- ✅ Events: `on:input`, `on:blur`, `on:focus`

#### Modal Component

- ✅ Создан компонент `Modal.svelte`
- ✅ Backdrop с blur эффектом
- ✅ Закрытие по ESC клавише
- ✅ Закрытие по клику на backdrop
- ✅ Focus trap (Tab/Shift+Tab остаются внутри)
- ✅ Блокировка скролла body при открытии
- ✅ Сохранение и восстановление фокуса
- ✅ Анимация fade-in/scale при появлении
- ✅ Адаптивная ширина (full на mobile, max-w на desktop)
- ✅ ARIA атрибуты: `role="dialog"`, `aria-modal`, `aria-labelledby`
- ✅ Кнопка закрытия (X) с aria-label

#### Toast Component

- ✅ Создан компонент `Toast.svelte`
- ✅ Поддержка 3 типов: `success`, `error`, `info`
- ✅ Автоматическое закрытие через `duration` мс
- ✅ Прогресс-бар закрытия
- ✅ Иконки для каждого типа уведомления
- ✅ Адаптивная позиция: top-center (mobile), top-right (desktop)
- ✅ Анимация slide-in при появлении
- ✅ Кнопка ручного закрытия
- ✅ `role="alert"` и `aria-live="polite"` для screen readers
- ✅ Callback `onClose` при закрытии

#### Инфраструктура

- ✅ Создан индексный файл `index.ts` для удобного импорта
- ✅ Создана демо страница `/demo-ui` с примерами всех компонентов
- ✅ Полная TypeScript типизация всех props

### 📚 Документация

- ✅ Создан `README.md` - полная документация всех компонентов
- ✅ Создан `EXAMPLES.md` - практические примеры использования
- ✅ Создан `QUICK_REFERENCE.md` - быстрый справочник
- ✅ Создан `CHANGELOG.md` - история изменений
- ✅ Обновлен `docs/features/README.md` с ссылкой на UI компоненты

### 🎨 Дизайн

- ✅ Согласованная цветовая схема (blue primary, gray secondary, red danger)
- ✅ Консистентные отступы (4, 8, 16, 24, 32px)
- ✅ Мягкие тени (shadow-md, shadow-lg)
- ✅ Скругления rounded-lg (8px)
- ✅ Плавные transitions (200ms - 300ms)

### ♿ Accessibility

- ✅ ARIA labels для всех интерактивных элементов
- ✅ Focus management в модалах
- ✅ Keyboard navigation (Tab, Shift+Tab, ESC)
- ✅ Focus trap в модалах
- ✅ Screen reader поддержка (role, aria-live)
- ✅ Видимые focus rings
- ✅ Минимальный размер тач-элементов 44x44px
- ✅ Контрастность цветов WCAG AA

### 📱 Мобильная адаптация

- ✅ Mobile-first подход
- ✅ Адаптивные брейкпоинты (sm: 640px, md: 768px, lg: 1024px)
- ✅ Вертикальный стэк на mobile → горизонтальный на desktop
- ✅ Увеличенные touch targets
- ✅ Адаптивный текст (min 16px)
- ✅ Полная ширина компонентов на mobile

### 🧪 Тестирование

- ✅ Проверка отсутствия TypeScript ошибок
- ✅ Демо страница для визуального тестирования
- ✅ Все компоненты прошли проверку линтера

---

## Планы на будущее

### v1.1.0

- [ ] Компонент Dropdown/Select
- [ ] Компонент Checkbox
- [ ] Компонент Radio
- [ ] Компонент Toggle/Switch
- [ ] Компонент Tabs

### v1.2.0

- [ ] Компонент Table (адаптивная таблица)
- [ ] Компонент Pagination
- [ ] Компонент Card
- [ ] Компонент Badge
- [ ] Компонент Avatar

### v1.3.0

- [ ] Компонент DatePicker
- [ ] Компонент TimePicker
- [ ] Компонент Autocomplete
- [ ] Компонент File Upload
- [ ] Компонент Progress Bar

### v2.0.0

- [ ] Темизация (светлая/темная тема)
- [ ] Расширенная кастомизация через CSS переменные
- [ ] Анимация через Svelte transitions
- [ ] Дополнительные размеры (xs, xl)
- [ ] RTL поддержка для арабского/иврита

---

## Формат записей

Используется [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0) - Breaking changes
- **MINOR** (0.x.0) - Новые фичи (обратно совместимые)
- **PATCH** (0.0.x) - Багфиксы

Типы изменений:

- ✨ **Добавлено** - новые фичи
- 🔧 **Изменено** - изменения в существующем функционале
- 🐛 **Исправлено** - багфиксы
- 🗑️ **Удалено** - удаленный функционал
- 🔒 **Безопасность** - исправления уязвимостей
- 📚 **Документация** - изменения в документации
