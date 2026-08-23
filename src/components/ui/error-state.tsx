'use client';

import Button from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IconAlertTriangle } from '@tabler/icons-react';
import { memo } from 'react';

type ErrorStateProps = {
	title: string;
	/**
	 * User-facing copy only. Never pass a raw API message through here — the
	 * upstream server leaks Mongoose `CastError` text and numeric driver codes.
	 */
	description?: string;
	onRetry?: () => void;
	retryLabel?: string;
	className?: string;
};

/**
 * An inline failure with the action that resolves it. Every error surface in
 * this app offers a way forward; an error with no affordance is a dead end the
 * user has to reload out of.
 */
const ErrorState = memo(({ title, description, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) => (
	<div role='alert' className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
		<IconAlertTriangle aria-hidden='true' className='text-danger size-6' />
		<p className='text-ink dark:text-ink-dark text-sm font-medium text-balance'>{title}</p>
		{description !== undefined && <p className='text-ink-muted dark:text-ink-muted-dark max-w-xs text-sm text-pretty'>{description}</p>}
		{onRetry !== undefined && (
			<Button variant='secondary' size='sm' onClick={onRetry}>
				{retryLabel}
			</Button>
		)}
	</div>
));

ErrorState.displayName = 'ErrorState';

export default ErrorState;
