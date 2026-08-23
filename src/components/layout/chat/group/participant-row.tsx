'use client';

import AdminBadge from '@/components/layout/chat/group/admin-badge';
import Avatar from '@/components/ui/avatar';
import DropdownMenu, { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import IconButton from '@/components/ui/icon-button';
import { formatPhoneForDisplay } from '@/lib/utils/phone';
import type { User } from '@/types/chat';
import { IconDotsVertical } from '@tabler/icons-react';
import { memo } from 'react';

type ParticipantRowProps = {
	user: User;
	isAdmin: boolean;
	isSelf: boolean;
	/** Whether the *viewer* may administer this group. */
	canManage: boolean;
	busy: boolean;
	onPromote: (userId: string) => void;
	onRemove: (userId: string) => void;
};

/**
 * One member of a group.
 *
 * Row actions name the person they act on — "Remove Grace Hopper from the
 * group", never a bare "Remove". A menu full of identical labels is unusable
 * with a screen reader, and it is exactly the case where removing the wrong
 * person is easy.
 *
 * Promotion is one-way because the API has no demote endpoint; the menu says so
 * rather than offering a control that cannot exist.
 */
const ParticipantRow = memo(({ user, isAdmin, isSelf, canManage, busy, onPromote, onRemove }: ParticipantRowProps) => {
	// Nothing to manage about yourself here — leaving is its own, louder action.
	const showMenu = canManage && !isSelf;

	return (
		<li className='flex items-center gap-3 py-2'>
			<Avatar name={user.name} seed={user.id} size='sm' />
			<div className='min-w-0 flex-1'>
				<p className='text-ink dark:text-ink-dark flex items-center gap-1.5 truncate text-sm font-medium'>
					{user.name}
					{isSelf && <span className='text-ink-muted dark:text-ink-muted-dark text-xs font-normal'>(you)</span>}
					{isAdmin && <AdminBadge />}
				</p>
				<p className='text-ink-muted dark:text-ink-muted-dark truncate font-mono text-xs'>{formatPhoneForDisplay(user.phone)}</p>
			</div>

			{showMenu && (
				<DropdownMenu trigger={<IconButton label={`Manage ${user.name}`} size='sm' disabled={busy} icon={<IconDotsVertical aria-hidden='true' className='size-4' />} />}>
					{!isAdmin && <DropdownMenuItem onSelect={() => onPromote(user.id)}>Make {user.name} an admin</DropdownMenuItem>}
					<DropdownMenuItem tone='danger' onSelect={() => onRemove(user.id)}>
						Remove {user.name} from the group
					</DropdownMenuItem>
				</DropdownMenu>
			)}
		</li>
	);
});

ParticipantRow.displayName = 'ParticipantRow';

export default ParticipantRow;
