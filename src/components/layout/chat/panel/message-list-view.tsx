'use client';

import DaySeparator from '@/components/layout/chat/panel/day-separator';
import EmptyThread from '@/components/layout/chat/panel/empty-thread';
import MessageRow from '@/components/layout/chat/panel/message-row';
import MessageSkeleton from '@/components/layout/chat/panel/message-skeleton';
import Button from '@/components/ui/button';
import ErrorState from '@/components/ui/error-state';
import Spinner from '@/components/ui/spinner';
import type { Row } from '@/lib/chat/build-rows';
import { cn } from '@/lib/utils';
import type { AsyncStatus } from '@/types/chat';
import { memo, type ReactNode, type Ref } from 'react';

export type MessageListViewProps = {
	/**
	 * The rendered sequence, already built by `buildRows`.
	 *
	 * Passed in rather than derived here, which is what keeps this component
	 * purely presentational: it imports no store, no `useThread`, and no
	 * selector, so the landing page can render a scripted transcript through the
	 * product's own message geometry without pulling chat state into its bundle.
	 */
	rows: readonly Row[];
	/** Completes the log's accessible name: "Messages in <name>". */
	conversationName: string;
	/** Who the empty state addresses its invitation to. */
	peerName: string;
	/** Initial-load lifecycle. */
	status: AsyncStatus;
	/**
	 * The older-page lifecycle, tracked apart from `status` on purpose: a failed
	 * page-up must never blank the history the reader already has on screen.
	 */
	olderStatus: AsyncStatus;
	/** Whether an older page exists. Drives the start-of-conversation marker. */
	hasMore: boolean;
	/** User-facing copy for an initial-load failure. Never a raw API message. */
	error: string | null;
	/**
	 * The clock day separators are formatted against. Pass a value that is
	 * stable for the lifetime of the mount — reading `Date.now()` per render
	 * makes "Today" a moving target and, on a prerendered page, a mismatch.
	 */
	now: number;
	/** Retry for the initial-load failure. */
	onReload?: () => void;
	/** Retry for a failed older page. */
	onLoadOlder?: () => void;
	/**
	 * Rendered above the first row.
	 *
	 * TODO(blocked-on-04): the `LoadOlderSentinel` (step 8) mounts here. It is a
	 * slot rather than a built-in so this component owns no `IntersectionObserver`
	 * and stays renderable from a Server Component.
	 */
	topSlot?: ReactNode;
	/**
	 * The scroll container itself.
	 *
	 * TODO(blocked-on-04): `use-scroll-anchor` (step 8) attaches here to measure
	 * `scrollHeight` before and after an older page is prepended. Scroll position
	 * is deliberately not state — it lives in refs, outside React's render path.
	 */
	scrollRef?: Ref<HTMLDivElement>;
	className?: string;
};

/**
 * The conversation history, and nothing else.
 *
 * **Presentational by contract.** Everything it renders arrives as a prop, so
 * it has exactly two consumers with no shared dependency: the store-connected
 * `MessageList` container, and the landing page's scripted replay. A component
 * that reached for `useThread` here would be unusable from the second.
 *
 * The container is `role="log"` with `aria-live="polite"` — **polite, never
 * assertive**. Assertive interrupts a screen-reader user mid-sentence, which in
 * a chat means every arriving message talks over the message being read.
 */
const MessageListView = memo(({ rows, conversationName, peerName, status, olderStatus, hasMore, error, now, onReload, onLoadOlder, topSlot, scrollRef, className }: MessageListViewProps) => {
	const hasRows = rows.length > 0;

	return (
		<div
			ref={scrollRef}
			role='log'
			aria-live='polite'
			aria-relevant='additions'
			aria-busy={status === 'loading'}
			aria-label={`Messages in ${conversationName}`}
			tabIndex={0}
			className={cn('scrollbar-subtle bg-canvas dark:bg-canvas-dark flex flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6', className)}
		>
			{hasRows ? (
				<>
					{topSlot}

					{olderStatus === 'loading' && (
						<p role='status' className='text-ink-muted dark:text-ink-muted-dark flex items-center justify-center gap-2 py-2 font-mono text-[0.6875rem] tracking-wider uppercase'>
							<Spinner className='size-3' />
							Loading earlier messages
						</p>
					)}

					{/*
					 * A strip, not a replacement. Losing a page-up is annoying;
					 * discarding the history already on screen because of it is the
					 * failure mode worth engineering against.
					 */}
					{olderStatus === 'error' && (
						<div
							role='alert'
							className='border-border-subtle bg-surface-raised dark:border-border-subtle-dark dark:bg-surface-raised-dark mb-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2'
						>
							<p className='text-ink-muted dark:text-ink-muted-dark text-xs'>Couldn't load earlier messages.</p>
							{onLoadOlder !== undefined && (
								<Button variant='secondary' size='sm' onClick={onLoadOlder}>
									Retry
								</Button>
							)}
						</div>
					)}

					{!hasMore && olderStatus !== 'loading' && <p className='text-ink-muted dark:text-ink-muted-dark py-2 text-center font-mono text-[0.625rem] tracking-[0.24em] uppercase'>Beginning of conversation</p>}

					{/* `mt-auto` keeps a short thread resting on the composer instead of
					    floating at the top of an otherwise empty panel. */}
					<div className='mt-auto flex w-full flex-col'>
						{rows.map((row) =>
							row.kind === 'day' ? (
								<DaySeparator key={row.key} at={row.at} now={now} />
							) : (
								<MessageRow
									key={row.key}
									text={row.message.text}
									createdAt={row.message.createdAt}
									status={row.message.status}
									isOwn={row.isOwn}
									senderId={row.message.senderId}
									senderName={row.senderName}
									showSender={row.showSender}
									showTimestamp={row.showTimestamp}
									runPosition={row.runPosition}
								/>
							)
						)}
					</div>
				</>
			) : (
				<div className='m-auto w-full'>
					{status === 'loading' || status === 'idle' ? (
						<MessageSkeleton />
					) : status === 'error' ? (
						<ErrorState title="Couldn't load this conversation" {...(error === null ? {} : { description: error })} {...(onReload === undefined ? {} : { onRetry: onReload })} />
					) : (
						<EmptyThread peerName={peerName} />
					)}
				</div>
			)}
		</div>
	);
});

MessageListView.displayName = 'MessageListView';

export default MessageListView;
