<script lang="ts">
	// Компонент кнопки с поддержкой различных стилей, размеров и состояний
	export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let disabled = false;
	export let loading = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let fullWidth = false;

	// Дополнительные классы через class prop
	let className = '';
	export { className as class };

	// Базовые стили кнопки
	const baseClasses =
		'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	// Размеры кнопки (минимум 44px для тач-экранов)
	const sizeClasses = {
		sm: 'px-4 py-2 text-sm min-h-[44px]',
		md: 'px-6 py-3 text-base min-h-[44px]',
		lg: 'px-8 py-4 text-lg min-h-[48px]',
	};

	// Ширина кнопки
	const widthClass = fullWidth ? 'w-full' : '';

	// Автоматическая блокировка при загрузке
	$: isDisabled = disabled || loading;

	// Фильтруем class из restProps, чтобы не было дублирования
	$: restPropsWithoutClass = Object.fromEntries(
		Object.entries($$restProps).filter(([key]) => key !== 'class')
	);
</script>

<!-- Явные классы для каждого варианта, чтобы Tailwind видел их при tree-shaking -->
<button
	class={`${baseClasses} ${sizeClasses[size]} ${widthClass}
		${variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800' : ''}
		${variant === 'secondary' ? 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 active:bg-gray-400' : ''}
		${variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 active:bg-red-800' : ''}
		${className}
	`
		.trim()
		.replace(/\s+/g, ' ')}
	disabled={isDisabled}
	aria-busy={loading}
	{type}
	on:click
	{...restPropsWithoutClass}
>
	{#if loading}
		<!-- Спиннер загрузки -->
		<svg
			class="animate-spin -ml-1 mr-3 h-5 w-5"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	<slot />
</button>
