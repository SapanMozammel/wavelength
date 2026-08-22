'use client';

import Button from '@/components/ui/button';
import { useWakeDismissal, useWakeElapsed, wakeCopyFor } from '@/hooks/use-api-wake';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { wakeRetryRequested } from '@/store/slices/chat-slice';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { memo } from 'react';

/**
 * Narrates the demo API's cold start, and — far more often — says nothing.
 *
 * The API is on a free Render tier that sleeps after inactivity (quirk 20), so
 * the first request of a session can take 30 to 60 seconds. A spinner held for
 * 45 seconds is indistinguishable from a broken app; naming the cause turns the
 * same 45 seconds into evidence that someone ran this thing.
 *
 * Three states reach the screen and one deliberately does not:
 *
 * - `unknown` — renders `null`. This is the common case and it is silent.
 * - `waking` — `role="status"`, escalating copy, a breathing dot, an elapsed
 *   counter. Not `text-danger`: a cold start is expected behaviour, and
 *   colouring it red would tell the user something untrue.
 * - `awake` — a brief acknowledgement, **only if narration actually happened**.
 *   Closing the loop matters; announcing a resolution to a wait nobody noticed
 *   does not.
 * - `unreachable` — this one *is* an error, so `role="alert"`, the AA-safe
 *   `danger-ink` pair, and a focusable retry that genuinely re-probes.
 */

type WakeNoticeProps = {
	className?: string;
};

/**
 * The per-state sub-components take `className` as *required but possibly
 * undefined*, rather than optional. Under `exactOptionalPropertyTypes` the two
 * are different types, and forwarding an absent optional prop is only legal
 * against this shape.
 */
type StateNoticeProps = {
	className: string | undefined;
};

/** One shell for every state, so the notice never changes size or shape as the copy escalates. */
const shell = 'bg-surface-raised dark:bg-surface-raised-dark rounded-panel animate-bubble-in flex items-center gap-3 px-3.5 py-3 text-sm';

/**
 * A slow breathing ring on the existing `pulse-ring` keyframe.
 *
 * It signals *working*, not *stuck* — the distinction a spinner cannot make.
 * Decorative, so `aria-hidden`; `prefers-reduced-motion` is honoured globally.
 */
const PulseDot = () => (
	<span aria-hidden='true' className='relative flex size-2.5 shrink-0 items-center justify-center'>
		<span className='bg-pulse-500 animate-pulse-ring absolute inline-flex size-2.5 rounded-full' />
		<span className='bg-pulse-700 dark:bg-pulse-500 relative inline-flex size-2 rounded-full' />
	</span>
);

const WakingNotice = ({ className }: StateNoticeProps) => {
	const elapsedMs = useWakeElapsed();

	return (
		// `aria-live="polite"`, never `assertive` — this is information, not an
		// interruption. The counter below is `aria-hidden`, which removes it
		// from the accessibility tree entirely, so the live region diffs only
		// the copy and a screen reader hears one short sentence per escalation
		// instead of a number every second.
		<div role='status' aria-live='polite' className={cn(shell, className)}>
			<PulseDot />
			<p className='text-ink dark:text-ink-dark text-pretty'>{wakeCopyFor(elapsedMs)}</p>
			<span aria-hidden='true' className='text-ink-muted dark:text-ink-muted-dark ml-auto shrink-0 font-mono text-xs tabular-nums'>
				{Math.floor(elapsedMs / 1000)}s
			</span>
		</div>
	);
};

const AwakeNotice = ({ className }: StateNoticeProps) => {
	const leaving = useWakeDismissal();

	return (
		<div role='status' aria-live='polite' className={cn(shell, 'transition-opacity duration-400', leaving && 'opacity-0', className)}>
			<IconCircleCheck aria-hidden='true' className='text-success size-4 shrink-0' />
			<p className='text-ink dark:text-ink-dark text-pretty'>Server’s awake — thanks for waiting.</p>
		</div>
	);
};

const UnreachableNotice = ({ className }: StateNoticeProps) => {
	const dispatch = useAppDispatch();

	return (
		<div role='alert' className={cn(shell, className)}>
			<IconAlertCircle aria-hidden='true' className='text-danger size-4 shrink-0' />
			{/* `danger-ink`, not `danger`: the fill colour is only 3.87:1 as text
			    on a light surface and fails AA. Same hue, readable. */}
			<p className='text-danger-ink dark:text-danger-ink-dark text-pretty'>The demo server isn’t responding. It may still be waking up.</p>
			<Button type='button' variant='secondary' size='sm' className='ml-auto shrink-0' onClick={() => dispatch(wakeRetryRequested())}>
				Retry
			</Button>
		</div>
	);
};

const WakeNotice = memo(({ className }: WakeNoticeProps) => {
	const status = useAppSelector((state) => state.chat.wakeStatus);
	const narrated = useAppSelector((state) => state.chat.wakeNarrated);

	if (status === 'waking') {
		return <WakingNotice className={className} />;
	}
	if (status === 'unreachable') {
		return <UnreachableNotice className={className} />;
	}
	// The `narrated` guard is the whole reason a warm load stays silent end to
	// end: without it, every single page load would flash "Server's awake".
	if (status === 'awake' && narrated) {
		return <AwakeNotice className={className} />;
	}
	return null;
});

WakeNotice.displayName = 'WakeNotice';

export default WakeNotice;
