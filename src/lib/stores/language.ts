/**
 * Language Store
 * Manages i18n initialization and language switching with localStorage + cookie persistence
 * Дефолт: строго 'de', без автоматического определения по браузеру
 */

import { writable, derived, get } from 'svelte/store';
import { init, locale, _, addMessages } from 'svelte-i18n';
import { browser } from '$app/environment';

// Supported languages
export const SUPPORTED_LANGUAGES = {
	de: { code: 'de', name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
	en: { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
	ru: { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
	uk: { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', nativeName: 'Українська' },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Default language (строго немецкий, без автоопределения)
const DEFAULT_LANGUAGE: LanguageCode = 'de';

// LocalStorage key
const LANGUAGE_STORAGE_KEY = 'berufsorientierung_language';

// Cookie name (синхронизация с сервером)
const LANGUAGE_COOKIE_NAME = 'berufsorientierung_language';

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
 * Saves the language to cookie for server-side consistency
 * Max-Age: 1 year, Path: /, SameSite: Lax
 */
function saveLanguageToCookie(lang: LanguageCode): void {
	if (!browser) return; // На SSR cookie не трогаем

	try {
		// Max-Age: 365 дней = 31536000 секунд
		const maxAge = 365 * 24 * 60 * 60;
		document.cookie = `${LANGUAGE_COOKIE_NAME}=${lang}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
	} catch (error) {
		console.error('Error saving language to cookie:', error);
	}
}

/**
 * Detects the user's preferred language
 * Только из localStorage, без автоопределения по браузеру
 * Fallback: строго DEFAULT_LANGUAGE ('de')
 */
function detectPreferredLanguage(): LanguageCode {
	// Проверяем localStorage
	const stored = getStoredLanguage();

	// Если в localStorage есть валидный язык (не дефолтный) - используем его
	if (stored !== DEFAULT_LANGUAGE && stored in SUPPORTED_LANGUAGES) {
		return stored;
	}

	// Если в localStorage дефолтный язык или его нет - возвращаем дефолт
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
 * Сохраняет в localStorage и cookie для синхронизации с сервером
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

	// Save to cookie (для синхронизации с сервером)
	saveLanguageToCookie(lang);
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
