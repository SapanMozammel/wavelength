'use client';

import LoadOlderSentinel from '@/components/layout/chat/panel/load-older-sentinel';
import MessageListView from '@/components/layout/chat/panel/message-list-view';
import { useScrollAnchor } from '@/hooks/use-scroll-anchor';
import { useThread } from '@/hooks/use-thread';
import { buildRows } from '@/lib/chat/build-rows';
import { conversationParticipants, conversationTitle, type Conversation } from '@/types/chat';
import { memo, useMemo } from 'react';

type MessageListProps = {
	conversation: Conversation;
	currentUserId: string;
	className?: string;
};

/**
 * The store-connected message list.
 *
 * Mounted with `key={conversation.id}` by the panel, which is what makes the
 * rest of this simple: switching conversations remounts rather than
 * re-synchronising, so `useThread`'s mount fetch runs for the new thread, the
 * scroll anchor starts fresh, and there is no window in which one thread's
 * history is rendered against another's participants.
 *
 * Rows are derived during render, never stored. One `useMemo` over the messages
 * produces day breaks, run geometry and sender identity together; `memo` on the
 * row components keeps an arriving message to a single row's worth of DOM work.
 */
const MessageList = memo(({ conversation, currentUserId, className }: MessageListProps) => {
	const { messages, status, olderStatus, hasMore, error, loadOlder, reload } = useThread(conversation.id);

	const participants = useMemo(() => conversationParticipants(conversation), [conversation]);
	const rows = useMemo(
		// A direct thread never labels its runs: the only other name in the room
		// is already in the panel header, so repeating it on every bubble is noise.
		() => buildRows({ messages, participants, currentUserId, showSenderNames: conversation.type === 'group' }),
		[messages, participants, currentUserId, conversation.type]
	);

	/**
	 * A mount-stable clock. `Date.now()` per render would make "Today" a moving
	 * target, and on a prerendered page a server/client mismatch.
	 */
	const now = useMemo(() => Date.now(), []);

	const topRowKey = rows.at(0)?.key ?? null;
	const { scrollRef } = useScrollAnchor(topRowKey, rows.length);

	const peerName = conversation.type === 'direct' ? conversation.participant.name : conversationTitle(conversation);

	return (
		<MessageListView
			rows={rows}
			conversationName={conversationTitle(conversation)}
			peerName={peerName}
			status={status}
			olderStatus={olderStatus}
			hasMore={hasMore}
			error={error}
			now={now}
			onReload={reload}
			onLoadOlder={loadOlder}
			scrollRef={scrollRef}
			topSlot={<LoadOlderSentinel hasMore={hasMore} isLoading={olderStatus === 'loading'} onLoadOlder={loadOlder} />}
			{...(className === undefined ? {} : { className })}
		/>
	);
});

MessageList.displayName = 'MessageList';

export default MessageList;
