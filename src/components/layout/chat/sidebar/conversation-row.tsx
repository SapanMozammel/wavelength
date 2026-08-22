'use client';

import Avatar from '@/components/ui/avatar';
import Badge from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeStamp, toIsoString } from '@/lib/utils/time';
import { memo, useCallback } from 'react';

/** What a conversation with no messages shows instead of a blank line. */
export const NO_MESSAGES_LABEL = 'No messages yet';

type ConversationRowProps = {
	id: string;
	/** `conversationTitle()` output — the peer's name, or the group's. */
	title: string;
	/** `conversationSubtitle()` output — the peer's phone, or "N members". */
	subtitle: string;
	/** The last message's text, or `NO_MESSAGES_LABEL`. */
	preview: string;
	/** Epoch ms, or `null` when the server sent something unparseable. */
	timestamp: number | null;
	unreadCount: number;
	isSelected: boolean;
	/** Stable identity for the avatar tone — the peer's id, or the group's. */
	avatarSeed: string;
	onSelect: (id: string) => void;
};

/**
 * One row in the sidebar.
 *
 * Takes primitives rather than a `Conversation` so `memo` actually earns its
 * keep: a socket arrival changes one conversation, and only the row whose
 * props moved re-renders. It also means the row never sees the union, so it
 * cannot read `participants` off a direct conversation — the classic crash on
 * this API, since a direct row simply does not have that field.
 *
 * Selection is carried by three signals, never colour alone: a tinted fill, a
 * left rail, and `aria-current`.
 */
const ConversationRow = memo(({ id, title, subtitle, preview, timestamp, unreadCount, isSelected, avatarSeed, onSelect }: ConversationRowProps) => {
	const handleClick = useCallback(() => {
		onSelect(id);
	}, [onSelect, id]);

	return (
		<li>
			<button
				type='button'
				onClick={handleClick}
				aria-current={isSelected ? 'true' : undefined}
				className={cn(
					'flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors duration-150',
					isSelected ? 'border-signal-500 bg-signal-50 dark:bg-signal-900/40' : 'hover:bg-surface-raised dark:hover:bg-surface-raised-dark border-transparent'
				)}
			>
				<Avatar name={title} seed={avatarSeed} />
				<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
					<span className='flex items-baseline justify-between gap-2'>
						<span className='text-ink dark:text-ink-dark truncate text-sm font-medium'>{title}</span>
						{timestamp !== null && (
							<time dateTime={toIsoString(timestamp)} className='text-ink-muted dark:text-ink-muted-dark shrink-0 font-mono text-xs'>
								{formatRelativeStamp(timestamp)}
							</time>
						)}
					</span>
					<span className='flex items-center justify-between gap-2'>
						<span className='text-ink-muted dark:text-ink-muted-dark truncate text-sm'>{preview}</span>
						{unreadCount > 0 && (
							<Badge variant='pulse' size='sm' srLabel={`${String(unreadCount)} unread ${unreadCount === 1 ? 'message' : 'messages'}`}>
								{unreadCount}
							</Badge>
						)}
					</span>
					{/* Two people can share a display name; the number is what tells
					    them apart, and it costs a screen-reader user nothing to hear it. */}
					<span className='sr-only'>{subtitle}</span>
				</span>
			</button>
		</li>
	);
});

ConversationRow.displayName = 'ConversationRow';

export default ConversationRow;
