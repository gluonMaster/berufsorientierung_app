/**
 * Post-build script: Inject Cloudflare Cron Handler
 *
 * Этот скрипт автоматически добавляет export scheduled в сгенерированный SvelteKit worker
 * Запускается после npm run build
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workerPath = join(__dirname, '..', '.svelte-kit', 'cloudflare', '_worker.js');

try {
	// Проверяем, существует ли файл
	if (!existsSync(workerPath)) {
		console.error('❌ Worker file not found:', workerPath);
		console.error('   Make sure to run this script AFTER vite build');
		process.exit(1);
	}

	// Читаем сгенерированный SvelteKit worker
	let workerCode = readFileSync(workerPath, 'utf-8');

	// Проверяем, не был ли уже добавлен scheduled handler
	if (workerCode.includes('export { scheduled }')) {
		console.log('✅ Scheduled handler already injected, skipping');
		process.exit(0);
	}

	// Добавляем export scheduled в конец файла
	const scheduledExport = `
// ========================================
// Cloudflare Cron Handler
// Automatically injected by scripts/inject-cron.js
// ========================================
export { scheduled } from '../../src/worker.ts';
`;

	workerCode += scheduledExport;

	// Записываем обратно
	writeFileSync(workerPath, workerCode, 'utf-8');

	console.log('✅ Successfully injected scheduled handler into _worker.js');
	console.log('   Cloudflare Cron triggers will now work');
	console.log('   Schedule: 0 2 * * * (every day at 02:00 UTC)');
} catch (error) {
	console.error('❌ Error injecting scheduled handler:', error);
	process.exit(1);
}
