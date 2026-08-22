'use client';

import AddMembersDialog from '@/components/layout/chat/group/add-members-dialog';
import LeaveGroupDialog from '@/components/layout/chat/group/leave-group-dialog';
import ParticipantRow from '@/components/layout/chat/group/participant-row';
import RenameGroupField from '@/components/layout/chat/group/rename-group-field';
import Button from '@/components/ui/button';
import Separator from '@/components/ui/separator';
import Sheet from '@/components/ui/sheet';
import { useGroupActions } from '@/hooks/use-group-actions';
import { useAppSelector } from '@/store/hooks';
import type { GroupConversation } from '@/types/chat';
import { IconLogout, IconUserPlus } from '@tabler/icons-react';
import { memo, useState, type RefObject } from 'react';

type GroupDetailsSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	conversation: GroupConversation;
	/** The control that opened this, so closing returns focus there. */
	returnFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Everything about a group, in one overlay.
 *
 * Admin-only controls are **not rendered** for non-admins, rather than shown and
 * failing with a 403 after the fact. The server's authorization is correct and
 * still handled — a user can be demoted while this sheet is open — but it is the
 * fallback, not the mechanism.
 *
 * A Sheet is the right shape here, unlike the conversation list on mobile: this
 * genuinely overlays the conversation you are reading and returns you to it,
 * whereas the list is a destination you navigate to.
 */
const GroupDetailsSheet = memo(({ open, onOpenChange, conversation, returnFocusRef }: GroupDetailsSheetProps) => {
	const currentUserId = useAppSelector((state) => state.session.user?.id ?? null);
	const { isAdmin, pending, error, addMembers, removeMember, promote, rename, leave } = useGroupActions(conversation);
	const [addOpen, setAddOpen] = useState(false);
	const [leaveOpen, setLeaveOpen] = useState(false);

	const memberIds = conversation.participants.map((participant) => participant.id);
	const isOnlyAdmin = isAdmin && conversation.adminIds.length === 1;

	const handleLeave = async () => {
		const ok = await leave();
		if (ok) {
			setLeaveOpen(false);
			onOpenChange(false);
		}
	};

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange} title={conversation.name} {...(returnFocusRef === undefined ? {} : { returnFocusRef })}>
				<div className='flex flex-col gap-5'>
					{error !== null && (
						<p role='alert' className='text-danger-ink dark:text-danger-ink-dark bg-danger/10 rounded-panel px-3 py-2.5 text-sm'>
							{error}
						</p>
					)}

					{isAdmin ? (
						<RenameGroupField name={conversation.name} busy={pending?.kind === 'rename'} onRename={rename} />
					) : (
						<p className='text-ink-muted dark:text-ink-muted-dark text-sm'>Only admins can rename this group or manage who is in it.</p>
					)}

					<Separator />

					<section className='flex flex-col gap-1'>
						<div className='flex items-center justify-between gap-3'>
							<h3 className='text-ink dark:text-ink-dark text-sm font-medium'>
								{conversation.participants.length} {conversation.participants.length === 1 ? 'member' : 'members'}
							</h3>
							{isAdmin && (
								<Button variant='secondary' size='sm' onClick={() => setAddOpen(true)} disabled={pending !== null}>
									<IconUserPlus aria-hidden='true' className='size-4' />
									Add
								</Button>
							)}
						</div>

						<ul className='flex flex-col'>
							{conversation.participants.map((participant) => (
								<ParticipantRow
									key={participant.id}
									user={participant}
									isAdmin={conversation.adminIds.includes(participant.id)}
									isSelf={participant.id === currentUserId}
									canManage={isAdmin}
									busy={pending?.userId === participant.id}
									onPromote={promote}
									onRemove={removeMember}
								/>
							))}
						</ul>
						{/* Promotion is one-way: this API exposes no demote endpoint, so
						    saying so beats offering a control that cannot exist. */}
						{isAdmin && <p className='text-ink-muted dark:text-ink-muted-dark mt-1 text-xs'>Admins cannot be removed as admins.</p>}
					</section>

					<Separator />

					<Button variant='ghost' onClick={() => setLeaveOpen(true)} disabled={pending !== null} className='text-danger-ink dark:text-danger-ink-dark justify-start'>
						<IconLogout aria-hidden='true' className='size-4' />
						Leave group
					</Button>
				</div>
			</Sheet>

			<AddMembersDialog open={addOpen} onOpenChange={setAddOpen} groupName={conversation.name} existingIds={memberIds} busy={pending?.kind === 'add'} onAdd={addMembers} />

			<LeaveGroupDialog open={leaveOpen} onOpenChange={setLeaveOpen} groupName={conversation.name} isOnlyAdmin={isOnlyAdmin} busy={pending?.kind === 'leave'} onConfirm={handleLeave} />
		</>
	);
});

GroupDetailsSheet.displayName = 'GroupDetailsSheet';

export default GroupDetailsSheet;
