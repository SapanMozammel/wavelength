import { cn } from '@/lib/utils';
import { formatDaySeparator, toIsoString } from '@/lib/utils/time';

type DaySeparatorProps = {
	/** An instant on the day being headed. Epoch milliseconds. */
	at: number;
	/**
	 * The clock "Today" and "Yesterday" are relative to. Required rather than
	 * defaulted to `Date.now()`, because reading the clock during render is
	 * impure — two renders of the same list could disagree about what day it is,
	 * and on a server-rendered surface that is a hydration mismatch.
	 */
	now: number;
	className?: string;
};

/**
 * The date heading between two days of conversation.
 *
 * Sticky, so the day you are reading stays named while you scroll through it.
 * The background is 90% opaque rather than relying on `backdrop-filter` alone:
 * where the filter is unsupported the label would otherwise sit directly on top
 * of message text and become unreadable, which is worse than no blur at all.
 *
 * No `'use client'` — this holds no state and handles no events, so it compiles
 * into whichever bundle imports it rather than forcing a boundary of its own.
 */
const DaySeparator = ({ at, now, className }: DaySeparatorProps) => (
	<div role='separator' aria-label={formatDaySeparator(at, now)} className={cn('bg-canvas/90 dark:bg-canvas-dark/90 sticky top-0 z-5 mt-6 mb-2 flex items-center gap-3 py-1 backdrop-blur-sm first:mt-0', className)}>
		<span aria-hidden='true' className='bg-border-subtle dark:bg-border-subtle-dark h-px flex-1' />
		<time dateTime={toIsoString(at)} className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.625rem] tracking-[0.24em] uppercase'>
			{formatDaySeparator(at, now)}
		</time>
		<span aria-hidden='true' className='bg-border-subtle dark:bg-border-subtle-dark h-px flex-1' />
	</div>
);

export default DaySeparator;
