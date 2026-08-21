import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type EmptyStateProps = {
	/** A Tabler icon element, already sized by the caller. */
	icon?: ReactNode;
	title: string;
	description?: string;
	/** A call to action — the thing that resolves the emptiness. */
	action?: ReactNode;
	className?: string;
};

/**
 * The "nothing here yet" surface. An empty state should always name the action
 * that fills it: a blank panel reads as broken, an invitation does not.
 */
const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
	<div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
		{icon !== undefined && <span className='text-ink-muted dark:text-ink-muted-dark'>{icon}</span>}
		<p className='font-display text-ink dark:text-ink-dark text-base font-semibold text-balance'>{title}</p>
		{description !== undefined && <p className='text-ink-muted dark:text-ink-muted-dark max-w-xs text-sm text-pretty'>{description}</p>}
		{action}
	</div>
);

export default EmptyState;
