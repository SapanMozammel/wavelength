'use client';

import { useApiWake } from '@/hooks/use-api-wake';
import { useAppSelector } from '@/store/hooks';
import { memo } from 'react';

/**
 * Fires the health probe once for the whole app, and renders nothing.
 *
 * Mounted in `providers` beside `SessionBoot` for the same reason that one is:
 * the wait it describes belongs to the *session*, not to a route. A visitor who
 * lands on `/` and clicks through to `/login` twenty seconds later should see a
 * server that is already warm — and if it is not, they should meet a narration
 * already counting from the real start rather than one that just began.
 *
 * The `key` is the retry mechanism. `useApiWake` runs its probe from a mount
 * effect, so re-running it means remounting it; `wakeRetryRequested` bumps
 * `wakeAttempt`, the key changes, the old probe's cleanup aborts its request and
 * clears its clocks, and a single fresh loop starts. This is the project's
 * sanctioned alternative to an effect with a dependency array — and it is also
 * the only version of retry that cannot leave two probe loops racing.
 */
const WakeProbe = () => {
	useApiWake();
	return null;
};

const WakeBoot = memo(() => {
	const attempt = useAppSelector((state) => state.chat.wakeAttempt);
	return <WakeProbe key={attempt} />;
});

WakeBoot.displayName = 'WakeBoot';

export default WakeBoot;
