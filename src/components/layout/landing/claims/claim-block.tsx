import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type ClaimBlockProps = {
	/** The domain this claim belongs to — `Identity`, `Transport`, `Groups`. */
	kicker: string;
	title: string;
	/** The supporting visual. One per claim, and it has to argue something. */
	figure: ReactNode;
	children: ReactNode;
	/** Put the figure on the left instead. The section alternates. */
	reversed?: boolean;
};

/**
 * One claim: a kicker, a heading, prose, and a single supporting visual.
 *
 * Not a three-column icon grid — the brief rules that out by name, and an
 * outline icon next to a two-word label makes an assertion rather than an
 * argument. Each figure here shows the thing rather than symbolising it.
 */
const ClaimBlock = ({ kicker, title, figure, children, reversed = false }: ClaimBlockProps) => (
	<article className='grid items-center gap-10 lg:grid-cols-2 lg:gap-16'>
		<div className={cn('max-w-xl', reversed && 'lg:order-2')}>
			<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.6875rem] tracking-[0.32em] uppercase'>{kicker}</p>
			<h3 className='font-display mt-4 text-[clamp(1.375rem,1.15rem+0.9vw,1.875rem)] leading-tight font-semibold tracking-tight text-balance'>{title}</h3>
			<div className='text-ink-muted dark:text-ink-muted-dark mt-5 space-y-4 leading-relaxed text-pretty'>{children}</div>
		</div>
		<div className={cn(reversed && 'lg:order-1')}>{figure}</div>
	</article>
);

export default ClaimBlock;
