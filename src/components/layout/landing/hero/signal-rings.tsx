import { cn } from '@/lib/utils';

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
 * runs on the compositor, costs no JavaScript, and this stays a Server
 * Component, which is the whole reason the landing page's largest contentful
 * paint is text.
 *
 * `pulse-*` is the reserved "this is live" cyan, and the rings are one of the
 * three places `design-system/colors.md` sanctions it.
 *
 * TODO(blocked-on-09): drive the ring opacity from `wakeStatus` in `chat-slice`
 * — full when the API is awake, dimmed while it is waking — once
 * `.claude/plans/09-cold-start-narration` lands `wakeStatus` and step 7 of that
 * plan exposes it. That turns this into a Client Component reading
 * `useAppSelector`; until then there is no status to read and no reason to ship
 * the JavaScript.
 */
const SignalRings = ({ className }: SignalRingsProps) => (
	<div aria-hidden='true' className={cn('pointer-events-none absolute grid place-items-center', className)}>
		{STILL_RINGS.map((size) => (
			<span key={size} className={cn('border-signal-500/15 dark:border-signal-400/15 col-start-1 row-start-1 rounded-full border', size)} />
		))}
		{EMISSION_DELAYS.map((delay) => (
			<span key={delay} style={{ animationDelay: delay }} className='animate-pulse-ring border-pulse-500/45 dark:border-pulse-400/40 col-start-1 row-start-1 size-44 rounded-full border' />
		))}
		<span className='bg-pulse-500 dark:bg-pulse-400 col-start-1 row-start-1 size-2 rounded-full' />
	</div>
);

export default SignalRings;
