import { useEffect } from 'react';

/**
 * Run an effect exactly once, on mount.
 *
 * This is the **only** sanctioned wrapper around `useEffect` in this project —
 * see `.claude/skills/workflow/no-use-effect.md`. Components must never call
 * `useEffect` directly; they reach for derived state, event handlers, `useMemo`,
 * `useSyncExternalStore`, or a `key` prop to force a clean remount.
 *
 * Use it only for true mount-time synchronisation with an external system: the
 * socket connection, a `localStorage` read, an `IntersectionObserver`. If the
 * work can be computed during render or triggered by a user action, it does not
 * belong here.
 *
 * The empty dependency array is deliberate and the lint rule is suppressed
 * rather than satisfied: "run once on mount" is the contract, so a changing
 * `effect` identity must **not** re-run it. Callers that need to re-run on a
 * value change should remount via `key` instead (Rule 5).
 */
export const useMountEffect = (effect: () => void | (() => void)): void => {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(effect, []);
};
