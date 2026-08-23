'use client';

import { useEffect, useState } from 'react';

/**
 * A value that lags behind its source until the source stops changing.
 *
 * Search is the only consumer today: every keystroke would otherwise be a
 * request, and the API's search endpoint is the slowest thing in the app.
 *
 * `useEffect` appears here rather than a component on purpose — a timer keyed
 * on a changing value is exactly the "reusable custom hook" case
 * `.claude/skills/workflow/no-use-effect.md` carves out, and the cleanup is
 * what makes the debounce a debounce rather than a queue of pending writes.
 * Components import this; they never write the timer themselves.
 */
export const useDebouncedValue = <TValue>(value: TValue, delayMs: number): TValue => {
	const [settled, setSettled] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setSettled(value);
		}, delayMs);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delayMs]);

	return settled;
};
