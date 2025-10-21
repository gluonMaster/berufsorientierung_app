/**
 * Language Store Tests
 * Tests for i18n initialization and language switching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	currentLanguage,
	changeLanguage,
	isLanguageSupported,
	SUPPORTED_LANGUAGES,
	type LanguageCode,
} from '$lib/stores/language';

describe('Language Store', () => {
	beforeEach(() => {
		// Reset to default language
		currentLanguage.set('de');

		// Clear localStorage mock
		if (typeof localStorage !== 'undefined') {
			localStorage.clear();
		}
	});

	describe('SUPPORTED_LANGUAGES', () => {
		it('should have all 4 supported languages', () => {
			expect(Object.keys(SUPPORTED_LANGUAGES)).toHaveLength(4);
			expect(SUPPORTED_LANGUAGES).toHaveProperty('de');
			expect(SUPPORTED_LANGUAGES).toHaveProperty('en');
			expect(SUPPORTED_LANGUAGES).toHaveProperty('ru');
			expect(SUPPORTED_LANGUAGES).toHaveProperty('uk');
		});

		it('should have correct language properties', () => {
			const german = SUPPORTED_LANGUAGES.de;
			expect(german.code).toBe('de');
			expect(german.name).toBe('Deutsch');
			expect(german.flag).toBe('🇩🇪');
			expect(german.nativeName).toBe('Deutsch');
		});
	});

	describe('isLanguageSupported', () => {
		it('should return true for supported languages', () => {
			expect(isLanguageSupported('de')).toBe(true);
			expect(isLanguageSupported('en')).toBe(true);
			expect(isLanguageSupported('ru')).toBe(true);
			expect(isLanguageSupported('uk')).toBe(true);
		});

		it('should return false for unsupported languages', () => {
			expect(isLanguageSupported('fr')).toBe(false);
			expect(isLanguageSupported('es')).toBe(false);
			expect(isLanguageSupported('invalid')).toBe(false);
		});
	});

	describe('currentLanguage', () => {
		it('should start with default language (de)', () => {
			expect(get(currentLanguage)).toBe('de');
		});

		it('should be writable', () => {
			currentLanguage.set('en');
			expect(get(currentLanguage)).toBe('en');
		});
	});

	describe('changeLanguage', () => {
		it('should change language successfully', async () => {
			await changeLanguage('en');
			expect(get(currentLanguage)).toBe('en');
		});

		it('should not change to unsupported language', async () => {
			const before = get(currentLanguage);
			await changeLanguage('invalid' as LanguageCode);
			expect(get(currentLanguage)).toBe(before);
		});

		it('should save language to localStorage', async () => {
			// Mock localStorage if not available
			const localStorageMock = {
				getItem: vi.fn(),
				setItem: vi.fn(),
				removeItem: vi.fn(),
				clear: vi.fn(),
			};
			global.localStorage = localStorageMock as any;

			await changeLanguage('ru');
			// Note: This test would need to be adjusted based on actual implementation
		});
	});
});
