'use client';

import Spinner from '@/components/ui/spinner';
import { memo, useCallback, useRef } from 'react';

type LoadOlderSentinelProps = {
	hasMore: boolean;
	isLoading: boolean;
	onLoadOlder: () => void;
};

/**
 * Asks for the previous page when the top of the history comes into view.
 *
 * An `IntersectionObserver` rather than a scroll listener: the browser reports
 * the one moment that matters instead of the client recomputing a threshold on
 * every frame of a flick.
 *
 * The observer is created in a **callback ref**, so it attaches exactly when the
 * node does and disconnects when it leaves — no mount effect guessing at when
 * the element exists, and no stale observer surviving a conversation switch.
 */
const LoadOlderSentinel = memo(({ hasMore, isLoading, onLoadOlder }: LoadOlderSentinelProps) => {
	const observerRef = useRef<IntersectionObserver | null>(null);

	const attach = useCallback(
		(node: HTMLDivElement | null) => {
			observerRef.current?.disconnect();
			observerRef.current = null;

			if (node === null || !hasMore) {
				return;
			}

			const observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						// Safe to call repeatedly: the thunk's `condition` refuses a
						// second request while one is already in flight.
						onLoadOlder();
					}
				},
				// A little ahead of the edge, so the page is already arriving by the
				// time the reader gets there.
				{ rootMargin: '240px 0px 0px 0px' }
			);
			observer.observe(node);
			observerRef.current = observer;
		},
		[hasMore, onLoadOlder]
	);

	if (!hasMore) {
		return null;
	}

	return (
		<div ref={attach} className='flex justify-center py-3'>
			{isLoading && (
				<>
					<Spinner className='text-ink-muted dark:text-ink-muted-dark' />
					<span role='status' className='sr-only'>
						Loading earlier messages
					</span>
				</>
			)}
		</div>
	);
});

LoadOlderSentinel.displayName = 'LoadOlderSentinel';

export default LoadOlderSentinel;
