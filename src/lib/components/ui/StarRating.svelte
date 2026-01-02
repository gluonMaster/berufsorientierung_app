<script lang="ts">
	/**
	 * StarRating Component
	 * Компонент для отображения и выбора рейтинга звёздами
	 *
	 * Mobile-first: touch targets >= 44px, сенсорная оптимизация
	 */
	import { createEventDispatcher } from 'svelte';
	import { Star } from 'lucide-svelte';

	/** Текущее значение рейтинга (1-based) */
	export let value: number = 0;

	/** Максимальное количество звёзд */
	export let max: number = 10;

	/** Режим только для чтения */
	export let readonly: boolean = false;

	/** Размер звёзд: sm, md, lg */
	export let size: 'sm' | 'md' | 'lg' = 'md';

	/** aria-label для группы рейтинга (передаётся снаружи для i18n) */
	export let ariaLabel: string = 'Rating';

	/** Callback при изменении значения */
	export let onChange: ((v: number) => void) | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: number }>();

	// Размеры иконок и отступы для каждого размера
	const sizeConfig = {
		sm: { iconSize: 20, gap: 'gap-0.5', touchSize: 'min-w-[32px] min-h-[32px]' },
		md: { iconSize: 24, gap: 'gap-1', touchSize: 'min-w-[44px] min-h-[44px]' },
		lg: { iconSize: 32, gap: 'gap-1.5', touchSize: 'min-w-[48px] min-h-[48px]' },
	};

	$: config = sizeConfig[size];

	// Hover состояние для preview
	let hoverValue: number | null = null;

	// Вычисляем отображаемое значение (hover приоритет)
	$: displayValue = hoverValue !== null ? hoverValue : value;

	function handleClick(starIndex: number) {
		if (readonly) return;

		const newValue = starIndex + 1;
		value = newValue;

		// Вызываем callback и dispatch event
		if (onChange) {
			onChange(newValue);
		}
		dispatch('change', newValue);
	}

	function handleMouseEnter(starIndex: number) {
		if (readonly) return;
		hoverValue = starIndex + 1;
	}

	function handleMouseLeave() {
		if (readonly) return;
		hoverValue = null;
	}

	function handleKeyDown(event: KeyboardEvent, starIndex: number) {
		if (readonly) return;

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(starIndex);
		}
	}

	// Генерируем массив звёзд
	$: stars = Array.from({ length: max }, (_, i) => i);
</script>

<div class="inline-flex flex-wrap items-center {config.gap}" role="group" aria-label={ariaLabel}>
	{#each stars as starIndex (starIndex)}
		{@const isFilled = starIndex < displayValue}
		{@const isActive = !readonly}
		<button
			type="button"
			class="
				flex items-center justify-center
				{config.touchSize}
				rounded-md
				transition-all duration-150
				focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
				{isActive ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
				{readonly ? 'pointer-events-none' : ''}
			"
			disabled={readonly}
			tabindex={readonly ? -1 : 0}
			aria-label={`${ariaLabel} ${starIndex + 1}/${max}`}
			aria-pressed={isFilled}
			on:click={() => handleClick(starIndex)}
			on:mouseenter={() => handleMouseEnter(starIndex)}
			on:mouseleave={handleMouseLeave}
			on:keydown={(e) => handleKeyDown(e, starIndex)}
		>
			<Star
				size={config.iconSize}
				class="
					transition-colors duration-150
					{isFilled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
					{isActive && !isFilled ? 'hover:text-yellow-300' : ''}
				"
				aria-hidden="true"
			/>
		</button>
	{/each}

	<!-- Отображение числового значения -->
	{#if value > 0}
		<span class="ml-2 text-sm font-medium text-gray-700" aria-live="polite">
			{value}/{max}
		</span>
	{/if}
</div>
