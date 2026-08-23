import Badge from '@/components/ui/badge';

type GroupEvent = {
	time: string;
	text: string;
	/** An optional state change the event produced. */
	marker?: string;
};

/**
 * An afternoon in one group. Every line here maps to a real endpoint — create,
 * add participants, rename, leave, promote — which is the claim the figure is
 * making: these are behaviours, not settings screens.
 */
const GROUP_EVENTS: GroupEvent[] = [
	{ time: '09:04', text: 'Priya created “Sunday ride”' },
	{ time: '09:04', text: 'Priya added Marcus, Dee and you', marker: '4 members' },
	{ time: '09:19', text: 'Dee renamed it to “Sunday ride — 7am”' },
	{ time: '09:31', text: 'Marcus left', marker: '3 members' },
	{ time: '09:46', text: 'Priya made you an admin', marker: 'admin' },
];

/** The group event log — a timeline, not a feature list. */
const FigureRoster = () => (
	<div className='rounded-panel border-border-subtle bg-surface dark:border-border-subtle-dark dark:bg-surface-dark border p-6 sm:p-8'>
		<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>Sunday ride · this morning</p>
		<ol className='mt-5 space-y-4'>
			{GROUP_EVENTS.map((event) => (
				<li key={`${event.time}-${event.text}`} className='grid grid-cols-[3.25rem_1fr] items-start gap-3'>
					<span className='text-ink-muted dark:text-ink-muted-dark pt-0.5 font-mono text-xs tabular-nums'>{event.time}</span>
					<span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
						<span className='text-ink dark:text-ink-dark text-sm text-pretty'>{event.text}</span>
						{event.marker !== undefined && (
							<Badge variant='signal' size='sm'>
								{event.marker}
							</Badge>
						)}
					</span>
				</li>
			))}
		</ol>
	</div>
);

export default FigureRoster;
