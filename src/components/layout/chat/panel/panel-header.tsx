'use client';

import Avatar from '@/components/ui/avatar';
import IconButton from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { formatPhoneForDisplay } from '@/lib/utils/phone';
import { conversationParticipants, conversationTitle, type Conversation } from '@/types/chat';
import { IconArrowLeft } from '@tabler/icons-react';
import { memo } from 'react';

/** Beyond this the cluster stops reading as faces and starts reading as noise. */
const MAX_CLUSTER_AVATARS = 3;

type PanelHeaderProps = {
	conversation: Conversation;
	/**
	 * Returns to the conversation list on a narrow layout, where the list and
	 * the panel cannot both be on screen. Omitted on wide layouts, where the
	 * list never left.
	 */
	onBack?: () => void;
	className?: string;
};

/**
 * Who you are talking to, above the log.
 *
 * The subtitle is the second identifier rather than decoration: this API keys
 * identity on a phone number and two people can share a display name, so a
 * direct thread shows the number the account actually belongs to. It is
 * formatted for reading only — the E.164 string is what ever reaches the API.
 */
const PanelHeader = memo(({ conversation, onBack, className }: PanelHeaderProps) => {
	const title = conversationTitle(conversation);
	const participants = conversationParticipants(conversation);
	const subtitle = conversation.type === 'group' ? `${participants.length.toString()} members` : formatPhoneForDisplay(conversation.participant.phone);

	return (
		<header className={cn('border-border-subtle bg-surface dark:border-border-subtle-dark dark:bg-surface-dark flex shrink-0 items-center gap-3 border-b px-3 py-2.5 sm:px-4', className)}>
			{onBack !== undefined && <IconButton label='Back to conversations' icon={<IconArrowLeft className='size-5' />} size='sm' onClick={onBack} className='md:hidden' />}

			{conversation.type === 'group' ? (
				<span className='flex shrink-0 -space-x-2'>
					{participants.slice(0, MAX_CLUSTER_AVATARS).map((participant) => (
						<Avatar key={participant.id} name={participant.name} seed={participant.id} size='sm' className='ring-surface dark:ring-surface-dark ring-2' />
					))}
				</span>
			) : (
				<Avatar name={conversation.participant.name} seed={conversation.participant.id} size='md' />
			)}

			<span className='min-w-0 flex-1'>
				{/* `h2` because the chat screen's `h1` names the screen; the thread is a
				    section within it, and a panel that reset to `h1` would break the
				    heading outline a screen reader navigates by. */}
				<h2 className='font-display text-ink dark:text-ink-dark truncate text-sm font-semibold'>{title}</h2>
				<p className='text-ink-muted dark:text-ink-muted-dark truncate font-mono text-xs'>{subtitle}</p>
			</span>

			{/*
			 * TODO(blocked-on-04): the connection indicator lands here — plan 07 owns
			 * the socket status, and this header is the one place in the panel where
			 * "the live channel is down" belongs.
			 *
			 * TODO(blocked-on-04): group actions (members, add participant) attach on
			 * the trailing edge; plan 08 owns the dialogs they open.
			 */}
		</header>
	);
});

PanelHeader.displayName = 'PanelHeader';

export default PanelHeader;
