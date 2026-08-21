'use client';

import { useMountEffect } from '@/hooks/use-mount-effect';
import { useRouter } from 'next/navigation';
import { memo } from 'react';

type RouteRedirectProps = {
	/** Where to send the user. Changing it does nothing — remount with a `key` instead. */
	to: string;
};

/**
 * Navigates away, exactly once, and renders nothing.
 *
 * A redirect is a side effect, so it cannot happen during render — but wiring
 * it as `useEffect(() => { if (shouldRedirect) … }, [shouldRedirect])` is the
 * anti-pattern the project's no-`useEffect` rule exists to prevent: the guard
 * lives inside the effect, and re-running it is what produces a redirect loop
 * or a second navigation per in-flight request.
 *
 * Mounting this component *is* the condition instead (rule 4 — conditional
 * mounting over a conditional effect). The parent renders it only in the state
 * that warrants a redirect, so `useMountEffect` fires once, on the transition
 * into that state, and cannot fire again while the state holds.
 *
 * `replace`, never `push`: the screen being left is one the user cannot use, so
 * leaving it on the history stack only builds a back button that bounces.
 */
const RouteRedirect = memo(({ to }: RouteRedirectProps) => {
	const router = useRouter();

	useMountEffect(() => {
		router.replace(to);
	});

	return null;
});

RouteRedirect.displayName = 'RouteRedirect';

export default RouteRedirect;
