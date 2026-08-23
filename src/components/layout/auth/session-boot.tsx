'use client';

import { useSessionRestore } from '@/hooks/use-session-restore';
import { memo } from 'react';

/**
 * Runs session restore exactly once for the whole app, and renders nothing.
 *
 * It is mounted in `providers` rather than inside `AuthGate` deliberately: a
 * guard is per-route, and restore that lives in the guard would re-run on every
 * guarded navigation and — worse — would never run on `/login`, leaving the
 * form unable to tell a returning user from a new one.
 *
 * Rendering `null` is the point. This is an app-lifecycle concern with no
 * markup of its own; the surfaces that care about the outcome read
 * `session.status` from the store.
 */
const SessionBoot = memo(() => {
	useSessionRestore();
	return null;
});

SessionBoot.displayName = 'SessionBoot';

export default SessionBoot;
