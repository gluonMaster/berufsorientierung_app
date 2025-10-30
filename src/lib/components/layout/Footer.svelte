<script lang="ts">
	/**
	 * Footer Component
	 * Адаптивный footer с копирайтом, ссылками и контактами
	 */

	import { _ } from 'svelte-i18n';

	// Текущий год для копирайта
	const currentYear = new Date().getFullYear();
</script>

<footer class="footer">
	<div class="container">
		<!-- Основной контент footer -->
		<div class="footer-content">
			<!-- Копирайт -->
			<div class="copyright">
				<p>© {currentYear} Kolibri Dresden</p>
			</div>

			<!-- Навигационные ссылки -->
			<nav class="footer-links" aria-label="Footer navigation">
				<a href="/datenschutz" class="footer-link"> Datenschutz </a>
				<span class="separator" aria-hidden="true">•</span>
				<a href="/impressum" class="footer-link"> Impressum </a>
			</nav>

			<!-- Контакты -->
			<div class="contact">
				<a href="mailto:Berufsorientierung@kolibri-dresden.de" class="contact-link">
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
						class="icon"
					>
						<path
							d="M2 3.5C2 2.67157 2.67157 2 3.5 2H12.5C13.3284 2 14 2.67157 14 3.5V12.5C14 13.3284 13.3284 14 12.5 14H3.5C2.67157 14 2 13.3284 2 12.5V3.5Z"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M2 4L8 8.5L14 4"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					<span>Berufsorientierung@kolibri-dresden.de</span>
				</a>
			</div>
		</div>
	</div>
</footer>

<style>
	.footer {
		width: 100%;
		background-color: #f9fafb;
		border-top: 1px solid #e5e7eb;
		margin-top: auto; /* Прижимает footer к низу страницы */
	}

	.container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	.footer-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	/* Копирайт */
	.copyright {
		text-align: center;
	}

	.copyright p {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* Навигационные ссылки */
	.footer-links {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.footer-link {
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.footer-link:hover {
		color: #1f2937;
		text-decoration: underline;
	}

	.footer-link:focus {
		outline: none;
		color: #2563eb;
		text-decoration: underline;
	}

	.separator {
		color: #d1d5db;
		user-select: none;
	}

	/* Контакты */
	.contact {
		text-align: center;
	}

	.contact-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.contact-link:hover {
		color: #2563eb;
	}

	.contact-link:focus {
		outline: none;
		color: #2563eb;
		text-decoration: underline;
	}

	.icon {
		flex-shrink: 0;
	}

	/* Tablet (640px+) */
	@media (min-width: 640px) {
		.container {
			padding: 1.5rem 1.5rem;
		}

		.footer-content {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			gap: 1.5rem;
		}

		.copyright,
		.contact {
			text-align: left;
		}

		.footer-links {
			justify-content: flex-start;
		}
	}

	/* Desktop (768px+) */
	@media (min-width: 768px) {
		.container {
			padding: 2rem 2rem;
		}

		.copyright p,
		.footer-link,
		.contact-link {
			font-size: 0.9375rem;
		}
	}

	/* Large Desktop (1024px+) */
	@media (min-width: 1024px) {
		.footer-content {
			gap: 2rem;
		}
	}

	/* Dark mode support (optional) */
	@media (prefers-color-scheme: dark) {
		.footer {
			background-color: #1f2937;
			border-top-color: #374151;
		}

		.copyright p {
			color: #9ca3af;
		}

		.footer-link {
			color: #9ca3af;
		}

		.footer-link:hover {
			color: #f9fafb;
		}

		.footer-link:focus {
			color: #93c5fd;
		}

		.separator {
			color: #4b5563;
		}

		.contact-link {
			color: #9ca3af;
		}

		.contact-link:hover,
		.contact-link:focus {
			color: #93c5fd;
		}
	}
</style>
