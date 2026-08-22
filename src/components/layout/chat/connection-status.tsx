'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { selectSocketStatus } from '@/store/slices/chat-selectors';
import { IconAlertTriangle, IconWifiOff } from '@tabler/icons-react';
import { memo } from 'react';

/**
 * Says what the connection is doing, but only when that is worth saying.
 *
 * `connected` renders nothing. A banner that appears on every load to announce
 * that everything is fine trains people to ignore the one that matters, and by
 * the time it has real news nobody is reading it.
 *
 * Being offline outranks anything the socket reports: "you're offline" is
 * actionable, "reconnecting" is not, and a user in a tunnel should not be told
 * the server is struggling.
 *
 * Never colour alone — each state carries an icon and words.
 */
const ConnectionStatus = memo(({ className }: { className?: string }) => {
	const socketStatus = useAppSelector(selectSocketStatus);
	const isOnline = useOnlineStatus();

	if (!isOnline) {
		return (
			<p role='status' className={cn('bg-danger/10 text-danger-ink dark:text-danger-ink-dark flex items-center justify-center gap-2 px-3 py-1.5 text-xs', className)}>
				<IconWifiOff aria-hidden='true' className='size-3.5' />
				You're offline. Messages will send once you're back.
			</p>
		);
	}

	if (socketStatus === 'reconnecting' || socketStatus === 'disconnected') {
		return (
			<p role='status' className={cn('bg-warning/10 text-warning flex items-center justify-center gap-2 px-3 py-1.5 text-xs', className)}>
				<IconAlertTriangle aria-hidden='true' className='size-3.5' />
				Reconnecting…
			</p>
		);
	}

	return null;
});

ConnectionStatus.displayName = 'ConnectionStatus';

export default ConnectionStatus;
