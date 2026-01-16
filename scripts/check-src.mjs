#!/usr/bin/env node
/**
 * Обёртка для svelte-check, которая фильтрует ошибки из .svelte-kit
 */
import { spawn } from 'child_process';

const svelteCheck = spawn('npx', ['svelte-check', '--tsconfig', './tsconfig.json'], {
	stdio: ['inherit', 'pipe', 'pipe'],
	shell: true,
});

let realErrorCount = 0;
let skippedErrorCount = 0;
let currentFileIsSvelteKit = false;
let buffer = '';

function processChunk(data) {
	// Буферизуем данные для корректной обработки многострочного вывода
	buffer += data.toString();

	// Обрабатываем только полные строки
	const lines = buffer.split('\n');
	// Оставляем последнюю неполную строку в буфере
	buffer = lines.pop() || '';

	for (const line of lines) {
		// Пропускаем итоговую строку svelte-check
		if (line.includes('svelte-check found') || line.match(/^={4,}$/)) {
			continue;
		}

		// Определяем путь файла — строка начинается с абсолютного пути и содержит номер строки/колонки
		const pathMatch = line.match(/^([a-zA-Z]:\\[^\s]+|\/[^\s]+):\d+:\d+/);
		if (pathMatch) {
			const filePath = pathMatch[1];
			currentFileIsSvelteKit = filePath.includes('.svelte-kit');

			// Считаем файлы с ошибками
			if (currentFileIsSvelteKit) {
				skippedErrorCount++;
			} else {
				realErrorCount++;
			}
		}

		// Если текущий файл из .svelte-kit — пропускаем
		if (currentFileIsSvelteKit) {
			continue;
		}

		// Выводим строку
		console.log(line);
	}
}

function flushBuffer() {
	if (buffer.trim()) {
		// Обрабатываем оставшийся буфер
		if (!buffer.includes('svelte-check found') && !buffer.match(/^={4,}$/)) {
			console.log(buffer);
		}
	}
}

svelteCheck.stdout.on('data', processChunk);
svelteCheck.stderr.on('data', processChunk);

svelteCheck.on('close', (code) => {
	flushBuffer();
	console.log('\n====================================');
	console.log(`svelte-check completed`);
	console.log(`Filtered out ${skippedErrorCount} diagnostics from .svelte-kit`);
	console.log(`Diagnostics in src: ${realErrorCount}`);
	console.log('====================================');

	// Выходим с кодом 0 если нет реальных ошибок в src
	process.exit(realErrorCount > 0 ? 1 : 0);
});
