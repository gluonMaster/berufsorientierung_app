/**
 * Custom Worker Entry Point
 *
 * Объединяет SvelteKit HTTP handler и Cloudflare Scheduled handler
 *
 * Этот файл импортирует стандартный SvelteKit worker и добавляет
 * поддержку Cron триггеров через export scheduled
 */

// Импортируем стандартный SvelteKit worker (будет создан после build)
// @ts-ignore - файл появится после npm run build
export { default } from '../.svelte-kit/cloudflare/_worker.js';

// Добавляем обработчик Cron триггеров
export { scheduled } from './worker';
