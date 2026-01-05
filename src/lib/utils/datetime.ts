const DEFAULT_TIME_ZONE = 'Europe/Berlin';

function hasExplicitTimeZone(value: string): boolean {
	// ISO timezone designator: Z or ±HH:MM / ±HHMM / ±HH
	return /([zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(value);
}

function getTimeZoneParts(date: Date, timeZone: string) {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	const parts = dtf.formatToParts(date);
	const map: Record<string, string> = {};
	for (const part of parts) {
		if (part.type !== 'literal') {
			map[part.type] = part.value;
		}
	}

	return {
		year: Number(map.year),
		month: Number(map.month),
		day: Number(map.day),
		hour: Number(map.hour),
		minute: Number(map.minute),
		second: Number(map.second),
	};
}

function zonedTimeToUtc(
	components: {
		year: number;
		month: number;
		day: number;
		hour: number;
		minute: number;
		second: number;
		millisecond: number;
	},
	timeZone: string
): Date {
	const desiredLocalAsUtc = Date.UTC(
		components.year,
		components.month - 1,
		components.day,
		components.hour,
		components.minute,
		components.second,
		components.millisecond
	);

	let utcMillis = desiredLocalAsUtc;
	for (let i = 0; i < 3; i++) {
		const parts = getTimeZoneParts(new Date(utcMillis), timeZone);
		const actualLocalAsUtc = Date.UTC(
			parts.year,
			parts.month - 1,
			parts.day,
			parts.hour,
			parts.minute,
			parts.second,
			components.millisecond
		);

		const diff = actualLocalAsUtc - desiredLocalAsUtc;
		if (diff === 0) break;
		utcMillis -= diff;
	}

	return new Date(utcMillis);
}

/**
 * Parses an ISO date-time string into a Date in a timezone-safe way.
 *
 * - If the string contains an explicit timezone (Z / offset), it is parsed directly.
 * - Otherwise, it is treated as a wall-clock time in `timeZone` (default: Europe/Berlin).
 */
export function parseDateTime(value: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
	const direct = new Date(value);
	if (!Number.isNaN(direct.getTime()) && hasExplicitTimeZone(value)) {
		return direct;
	}

	const match =
		/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
			value
		);

	if (!match) {
		return direct;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = match[6] ? Number(match[6]) : 0;
	const millisecond = match[7] ? Number(match[7].padEnd(3, '0')) : 0;

	if (
		[year, month, day, hour, minute, second, millisecond].some((n) =>
			Number.isNaN(n)
		)
	) {
		return direct;
	}

	return zonedTimeToUtc(
		{ year, month, day, hour, minute, second, millisecond },
		timeZone
	);
}

