'use client';

import { cn } from '@/lib/utils';
import { IconArrowDown } from '@tabler/icons-react';
import { memo } from 'react';

type NewMessagesPillProps = {
	count: number;
	onJump: () => void;
	className?: string;
};

/**
 * The affordance that makes "do not yank the reader" survivable.
 *
 * Without it, holding position when a message arrives means the message is
 * simply invisible — which is a worse failure than scrolling would have been.
 * The count is part of the accessible name, not decoration beside it.
 */
const NewMessagesPill = memo(({ count, onJump, className }: NewMessagesPillProps) => {
	if (count === 0) {
		return null;
	}

	const label = count === 1 ? '1 new message, jump to latest' : `${count.toString()} new messages, jump to latest`;

	return (
		<div className={cn('pointer-events-none absolute inset-x-0 bottom-4 flex justify-center', className)}>
			<button
				type='button'
				onClick={onJump}
				aria-label={label}
				className='bg-signal-600 dark:bg-signal-500 dark:text-canvas-dark animate-bubble-in pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/15'
			>
				<IconArrowDown aria-hidden='true' className='size-3.5' />
				<span aria-hidden='true'>{count === 1 ? '1 new message' : `${count.toString()} new messages`}</span>
			</button>
		</div>
	);
});

NewMessagesPill.displayName = 'NewMessagesPill';

export default NewMessagesPill;
