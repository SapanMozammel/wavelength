import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

/**
 * `pulse` is reserved for things that are genuinely live — a connection
 * indicator, an unread count driven by a socket arrival. Using the cyan
 * decoratively drains the one place it carries meaning.
 */
const badgeVariants = cva('inline-flex items-center justify-center gap-1 rounded-full font-medium whitespace-nowrap', {
	variants: {
		variant: {
			neutral: 'bg-surface-raised text-ink-muted dark:bg-surface-raised-dark dark:text-ink-muted-dark',
			signal: 'bg-signal-100 text-signal-800 dark:bg-signal-900 dark:text-signal-100',
			pulse: 'bg-pulse-500 text-canvas-dark dark:bg-pulse-400 dark:text-canvas-dark',
			success: 'bg-success/15 text-success',
			warning: 'bg-warning/15 text-warning',
			danger: 'bg-danger/15 text-danger',
		},
		size: {
			sm: 'min-w-4 px-1.5 py-0.5 text-[0.625rem]',
			md: 'min-w-5 px-2 py-0.5 text-xs',
		},
	},
	defaultVariants: { variant: 'neutral', size: 'md' },
});

type BadgeProps = VariantProps<typeof badgeVariants> & {
	children: ReactNode;
	/**
	 * Expanded text for assistive technology, e.g. "3 unread messages" for a
	 * badge whose visible content is a bare `3`.
	 */
	srLabel?: string;
	className?: string;
};

const Badge = ({ children, variant, size, srLabel, className }: BadgeProps) => (
	<span className={cn(badgeVariants({ variant, size }), className)}>
		{srLabel === undefined ? (
			children
		) : (
			<>
				<span aria-hidden='true'>{children}</span>
				<span className='sr-only'>{srLabel}</span>
			</>
		)}
	</span>
);

export default Badge;
