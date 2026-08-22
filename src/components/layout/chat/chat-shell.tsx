'use client';

import ConnectionStatus from '@/components/layout/chat/connection-status';
import GroupDetailsSheet from '@/components/layout/chat/group/group-details-sheet';
import ChatPanel from '@/components/layout/chat/panel';
import Sidebar from '@/components/layout/chat/sidebar';
import Avatar from '@/components/ui/avatar';
import EmptyState from '@/components/ui/empty-state';
import IconButton from '@/components/ui/icon-button';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectActiveConversation } from '@/store/slices/chat-selectors';
import { conversationClosed } from '@/store/slices/chat-slice';
import { conversationSubtitle, conversationTitle } from '@/types/chat';
import { IconArrowLeft, IconMessages, IconUsers } from '@tabler/icons-react';
import { memo, useCallback, useRef, useState } from 'react';

/**
 * The two-pane chat screen.
 *
 * On `lg+` the sidebar is a fixed 320px column beside the panel. Below `lg`
 * only one of the two is mounted-visible at a time: the list *is* the page, and
 * selecting a conversation swaps to the panel with a back control. A Sheet was
 * considered and rejected — on a phone the conversation list is a destination
 * you return to, not an overlay you dismiss. The Sheet is reserved for group
 * details.
 *
 * The panel is `canvas` and the sidebar is `surface`, so the deeper surface is
 * the one holding content. That reads correctly in both themes and gives the
 * message list an edge to sit against without a second border.
 */
const ChatShell = memo(() => {
	const dispatch = useAppDispatch();
	const conversation = useAppSelector(selectActiveConversation);
	const currentUserId = useAppSelector((state) => state.session.user?.id ?? null);
	const token = useAppSelector((state) => state.session.token);
	const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
	const groupDetailsTriggerRef = useRef<HTMLButtonElement>(null);

	const handleBack = useCallback(() => {
		dispatch(conversationClosed());
	}, [dispatch]);

	const hasActive = conversation !== undefined;

	return (
		<div className='flex size-full overflow-hidden'>
			{/* Keyed on the token: a new session builds a clean connection rather than
			    re-authenticating one in place. */}
			{token !== null && <SocketConnection key={token} token={token} />}

			{/* The page's heading. Visually silent because the sidebar's own
			    branding already names the screen, but a page with no `h1` leaves
			    a screen-reader user with nothing to orient on. */}
			<h1 className='sr-only'>Chat</h1>

			<Sidebar className={cn('w-full lg:flex lg:w-80 lg:shrink-0', hasActive ? 'hidden lg:flex' : 'flex')} />

			<section aria-label='Conversation' className={cn('bg-canvas dark:bg-canvas-dark min-w-0 flex-1 flex-col lg:flex', hasActive ? 'flex' : 'hidden lg:flex')}>
				{conversation === undefined ? (
					<EmptyState
						className='flex-1'
						icon={<IconMessages aria-hidden='true' className='size-8' />}
						title='Pick a conversation, or start one'
						description='Choose someone from the list, or search by name or phone number to reach a new person.'
					/>
				) : (
					<>
						<ConnectionStatus />
						<header className='border-border-subtle dark:border-border-subtle-dark bg-surface dark:bg-surface-dark flex shrink-0 items-center gap-3 border-b px-3 py-2.5'>
							<IconButton label='Back to conversations' icon={<IconArrowLeft aria-hidden='true' className='size-5' />} onClick={handleBack} className='lg:hidden' />
							<Avatar name={conversationTitle(conversation)} seed={conversation.type === 'group' ? conversation.id : conversation.participant.id} size='sm' />
							<div className='min-w-0 flex-1'>
								<p className='text-ink dark:text-ink-dark truncate text-sm font-medium'>{conversationTitle(conversation)}</p>
								<p className='text-ink-muted dark:text-ink-muted-dark truncate text-xs'>{conversationSubtitle(conversation)}</p>
							</div>
							{conversation.type === 'group' && (
								<IconButton
									ref={groupDetailsTriggerRef}
									label={`Group details for ${conversation.name}`}
									onClick={() => setGroupDetailsOpen(true)}
									icon={<IconUsers aria-hidden='true' className='size-5' />}
								/>
							)}
						</header>

						{conversation.type === 'group' && <GroupDetailsSheet open={groupDetailsOpen} onOpenChange={setGroupDetailsOpen} conversation={conversation} returnFocusRef={groupDetailsTriggerRef} />}

						{/* Keyed on the conversation so switching threads remounts rather
						    than re-synchronising: history refetches, the scroll anchor
						    starts fresh, and no thread is ever rendered against another's
						    participants. See `no-use-effect` rule 5. */}
						{currentUserId !== null && <ChatPanel key={conversation.id} conversation={conversation} currentUserId={currentUserId} />}
					</>
				)}
			</section>
		</div>
	);
});

/**
 * Holds the socket open for as long as the session does.
 *
 * A component rather than a bare hook call so it can be keyed on the token:
 * a new token remounts this and builds a clean connection, instead of trying to
 * re-authenticate one in place. Renders nothing — the connection is the point.
 */
const SocketConnection = memo(({ token }: { token: string }) => {
	useChatSocket(token);
	return null;
});

SocketConnection.displayName = 'SocketConnection';

ChatShell.displayName = 'ChatShell';

export default ChatShell;
