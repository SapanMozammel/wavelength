'use client';

import MessageBubble from '@/components/layout/chat/panel/message-bubble';
import Avatar from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MessageRunPosition, MessageStatus } from '@/types/chat';
import { memo } from 'react';

/** The name a screen reader hears for the session user's own messages. */
const OWN_SPEAKER = 'You';

const isRunStart = (runPosition: MessageRunPosition): boolean => runPosition === 'first' || runPosition === 'single';
const isRunEnd = (runPosition: MessageRunPosition): boolean => runPosition === 'last' || runPosition === 'single';

type MessageRowProps = {
	text: string;
	/** Epoch milliseconds. */
	createdAt: number;
	status: MessageStatus;
	isOwn: boolean;
	/** Stable identity for the avatar's tone — the id, not the name, which can change. */
	senderId: string;
	/** Already resolved, and never blank: a departed member arrives here named. */
	senderName: string;
	showSender: boolean;
	showTimestamp: boolean;
	runPosition: MessageRunPosition;
};

/**
 * One row of the log: avatar gutter, optional sender name, and the bubble.
 *
 * **Every prop is a primitive.** `buildRows` produces fresh row objects on every
 * socket arrival, so a component memoized on the row object would re-render the
 * entire history for one new message. Memoized on primitives, an arrival
 * re-renders exactly the row that changed.
 *
 * The accessible name carries what alignment carries visually: sighted users
 * read "this is on the right, so it is mine", and a screen-reader user hears
 * "You, 14:32: …". Without it the log is a stream of anonymous sentences.
 */
const MessageRow = memo(({ text, createdAt, status, isOwn, senderId, senderName, showSender, showTimestamp, runPosition }: MessageRowProps) => {
	const speaker = isOwn ? OWN_SPEAKER : senderName;

	return (
		<article
			// The time is deliberately absent from this name. The `<time>` element
			// inside carries it — present on every message, `sr-only` when a run
			// hides it visually — so repeating it here made a linear-browsing
			// screen-reader user hear the timestamp twice. It also cannot be
			// server-rendered safely: the value is locale- and timezone-dependent,
			// so an attribute built from it disagrees between server and client.
			aria-label={`${speaker}: ${text}`}
			className={cn('flex w-full items-end gap-2 first:mt-0', isOwn ? 'justify-end' : 'justify-start', isRunStart(runPosition) ? 'mt-3' : 'mt-0.5')}
		>
			{/*
			 * The gutter is reserved on every received row, not only the one that
			 * shows a face — an avatar that appears mid-run without a placeholder
			 * shifts the whole run sideways by its own width.
			 */}
			{!isOwn && (isRunEnd(runPosition) ? <Avatar size='sm' name={senderName} seed={senderId} /> : <span aria-hidden='true' className='size-8 shrink-0' />)}

			<div className={cn('flex max-w-[75%] min-w-0 flex-col sm:max-w-[65%]', isOwn ? 'items-end' : 'items-start')}>
				{showSender && <span className='text-ink-muted dark:text-ink-muted-dark mb-0.5 px-1 text-xs font-medium'>{senderName}</span>}
				<MessageBubble text={text} createdAt={createdAt} isOwn={isOwn} runPosition={runPosition} showTimestamp={showTimestamp} status={status} />
			</div>
		</article>
	);
});

MessageRow.displayName = 'MessageRow';

export default MessageRow;
