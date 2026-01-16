<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	// Компонент поля формы с валидацией, поддержкой различных типов и доступностью
	export let label: string;
	export let type: 'text' | 'email' | 'password' | 'date' | 'tel' | 'textarea' = 'text';
	export let placeholder = '';
	export let error = '';
	export let required = false;
	export let value = '';
	export let name: string | undefined = undefined;
	export let disabled = false;
	export let autocomplete: HTMLInputAttributes['autocomplete'] = undefined;
	export let id: string | undefined = undefined;
	export let help: string | undefined = undefined;

	// Детерминированный ID для связи label с input (избегаем SSR mismatch)
	// Если id не передан, генерируем на основе name (или случайный для кастомных полей)
	const fieldId = id || (name ? `field-${name}` : `field-${Math.random().toString(36).slice(2)}`);
	const errorId = `${fieldId}-error`;
	const helpId = `${fieldId}-help`;

	// Базовые стили для input/textarea
	const baseInputClasses =
		'w-full px-4 py-3 text-base border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100';

	// Стили в зависимости от наличия ошибки
	$: inputClasses = error
		? `${baseInputClasses} border-red-500 focus:ring-red-500 focus:border-red-500`
		: `${baseInputClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;

	// Обработка изменения значения
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement;
		value = target.value;
	}
</script>

<div class="w-full">
	<!-- Label -->
	<label for={fieldId} class="block text-sm font-medium text-gray-700 mb-2">
		{label}
		{#if required}
			<span class="text-red-500" aria-label="обязательное поле">*</span>
		{/if}
	</label>

	<!-- Слот для кастомного контента или стандартные Input/Textarea -->
	{#if $$slots.default}
		<slot />
	{:else if type === 'textarea'}
		<textarea
			id={fieldId}
			name={name || fieldId}
			{placeholder}
			{required}
			{disabled}
			{value}
			class={inputClasses}
			rows="4"
			aria-invalid={!!error}
			aria-describedby={[error ? errorId : '', help ? helpId : '']
				.filter(Boolean)
				.join(' ') || undefined}
			on:input={handleInput}
			{...$$restProps}
		></textarea>
	{:else}
		<input
			id={fieldId}
			name={name || fieldId}
			{type}
			{placeholder}
			{required}
			{disabled}
			{value}
			{autocomplete}
			class={inputClasses}
			aria-invalid={!!error}
			aria-describedby={[error ? errorId : '', help ? helpId : '']
				.filter(Boolean)
				.join(' ') || undefined}
			on:input={handleInput}
			{...$$restProps}
		/>
	{/if}

	<!-- Вспомогательный текст -->
	{#if help}
		<p id={helpId} class="mt-2 text-sm text-gray-600">
			{help}
		</p>
	{/if}

	<!-- Сообщение об ошибке -->
	{#if error}
		<p id={errorId} class="mt-2 text-sm text-red-600" role="alert">
			{error}
		</p>
	{/if}
</div>
