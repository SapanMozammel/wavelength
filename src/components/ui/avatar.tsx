'use client';

import { cn } from '@/lib/utils';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { memo, useMemo } from 'react';

/**
 * Tone classes are a **static** lookup, never built by interpolation — Tailwind
 * scans source literally, so a class assembled at runtime does not exist in the
 * compiled CSS. Every tone is drawn from the `signal-*` ramp so an avatar wall
 * never leaves the palette.
 */
const AVATAR_TONES = [
	'bg-signal-100 text-signal-800 dark:bg-signal-900 dark:text-signal-100',
	'bg-signal-200 text-signal-900 dark:bg-signal-800 dark:text-signal-100',
	'bg-signal-300 text-signal-900 dark:bg-signal-700 dark:text-signal-50',
	'bg-signal-50 text-signal-700 dark:bg-signal-800 dark:text-signal-200',
	'bg-pulse-400 text-canvas-dark dark:bg-pulse-600 dark:text-canvas-dark',
] as const;

const SIZES = {
	sm: 'size-8 text-[0.625rem]',
	md: 'size-10 text-xs',
	lg: 'size-12 text-sm',
} as const;

/**
 * First letters of the first and last word — "Ada Lovelace" becomes "AL".
 * Falls back to a neutral glyph rather than rendering an empty circle, because
 * the API accepts any non-empty name and a whitespace name is reachable.
 */
export const getInitials = (name: string): string => {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) {
		return '?';
	}
	const first = words[0]?.[0] ?? '';
	const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
	return (first + last).toUpperCase();
};

/** Stable per-identity tone: the same user is the same colour on every render and every device. */
export const getToneIndex = (seed: string): number => {
	let hash = 0;
	for (let index = 0; index < seed.length; index += 1) {
		hash = (hash * 31 + seed.charCodeAt(index)) % 2 ** 31;
	}
	return hash % AVATAR_TONES.length;
};

type AvatarProps = {
	name: string;
	/** Stable identity for tone selection — the user id, not the name, which can change. */
	seed?: string;
	size?: keyof typeof SIZES;
	className?: string;
};

/**
 * There is no avatar image anywhere in this API — users carry only an id, a
 * name, and a phone number. So this is always the initials fallback, and it is
 * `aria-hidden`: the adjacent name is the accessible label, and announcing "AL"
 * before it would just be noise.
 */
const Avatar = memo(({ name, seed, size = 'md', className }: AvatarProps) => {
	const tone = useMemo(() => AVATAR_TONES[getToneIndex(seed ?? name)], [seed, name]);

	return (
		<AvatarPrimitive.Root aria-hidden='true' className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium select-none', SIZES[size], tone, className)}>
			<AvatarPrimitive.Fallback delayMs={0}>{getInitials(name)}</AvatarPrimitive.Fallback>
		</AvatarPrimitive.Root>
	);
});

Avatar.displayName = 'Avatar';

export default Avatar;
