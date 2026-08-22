'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the primary pointer is coarse — a finger rather than a mouse.
 *
 * This is the input to one decision: on a touch device the soft keyboard's
 * return key must insert a newline instead of sending, because a return key
 * that sends is how half-finished messages get delivered.
 *
 * `matchMedia`, never a user-agent sniff. A UA string is a claim about the
 * device; `(pointer: coarse)` is what the browser reports about the pointer
 * actually in use, so a tablet with a trackpad attached and a phone in desktop
 * mode both answer correctly, and the answer updates live when it changes.
 */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * A fresh `MediaQueryList` per call rather than a module-level cache.
 *
 * The snapshot is a boolean, so `useSyncExternalStore` compares values and not
 * identities — nothing is gained by caching the list, and a cached one would
 * outlive a test that replaces `window.matchMedia`.
 */
const mediaQueryList = (): MediaQueryList | null => (typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(COARSE_POINTER_QUERY));

const subscribe = (onStoreChange: () => void): (() => void) => {
	const list = mediaQueryList();
	if (list === null) {
		return () => undefined;
	}
	list.addEventListener('change', onStoreChange);
	return () => list.removeEventListener('change', onStoreChange);
};

const getSnapshot = (): boolean => mediaQueryList()?.matches ?? false;

/**
 * The server has no pointer. `false` means "Enter sends", which is also what
 * the desktop client resolves to on hydration in the overwhelming majority of
 * cases — so the common path never flips behaviour after first paint.
 */
const getServerSnapshot = (): boolean => false;

export const useCoarsePointer = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
