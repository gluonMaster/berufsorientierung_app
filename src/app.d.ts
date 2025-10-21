// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Типы для Cloudflare Workers platform
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}

		interface Locals {
			user?: {
				id: number;
				email: string;
				firstName: string;
				lastName: string;
				isAdmin: boolean;
			};
		}

		// Cloudflare Workers bindings
		interface Platform {
			env: {
				DB: D1Database;
				QR_BUCKET: R2Bucket;
				JWT_SECRET: string;
				EMAIL_PROVIDER: string;
				EMAIL_FROM: string;
				EMAIL_REPLY_TO: string;
				EMAIL_BULK_CHUNK: string;
				EMAIL_BULK_PAUSE_MS: string;
				DKIM_DOMAIN?: string;
				DKIM_SELECTOR?: string;
				DKIM_PRIVATE_KEY?: string;
				R2_PUBLIC_URL: string;
				SETUP_TOKEN?: string;
				CRON_SECRET?: string;
			};
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
