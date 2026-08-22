import Skeleton from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * A fixed, deliberately irregular script rather than uniform bars.
 *
 * Widths and sides are hard-coded because a random layout changes on every
 * render, and alternating them one-for-one reads as a barcode. This shape is
 * roughly what a real thread looks like, so the panel does not visibly reflow
 * when the messages land.
 */
const SKELETON_ROWS = [
	{ id: 'a', isOwn: false, width: 'w-48' },
	{ id: 'b', isOwn: false, width: 'w-32' },
	{ id: 'c', isOwn: true, width: 'w-40' },
	{ id: 'd', isOwn: false, width: 'w-56' },
	{ id: 'e', isOwn: true, width: 'w-36' },
	{ id: 'f', isOwn: true, width: 'w-28' },
] as const;

type MessageSkeletonProps = {
	className?: string;
};

/**
 * The initial-load placeholder: skeleton **bubbles** in alternating alignment,
 * not a spinner. It occupies the shape the real content will take, so the panel
 * does not jump when history arrives.
 *
 * The bubbles are `aria-hidden` — a screen reader gains nothing from a wall of
 * empty boxes — and the wait is narrated once by the `role="status"` sibling.
 */
const MessageSkeleton = ({ className }: MessageSkeletonProps) => (
	<div className={cn('flex flex-col gap-2 px-4 py-5', className)}>
		<p role='status' className='sr-only'>
			Loading messages
		</p>
		{SKELETON_ROWS.map((row) => (
			<span key={row.id} className={cn('flex', row.isOwn ? 'justify-end' : 'justify-start')}>
				<Skeleton className={cn('rounded-bubble h-9', row.width, row.isOwn ? 'rounded-br-md' : 'rounded-bl-md')} />
			</span>
		))}
	</div>
);

export default MessageSkeleton;
