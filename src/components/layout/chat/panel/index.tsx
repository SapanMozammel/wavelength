'use client';

import Composer from '@/components/layout/chat/panel/composer';
import MessageList from '@/components/layout/chat/panel/message-list';
import { conversationTitle, type Conversation } from '@/types/chat';
import { memo } from 'react';

type ChatPanelProps = {
	conversation: Conversation;
	currentUserId: string;
};

/**
 * The message region: history above, composer below.
 *
 * `min-h-0` on the list is mandatory, not stylistic. A flex child defaults to
 * `min-height: auto`, which refuses to shrink below its content — so without it
 * the list grows past the viewport and the whole page scrolls instead of the
 * list, taking the composer off screen with it.
 */
const ChatPanel = memo(({ conversation, currentUserId }: ChatPanelProps) => (
	<>
		<MessageList conversation={conversation} currentUserId={currentUserId} className='min-h-0 flex-1' />
		<Composer conversationId={conversation.id} conversationName={conversationTitle(conversation)} />
	</>
));

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;
