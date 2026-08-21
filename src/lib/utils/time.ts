const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

/** `14:32` — the timestamp shown on every message bubble. */
export const formatMessageTime = (epochMs: number): string => timeFormatter.format(epochMs);

/** Machine-readable value for a `<time dateTime>` attribute. */
export const toIsoString = (epochMs: number): string => new Date(epochMs).toISOString();

/** Full timestamp for the bubble's `title` tooltip. */
export const formatFullTimestamp = (epochMs: number): string => `${fullDateFormatter.format(epochMs)} at ${timeFormatter.format(epochMs)}`;

/** `14:32` today, `Tuesday` this week, `Mar 4` beyond — for the conversation list. */
export const formatRelativeStamp = (epochMs: number, now: number = Date.now()): string => {
	const elapsed = now - epochMs;
	if (elapsed < DAY && new Date(epochMs).getDate() === new Date(now).getDate()) {
		return timeFormatter.format(epochMs);
	}
	if (elapsed < 7 * DAY) {
		return weekdayFormatter.format(epochMs);
	}
	return dateFormatter.format(epochMs);
};

/** `Today` / `Yesterday` / `March 4, 2026` — the sticky separator in the message list. */
export const formatDaySeparator = (epochMs: number, now: number = Date.now()): string => {
	const startOfDay = (value: number) => new Date(value).setHours(0, 0, 0, 0);
	const dayDelta = Math.round((startOfDay(now) - startOfDay(epochMs)) / DAY);
	if (dayDelta === 0) {
		return 'Today';
	}
	if (dayDelta === 1) {
		return 'Yesterday';
	}
	return fullDateFormatter.format(epochMs);
};

/** True when two messages fall on different calendar days (drives the separator). */
export const isDifferentDay = (a: number, b: number): boolean => new Date(a).toDateString() !== new Date(b).toDateString();
