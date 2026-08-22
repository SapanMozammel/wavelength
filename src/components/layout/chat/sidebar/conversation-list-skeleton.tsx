import Skeleton from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ConversationListSkeletonProps = {
	rows?: number;
	className?: string;
};

/**
 * The shape of the list before it arrives. Purely presentational, so no
 * `'use client'` and no `memo` — it has no state to preserve.
 *
 * `Skeleton` is `aria-hidden` by contract, so the caller pairs this with a
 * `role="status"` line that says what is loading. A wall of grey boxes is
 * silence to a screen reader.
 */
const ConversationListSkeleton = ({ rows = 6, className }: ConversationListSkeletonProps) => (
	<div className={cn('flex flex-col gap-1 p-2', className)}>
		{Array.from({ length: rows }, (_, index) => index).map((row) => (
			<div key={row} className='flex items-center gap-3 px-3 py-2.5'>
				<Skeleton className='size-10 shrink-0 rounded-full' />
				<div className='flex min-w-0 flex-1 flex-col gap-2'>
					<Skeleton className='h-3 w-1/2' />
					<Skeleton className='h-3 w-3/4' />
				</div>
			</div>
		))}
	</div>
);

export default ConversationListSkeleton;
