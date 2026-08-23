'use client';

import Avatar from '@/components/ui/avatar';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Dialog from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import Input from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { useUserSearch } from '@/hooks/use-user-search';
import { formatPhoneForDisplay } from '@/lib/utils/phone';
import type { User } from '@/types/chat';
import { memo, useMemo, useState } from 'react';

type AddMembersDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	groupName: string;
	/** Everyone already in the group, so they are not offered twice. */
	existingIds: readonly string[];
	busy: boolean;
	onAdd: (userIds: string[]) => Promise<boolean>;
};

/**
 * Adds people to an existing group.
 *
 * Reuses `useUserSearch`, so the two documented search faults stay solved in one
 * place: a blank query never reaches the server (it would return the entire user
 * directory), and regex metacharacters are stripped before they crash the
 * endpoint with a 500.
 *
 * Current members are filtered out of results rather than shown and rejected —
 * offering an action that cannot succeed is worse than not offering it.
 */
const AddMembersDialog = memo(({ open, onOpenChange, groupName, existingIds, busy, onAdd }: AddMembersDialogProps) => {
	const { query, isBlank, results, status, error, onQueryChange, clear, retry } = useUserSearch();
	const [selected, setSelected] = useState<User[]>([]);

	const selectable = useMemo(() => results.filter((user) => !existingIds.includes(user.id)), [results, existingIds]);
	const selectedIds = useMemo(() => new Set(selected.map((user) => user.id)), [selected]);

	const toggle = (user: User) => {
		setSelected((current) => (current.some((candidate) => candidate.id === user.id) ? current.filter((candidate) => candidate.id !== user.id) : [...current, user]));
	};

	const submit = async () => {
		if (selected.length === 0) {
			return;
		}
		const ok = await onAdd(selected.map((user) => user.id));
		if (ok) {
			setSelected([]);
			clear();
			onOpenChange(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={`Add people to ${groupName}`}
			footer={
				<>
					<Button variant='secondary' onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={submit} disabled={selected.length === 0 || busy}>
						{busy ? 'Adding…' : selected.length === 0 ? 'Add' : `Add ${selected.length.toString()}`}
					</Button>
				</>
			}
		>
			<div className='flex flex-col gap-3'>
				<Input value={query} onChange={(event) => onQueryChange(event.target.value)} type='search' placeholder='Search by name or phone number' aria-label='Search people to add' />

				<div aria-live='polite' className='sr-only'>
					{status === 'ready' ? `${selectable.length.toString()} people found` : ''}
				</div>

				{status === 'loading' && (
					<p className='text-ink-muted dark:text-ink-muted-dark flex items-center gap-2 py-4 text-sm'>
						<Spinner /> Searching
					</p>
				)}

				{status === 'error' && (
					<p role='alert' className='text-danger-ink dark:text-danger-ink-dark text-sm'>
						{error ?? 'Search failed.'}{' '}
						<button type='button' onClick={retry} className='underline underline-offset-2'>
							Try again
						</button>
					</p>
				)}

				{status === 'ready' && !isBlank && selectable.length === 0 && <EmptyState title='Nobody new to add' description='Everyone matching that search is already in this group.' />}

				<ul className='flex flex-col'>
					{selectable.map((user) => (
						<li key={user.id}>
							<label className='hover:bg-surface-raised dark:hover:bg-surface-raised-dark flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2'>
								<Checkbox checked={selectedIds.has(user.id)} onCheckedChange={() => toggle(user)} />
								<Avatar name={user.name} seed={user.id} size='sm' />
								<span className='min-w-0 flex-1'>
									<span className='text-ink dark:text-ink-dark block truncate text-sm font-medium'>{user.name}</span>
									<span className='text-ink-muted dark:text-ink-muted-dark block truncate font-mono text-xs'>{formatPhoneForDisplay(user.phone)}</span>
								</span>
							</label>
						</li>
					))}
				</ul>
			</div>
		</Dialog>
	);
});

AddMembersDialog.displayName = 'AddMembersDialog';

export default AddMembersDialog;
