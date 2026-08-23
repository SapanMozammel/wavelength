import { cn } from '@/lib/utils';

type SkeletonProps = {
	className?: string;
};

/**
 * A loading placeholder. Always `aria-hidden` — a screen reader gains nothing
 * from a wall of empty boxes, so the surrounding surface is responsible for
 * pairing this with a `role="status"` sibling that says what is loading.
 */
const Skeleton = ({ className }: SkeletonProps) => <div aria-hidden='true' className={cn('bg-surface-raised dark:bg-surface-raised-dark animate-pulse rounded-md', className)} />;

export default Skeleton;
