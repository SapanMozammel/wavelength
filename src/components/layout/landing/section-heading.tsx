import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type SectionHeadingProps = {
	/** Two-digit transmission index — `01` through `04`, in document order. */
	index: string;
	/** The short tag that follows the index in the eyebrow. */
	tag: string;
	title: string;
	/** The lede paragraph under the title. */
	children?: ReactNode;
	className?: string;
};

/**
 * The one heading treatment every section below the hero uses.
 *
 * The numbered eyebrow is the page's spine: it reads as a transmission log,
 * which is the whole visual conceit, and it also gives a reader scanning on a
 * phone a fixed landmark at the top of each screenful.
 */
const SectionHeading = ({ index, tag, title, children, className }: SectionHeadingProps) => (
	<div className={cn('max-w-2xl', className)}>
		<p className='text-signal-600 dark:text-signal-300 flex items-center gap-3 font-mono text-[0.6875rem] tracking-[0.32em] uppercase'>
			<span>{index}</span>
			<span aria-hidden='true' className='bg-signal-600/40 dark:bg-signal-300/40 h-px w-8' />
			<span>{tag}</span>
		</p>
		<h2 className='font-display mt-5 text-[clamp(1.75rem,1.15rem+2.4vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-balance'>{title}</h2>
		{children !== undefined && <div className='text-ink-muted dark:text-ink-muted-dark mt-5 text-[clamp(0.9375rem,0.9rem+0.25vw,1.0625rem)] leading-relaxed text-pretty'>{children}</div>}
	</div>
);

export default SectionHeading;
