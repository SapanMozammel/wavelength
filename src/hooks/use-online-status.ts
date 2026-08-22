'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the device believes it has a network connection.
 *
 * Worth distinguishing from the socket's own state: "you're offline" is
 * actionable and "reconnecting" is not, and telling someone on a train that the
 * server is having trouble is both wrong and unhelpful.
 *
 * `useSyncExternalStore` rather than a subscription effect — this is exactly the
 * external-store case the hook exists for.
 */
const subscribe = (onStoreChange: () => void): (() => void) => {
	if (typeof window === 'undefined') {
		return () => undefined;
	}
	window.addEventListener('online', onStoreChange);
	window.addEventListener('offline', onStoreChange);
	return () => {
		window.removeEventListener('online', onStoreChange);
		window.removeEventListener('offline', onStoreChange);
	};
};

const getSnapshot = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine);

/** Optimistic on the server: a prerendered page must not claim the user is offline. */
const getServerSnapshot = (): boolean => true;

export const useOnlineStatus = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
