import { describe, it, expect } from 'vitest';

describe('Базовый тест', () => {
	it('должен пройти успешно', () => {
		expect(true).toBe(true);
	});

	it('должен корректно складывать числа', () => {
		expect(1 + 1).toBe(2);
	});
});
