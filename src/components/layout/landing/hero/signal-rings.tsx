'use client';

import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { memo } from 'react';

/**
 * Four still rings give the motif its structure; three animated ones travel
 * outward through them. Split that way so the composition survives
 * `prefers-reduced-motion`, where the travelling rings simply stop — nothing
 * disappears and nothing is left mid-transform.
 */
const STILL_RINGS = ['size-44', 'size-72', 'size-[26rem]', 'size-[36rem]', 'size-[48rem]'];

/** Staggered so the rings read as a repeating emission rather than a throb. */
const EMISSION_DELAYS = ['0s', '0.8s', '1.6s'];

type SignalRingsProps = {
	className?: string;
};

/**
 * The hero's signal rings — concentric circles emanating from a single point.
 *
 * CSS keyframes rather than a canvas, a video, or a WebGL scene: the animation
 * runs on the compositor and costs no JavaScript per frame, which is why the
 * page's largest contentful paint is still text.
 *
 * **The rings report the API's real state.** They run at full strength when the
 * chat API is awake and dim while it is waking. This is the only reason the
 * component is a Client Component at all, and it earns that: the demo API sleeps
 * on a free tier, so a visitor's first message can wait most of a minute — and a
 * landing page whose signal is visibly weak before they click has already told
 * them why, without a banner and before they can be surprised by it.
 *
 * `pulse-*` is the reserved "this is live" cyan, and the rings are one of the
 * three places `design-system/colors.md` sanctions it. Dimming it when the
 * backend is not live is the same rule, applied honestly.
 */
const SignalRings = memo(({ className }: SignalRingsProps) => {
	const wakeStatus = useAppSelector((state) => state.chat.wakeStatus);
	// `unknown` is the pre-probe state and reads as full strength: the common
	// case is a warm server, and starting dim would libel a healthy API.
	const isWeak = wakeStatus === 'waking' || wakeStatus === 'unreachable';

	return (
		<div aria-hidden='true' className={cn('pointer-events-none absolute grid place-items-center transition-opacity duration-700', isWeak ? 'opacity-40' : 'opacity-100', className)}>
			{STILL_RINGS.map((size) => (
				<span key={size} className={cn('border-signal-500/15 dark:border-signal-400/15 col-start-1 row-start-1 rounded-full border', size)} />
			))}
			{EMISSION_DELAYS.map((delay) => (
				<span key={delay} style={{ animationDelay: delay }} className='animate-pulse-ring border-pulse-500/45 dark:border-pulse-400/40 col-start-1 row-start-1 size-44 rounded-full border' />
			))}
			<span className='bg-pulse-500 dark:bg-pulse-400 col-start-1 row-start-1 size-2 rounded-full' />
		</div>
	);
});

SignalRings.displayName = 'SignalRings';

export default SignalRings;
