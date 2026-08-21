'use client';

import RouteRedirect from '@/components/layout/auth/route-redirect';
import Skeleton from '@/components/ui/skeleton';
import { useAppSelector } from '@/store/hooks';
import { memo, type ReactNode } from 'react';

/**
 * The client-side route guard.
 *
 * There is no server-side guard to be had. The JWT lives in `localStorage`
 * because the browser talks to the chat API directly — there is no server
 * session for Next.js middleware to read, so middleware could only ever guess.
 * Guarding here is the honest architecture rather than a shortcut.
 *
 * The whole design rests on `session.status` being a **tri-state**. Collapsing
 * it to a boolean would mean treating "not yet checked" as "signed out", and a
 * signed-in user reloading `/chat` would be thrown at `/login` for as long as
 * `/auth/me` takes to answer — on this API's cold start, up to a minute. The
 * `unknown` branch renders a skeleton and waits instead.
 *
 * | `status` | `protected` | `guest` |
 * |---|---|---|
 * | `unknown` | skeleton — never a redirect | children |
 * | `anonymous` | redirect to `/login` | children |
 * | `authenticated` | children | redirect to `/chat` |
 *
 * `guest` renders its children while the status is still `unknown` on purpose:
 * on `/login` the useful default is the form, and a first-time visitor — who
 * has no session to restore — would otherwise be shown a skeleton of a screen
 * they are already looking at.
 */

type AuthGateProps = {
	/** `protected` guards a signed-in route; `guest` bounces a signed-in user away. */
	mode?: 'protected' | 'guest';
	/** Shown instead of the default skeleton while the session is being checked. */
	fallback?: ReactNode;
	children: ReactNode;
};

/**
 * The wait state. `Skeleton` is `aria-hidden` by contract, so the status text
 * beside it is what a screen reader hears — `polite`, because this narrates a
 * background check rather than interrupting anything the user is doing.
 */
const SessionSkeleton = () => (
	<div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10'>
		<p role='status' aria-live='polite' className='text-ink-muted dark:text-ink-muted-dark text-sm'>
			Restoring your session
		</p>
		<div className='flex flex-col gap-4 sm:flex-row'>
			<div className='flex w-full shrink-0 flex-col gap-3 sm:w-72'>
				{[0, 1, 2, 3, 4].map((row) => (
					<div key={row} className='flex items-center gap-3'>
						<Skeleton className='size-10 shrink-0 rounded-full' />
						<div className='flex min-w-0 flex-1 flex-col gap-2'>
							<Skeleton className='h-3 w-1/2' />
							<Skeleton className='h-3 w-3/4' />
						</div>
					</div>
				))}
			</div>
			<div className='flex min-h-64 flex-1 flex-col justify-end gap-3'>
				<Skeleton className='rounded-bubble h-10 w-2/3' />
				<Skeleton className='rounded-bubble h-10 w-1/2 self-end' />
				<Skeleton className='rounded-bubble h-10 w-3/5' />
			</div>
		</div>
	</div>
);

const AuthGate = memo(({ mode = 'protected', fallback, children }: AuthGateProps) => {
	const status = useAppSelector((state) => state.session.status);

	if (mode === 'guest') {
		return status === 'authenticated' ? <RouteRedirect to='/chat' /> : children;
	}

	if (status === 'authenticated') {
		return children;
	}

	// Anonymous renders the same wait state as `unknown` rather than nothing:
	// the redirect is a client navigation, and a blank frame in the meantime
	// reads as a broken page.
	return (
		<>
			{status === 'anonymous' && <RouteRedirect to='/login' />}
			{fallback ?? <SessionSkeleton />}
		</>
	);
});

AuthGate.displayName = 'AuthGate';

export default AuthGate;
