/**
 * Language Store
 * Manages i18n initialization and language switching with localStorage persistence
 */

import { writable, derived, get } from 'svelte/store';
import { init, locale, locales, getLocaleFromNavigator, _, addMessages } from 'svelte-i18n';
import { browser } from '$app/environment';

// Supported languages
export const SUPPORTED_LANGUAGES = {
	de: { code: 'de', name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
	en: { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
	ru: { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
	uk: { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', nativeName: 'Українська' },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Default language
const DEFAULT_LANGUAGE: LanguageCode = 'de';

// LocalStorage key
const LANGUAGE_STORAGE_KEY = 'berufsorientierung_language';

/**
 * Gets the stored language from localStorage or returns default
 */
function getStoredLanguage(): LanguageCode {
	if (!browser) return DEFAULT_LANGUAGE;

	try {
		const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (stored && stored in SUPPORTED_LANGUAGES) {
			return stored as LanguageCode;
		}
	} catch (error) {
		console.error('Error reading language from localStorage:', error);
	}

	return DEFAULT_LANGUAGE;
}

/**
 * Saves the language to localStorage
 */
function saveLanguage(lang: LanguageCode): void {
	if (!browser) return;

	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
	} catch (error) {
		console.error('Error saving language to localStorage:', error);
	}
}

/**
 * Detects the user's preferred language from browser or localStorage
 */
function detectPreferredLanguage(): LanguageCode {
	// First, check localStorage
	const stored = getStoredLanguage();
	if (stored !== DEFAULT_LANGUAGE) {
		return stored;
	}

	// Then, check browser language
	if (browser) {
		try {
			const browserLang = getLocaleFromNavigator();
			if (browserLang) {
				// Extract the language code (e.g., 'de' from 'de-DE')
				const langCode = browserLang.split('-')[0].toLowerCase();
				if (langCode in SUPPORTED_LANGUAGES) {
					return langCode as LanguageCode;
				}
			}
		} catch (error) {
			console.error('Error detecting browser language:', error);
		}
	}

	return DEFAULT_LANGUAGE;
}

/**
 * Current language store
 */
export const currentLanguage = writable<LanguageCode>(DEFAULT_LANGUAGE);

/**
 * Derived store with full language info
 */
export const currentLanguageInfo = derived(currentLanguage, ($currentLanguage) => {
	return SUPPORTED_LANGUAGES[$currentLanguage];
});

/**
 * Is i18n initialized flag
 */
export const isI18nInitialized = writable(false);

/**
 * Loads translations for a specific language
 */
async function loadTranslations(lang: LanguageCode): Promise<void> {
	try {
		const response = await fetch(`/translations/${lang}.json`);
		if (!response.ok) {
			throw new Error(`Failed to load translations for ${lang}`);
		}
		const messages = await response.json();
		addMessages(lang, messages);
	} catch (error) {
		console.error(`Error loading translations for ${lang}:`, error);
		// Fallback to default language if not already loading it
		if (lang !== DEFAULT_LANGUAGE) {
			console.warn(`Falling back to ${DEFAULT_LANGUAGE} translations`);
			await loadTranslations(DEFAULT_LANGUAGE);
		}
	}
}

/**
 * Initializes i18n with translations
 */
export async function initializeI18n(): Promise<void> {
	if (get(isI18nInitialized)) {
		return; // Already initialized
	}

	// На сервере (SSR) устанавливаем дефолтный язык без загрузки переводов
	if (!browser) {
		init({
			fallbackLocale: DEFAULT_LANGUAGE,
			initialLocale: DEFAULT_LANGUAGE,
		});
		currentLanguage.set(DEFAULT_LANGUAGE);
		locale.set(DEFAULT_LANGUAGE);
		isI18nInitialized.set(true);
		return;
	}

	const preferredLanguage = detectPreferredLanguage();

	// Load all translations (for instant switching later)
	await Promise.all(
		Object.keys(SUPPORTED_LANGUAGES).map((lang) => loadTranslations(lang as LanguageCode))
	);

	// Initialize i18n
	init({
		fallbackLocale: DEFAULT_LANGUAGE,
		initialLocale: preferredLanguage,
	});

	// Set current language
	currentLanguage.set(preferredLanguage);
	locale.set(preferredLanguage);

	isI18nInitialized.set(true);
}

/**
 * Changes the current language
 */
export async function changeLanguage(lang: LanguageCode): Promise<void> {
	if (!(lang in SUPPORTED_LANGUAGES)) {
		console.error(`Unsupported language: ${lang}`);
		return;
	}

	// Update locale
	locale.set(lang);

	// Update current language store
	currentLanguage.set(lang);

	// Save to localStorage
	saveLanguage(lang);
}

/**
 * Gets the translation function (for use in non-Svelte contexts)
 */
export function getTranslation(): typeof _ {
	return _;
}

/**
 * Gets available languages as array
 */
export function getAvailableLanguages() {
	return Object.values(SUPPORTED_LANGUAGES);
}

/**
 * Checks if a language is supported
 */
export function isLanguageSupported(lang: string): lang is LanguageCode {
	return lang in SUPPORTED_LANGUAGES;
}
