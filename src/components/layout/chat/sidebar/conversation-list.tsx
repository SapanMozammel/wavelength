'use client';

import ConversationListSkeleton from '@/components/layout/chat/sidebar/conversation-list-skeleton';
import ConversationRow, { NO_MESSAGES_LABEL } from '@/components/layout/chat/sidebar/conversation-row';
import Button from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import ScrollArea from '@/components/ui/scroll-area';
import { useConversations } from '@/hooks/use-conversations';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectActiveConversationId } from '@/store/slices/chat-selectors';
import { conversationOpened } from '@/store/slices/chat-slice';
import { conversationSubtitle, conversationTitle, type Conversation } from '@/types/chat';
import { IconMessage2 } from '@tabler/icons-react';
import { memo, useCallback } from 'react';

type ConversationListProps = {
	className?: string;
};

/**
 * The four states a fetched list can be in, all of them designed rather than
 * defaulted: loading, empty, error, and ready.
 *
 * The error case is split on purpose. A failure with nothing on screen is a
 * full `ErrorState`; a failure with rows already loaded is a strip above them,
 * because throwing away conversations the user can already see in order to
 * show a retry button is a worse outcome than the failure itself.
 */

/** Avatar tone is keyed on the peer for a direct chat and the group itself for a group. */
const avatarSeed = (conversation: Conversation): string => (conversation.type === 'group' ? conversation.id : conversation.participant.id);

/** The server can return an unparseable date; `Date.parse` yields `NaN` and `<time>` must not render it. */
const safeTimestamp = (value: number): number | null => (Number.isFinite(value) ? value : null);

const ConversationList = memo(({ className }: ConversationListProps) => {
	const dispatch = useAppDispatch();
	const { conversations, status, error, reload } = useConversations();
	const activeId = useAppSelector(selectActiveConversationId);
	const unread = useAppSelector((state) => state.chat.unread);

	// One stable callback for every row, so a change in one conversation does
	// not invalidate `memo` on the other seventy-nine.
	const onSelect = useCallback(
		(id: string) => {
			dispatch(conversationOpened(id));
		},
		[dispatch]
	);

	if (conversations.length === 0) {
		if (status === 'loading' || status === 'idle') {
			return (
				<div className={cn('min-h-0 flex-1', className)}>
					<p role='status' aria-live='polite' className='sr-only'>
						Loading your conversations
					</p>
					<ConversationListSkeleton />
				</div>
			);
		}

		if (status === 'error') {
			return <ErrorState className={cn('min-h-0 flex-1', className)} title='Could not load your conversations' {...(error === null ? {} : { description: error })} onRetry={reload} />;
		}

		return (
			<EmptyState
				className={cn('min-h-0 flex-1', className)}
				icon={<IconMessage2 aria-hidden='true' className='size-7' />}
				title='No conversations yet'
				description='Search for someone by name or phone number to start your first conversation.'
			/>
		);
	}

	return (
		<ScrollArea className={cn('min-h-0 flex-1', className)}>
			{status === 'error' && (
				<div role='alert' className='border-danger/40 bg-danger/10 m-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2'>
					<p className='text-danger-ink dark:text-danger-ink-dark text-xs text-pretty'>{error ?? 'Could not refresh your conversations.'}</p>
					<Button variant='secondary' size='sm' onClick={reload}>
						Retry
					</Button>
				</div>
			)}
			<ul role='list' className='flex flex-col py-1'>
				{conversations.map((conversation) => (
					<ConversationRow
						key={conversation.id}
						id={conversation.id}
						title={conversationTitle(conversation)}
						subtitle={conversationSubtitle(conversation)}
						preview={conversation.lastMessage?.text ?? NO_MESSAGES_LABEL}
						timestamp={safeTimestamp(conversation.updatedAt)}
						unreadCount={unread[conversation.id] ?? 0}
						isSelected={conversation.id === activeId}
						avatarSeed={avatarSeed(conversation)}
						onSelect={onSelect}
					/>
				))}
			</ul>
		</ScrollArea>
	);
});

ConversationList.displayName = 'ConversationList';

export default ConversationList;
