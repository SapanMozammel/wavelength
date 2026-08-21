/** Eight fixed cells, written out so nothing composes a class at runtime. */
const POLL_INTERVALS = ['poll-1', 'poll-2', 'poll-3', 'poll-4', 'poll-5', 'poll-6', 'poll-7', 'poll-8'];

/**
 * Two transports on the same axis.
 *
 * The socket track is one unbroken line from the event to the screen. The
 * polling track is the same distance chopped into intervals, and the shape of
 * the gap is the entire point — a poll can only ever be as fresh as its
 * schedule. Cyan marks the live track, which is the one thing
 * `design-system/colors.md` reserves `pulse-*` for.
 */
const FigureLatency = () => (
	<div className='rounded-panel border-border-subtle bg-surface dark:border-border-subtle-dark dark:bg-surface-dark border p-6 sm:p-8'>
		<div className='flex flex-wrap items-baseline justify-between gap-2'>
			<p className='text-pulse-700 dark:text-pulse-400 font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>Socket</p>
			<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-xs'>arrives on the event</p>
		</div>
		<div aria-hidden='true' className='mt-3 flex items-center gap-2'>
			<span className='bg-pulse-700 dark:bg-pulse-400 size-2.5 shrink-0 rounded-full' />
			<span className='bg-pulse-700/50 dark:bg-pulse-400/50 h-0.5 flex-1 rounded-full' />
			<span className='bg-pulse-700 dark:bg-pulse-400 size-2.5 shrink-0 rounded-full' />
		</div>

		<div className='mt-10 flex flex-wrap items-baseline justify-between gap-2'>
			<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>Polling</p>
			<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-xs'>arrives at the next tick</p>
		</div>
		<div aria-hidden='true' className='mt-3 flex items-center gap-2'>
			<span className='bg-ink-muted/50 dark:bg-ink-muted-dark/50 size-2.5 shrink-0 rounded-full' />
			<span className='flex flex-1 items-center'>
				{POLL_INTERVALS.map((interval) => (
					<span key={interval} className='border-border-subtle dark:border-border-subtle-dark h-3 flex-1 border-r border-dashed last:border-r-0' />
				))}
			</span>
			<span className='bg-ink-muted/50 dark:bg-ink-muted-dark/50 size-2.5 shrink-0 rounded-full' />
		</div>

		<p className='text-ink-muted dark:text-ink-muted-dark mt-8 text-sm leading-relaxed text-pretty'>
			Every gap in the lower track is time a message already exists and nobody has been told. The upper track has no gaps because it has no schedule.
		</p>
	</div>
);

export default FigureLatency;
