'use client';

import Button from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import { IconAlertTriangle } from '@tabler/icons-react';
import { memo } from 'react';

type LeaveGroupDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	groupName: string;
	/** True when the leaver is the group's only administrator. */
	isOnlyAdmin: boolean;
	busy: boolean;
	onConfirm: () => void;
};

/**
 * Confirms leaving, and warns when leaving breaks the group.
 *
 * The warning is the point of this dialog existing at all. This API lets the
 * last admin walk out, and the group is then permanently unmanageable — nobody
 * left can add, remove, or rename. The server will not stop it, so the UI at
 * least says so and offers the fix: promote someone first.
 *
 * Leaving cannot be undone from the client either; rejoining needs an admin.
 * That is stated rather than implied.
 */
const LeaveGroupDialog = memo(({ open, onOpenChange, groupName, isOnlyAdmin, busy, onConfirm }: LeaveGroupDialogProps) => (
	<Dialog
		open={open}
		onOpenChange={onOpenChange}
		title={`Leave ${groupName}?`}
		description='You will stop receiving messages here, and rejoining needs an admin to add you back.'
		footer={
			<>
				<Button variant='secondary' onClick={() => onOpenChange(false)}>
					Stay
				</Button>
				<Button variant='danger' onClick={onConfirm} disabled={busy}>
					{busy ? 'Leaving…' : 'Leave group'}
				</Button>
			</>
		}
	>
		{isOnlyAdmin && (
			<p className='bg-warning/10 text-warning rounded-panel flex items-start gap-2 px-3 py-2.5 text-sm'>
				<IconAlertTriangle aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
				<span>You are the only admin. If you leave, nobody will be able to add members, remove them, or rename this group. Consider making someone else an admin first.</span>
			</p>
		)}
	</Dialog>
));

LeaveGroupDialog.displayName = 'LeaveGroupDialog';

export default LeaveGroupDialog;
