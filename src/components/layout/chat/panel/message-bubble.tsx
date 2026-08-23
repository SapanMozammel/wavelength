'use client';

import { cn } from '@/lib/utils';
import { formatFullTimestamp, formatMessageTime, toIsoString } from '@/lib/utils/time';
import type { MessageRunPosition, MessageStatus } from '@/types/chat';
import { memo } from 'react';

/**
 * Corner geometry, as static lookups rather than composed strings.
 *
 * The seam between two bubbles in a run is squared off and the run's outer
 * edges stay round, so a group of messages reads as one block with a tail at
 * the bottom. Which corners those are is the second of the three signals that
 * distinguish sender from receiver — the shape alone says which side a message
 * came from, with no colour involved.
 */
const OWN_CORNERS = {
	single: 'rounded-br-md',
	first: 'rounded-br-md',
	middle: 'rounded-tr-md rounded-br-md',
	last: 'rounded-tr-md rounded-br-md',
} as const satisfies Record<MessageRunPosition, string>;

const OTHER_CORNERS = {
	single: 'rounded-bl-md',
	first: 'rounded-bl-md',
	middle: 'rounded-tl-md rounded-bl-md',
	last: 'rounded-tl-md rounded-bl-md',
} as const satisfies Record<MessageRunPosition, string>;

/**
 * `sent` says nothing a user needs — the message is simply there. The other two
 * are load-bearing: the API never echoes your own message back over the socket,
 * so the local copy is the only evidence a send happened at all.
 */
const STATUS_LABEL = {
	sending: 'Sending',
	sent: null,
	failed: 'Not sent',
} as const satisfies Record<MessageStatus, string | null>;

type MessageBubbleProps = {
	text: string;
	/** Epoch milliseconds. Normalized upstream; never an ISO string here. */
	createdAt: number;
	isOwn: boolean;
	runPosition: MessageRunPosition;
	/** Visible only at a run's end — the `<time>` element itself is always rendered. */
	showTimestamp: boolean;
	status: MessageStatus;
};

/**
 * One message. **Three signals separate sent from received** — alignment
 * (applied by the row), corner geometry, and colour — so the distinction
 * survives a greyscale screenshot and a monochrome display, which colour alone
 * would not.
 *
 * Memoized on primitive props only: a socket arrival rebuilds the row list, and
 * every bubble whose values are unchanged must skip re-rendering, or one new
 * message costs the whole history.
 */
const MessageBubble = memo(({ text, createdAt, isOwn, runPosition, showTimestamp, status }: MessageBubbleProps) => {
	const statusLabel = STATUS_LABEL[status];

	return (
		<>
			<p
				className={cn(
					'rounded-bubble animate-bubble-in max-w-full px-3.5 py-2 text-[0.9375rem] leading-snug wrap-break-word whitespace-pre-wrap',
					isOwn
						? cn('bg-signal-600 dark:bg-signal-500 dark:text-canvas-dark text-white', OWN_CORNERS[runPosition])
						: cn('bg-surface-raised text-ink dark:bg-surface-raised-dark dark:text-ink-dark', OTHER_CORNERS[runPosition])
				)}
			>
				{text}
			</p>

			{/*
			 * Every message keeps its `<time>` even when the run hides it, so a
			 * screen reader and a copy-paste both retain per-message times rather
			 * than one time per group. `sr-only` hides it visually; it is never
			 * dropped from the DOM and never `aria-hidden`.
			 */}
			<p
				className={cn(
					'text-ink-muted dark:text-ink-muted-dark mt-1 flex items-center gap-1.5 px-1 font-mono text-[0.6875rem]',
					!showTimestamp && statusLabel === null && 'sr-only',
					status === 'failed' && 'text-danger-ink dark:text-danger-ink-dark'
				)}
			>
				{/*
				 * `suppressHydrationWarning` is correct here rather than a patch.
				 * Both the text and the `title` are formatted in the reader's own
				 * locale and timezone, so the server — which has neither — cannot
				 * produce the same string, and should not: a chat that shows times
				 * in the server's timezone is wrong for everyone reading it. The
				 * client value is the right one, and React is told to let it win.
				 * `dateTime` stays machine-readable UTC and matches on both sides.
				 */}
				<time dateTime={toIsoString(createdAt)} title={formatFullTimestamp(createdAt)} suppressHydrationWarning>
					{formatMessageTime(createdAt)}
				</time>
				{statusLabel !== null && <span>· {statusLabel}</span>}
			</p>
		</>
	);
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
