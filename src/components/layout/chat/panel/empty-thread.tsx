import EmptyState from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { IconMessage2 } from '@tabler/icons-react';

type EmptyThreadProps = {
	/** Who the invitation is addressed to — the peer, or the group's name. */
	peerName: string;
	className?: string;
};

/**
 * A conversation that has loaded successfully and contains nothing.
 *
 * Named apart from the loading and error states because it is not a failure:
 * a blank panel reads as broken, so this says whose thread it is and what to do
 * about it.
 */
const EmptyThread = ({ peerName, className }: EmptyThreadProps) => (
	<EmptyState
		icon={<IconMessage2 aria-hidden='true' className='size-7' />}
		title='No messages yet'
		description={`This is the beginning of your conversation with ${peerName}. Say something.`}
		className={cn('h-full', className)}
	/>
);

export default EmptyThread;
