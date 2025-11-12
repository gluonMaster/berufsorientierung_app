// Типы для Cloudflare Turnstile API
// https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

interface TurnstileRenderOptions {
	sitekey: string;
	callback?: (token: string) => void;
	'error-callback'?: () => void;
	'expired-callback'?: () => void;
	theme?: 'light' | 'dark' | 'auto';
	size?: 'normal' | 'compact';
	action?: string;
	cData?: string;
	appearance?: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileAPI {
	render: (element: string | HTMLElement, options: TurnstileRenderOptions) => string;
	reset: (widgetId: string) => void;
	remove: (widgetId: string) => void;
	getResponse: (widgetId: string) => string | undefined;
}

declare global {
	interface Window {
		turnstile?: TurnstileAPI;
		onTurnstileLoad?: () => void;
	}
}

export {};
