'use client';

import ParticipantChip from '@/components/layout/chat/sidebar/participant-chip';
import SearchResultRow from '@/components/layout/chat/sidebar/search-result-row';
import Button from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import Input from '@/components/ui/input';
import Label from '@/components/ui/label';
import Spinner from '@/components/ui/spinner';
import { useUserSearch } from '@/hooks/use-user-search';
import { useAppDispatch } from '@/store/hooks';
import { createGroupConversation } from '@/store/slices/chat-slice';
import type { User } from '@/types/chat';
import { memo, useCallback, useState, type ChangeEvent } from 'react';

/**
 * The API rejects a group with fewer than three members, counting the creator
 * — so two others is the real floor, and it is enforced here rather than
 * discovered from a 400. A disabled button that says *why* beats a round trip
 * that returns a server-worded error about a rule the user never saw.
 */
const MIN_OTHERS = 2;
const NAME_MAX_LENGTH = 60;

const NAME_FIELD_ID = 'group-name';
const SEARCH_FIELD_ID = 'group-member-search';
const REASON_ID = 'group-submit-reason';

type NewGroupDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * Create a group.
 *
 * Mounted only while open (see `SidebarHeader`), so an abandoned draft resets
 * by unmounting rather than by an effect watching `open` — `no-use-effect`
 * Rule 5, applied through the mount boundary instead of a `key`.
 */
const NewGroupDialog = memo(({ open, onOpenChange }: NewGroupDialogProps) => {
	const dispatch = useAppDispatch();
	const { query, isBlank, results, status, error, isSelfMatch, onQueryChange, retry } = useUserSearch();

	const [name, setName] = useState('');
	const [selected, setSelected] = useState<readonly User[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const trimmedName = name.trim();
	// Derived, not stored: a `canSubmit` state would need syncing on every
	// keystroke and every selection, and could disagree with what is on screen.
	const reason = trimmedName === '' ? 'Give the group a name.' : selected.length < MIN_OTHERS ? 'Pick at least 2 people. A group needs three members, including you.' : null;

	const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);

	const handleSearchChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onQueryChange(event.target.value);
		},
		[onQueryChange]
	);

	const handleToggle = useCallback(
		(id: string) => {
			const found = results.find((user) => user.id === id);
			setSelected((current) => {
				if (current.some((user) => user.id === id)) {
					return current.filter((user) => user.id !== id);
				}
				return found === undefined ? current : [...current, found];
			});
		},
		[results]
	);

	const handleRemove = useCallback((id: string) => {
		setSelected((current) => current.filter((user) => user.id !== id));
	}, []);

	const handleSubmit = useCallback(() => {
		if (reason !== null || isSubmitting) {
			return;
		}

		setIsSubmitting(true);
		setFormError(null);

		void (async () => {
			const outcome = await dispatch(createGroupConversation({ name: trimmedName, participantIds: selected.map((user) => user.id) }));
			setIsSubmitting(false);
			if (createGroupConversation.fulfilled.match(outcome)) {
				onOpenChange(false);
				return;
			}
			setFormError(outcome.payload?.message ?? 'Could not create the group.');
		})();
	}, [dispatch, reason, isSubmitting, trimmedName, selected, onOpenChange]);

	const handleCancel = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title='New group'
			description='Name the group, then add the people who should be in it.'
			footer={
				<>
					<Button variant='ghost' size='sm' onClick={handleCancel}>
						Cancel
					</Button>
					<Button size='sm' disabled={reason !== null || isSubmitting} aria-busy={isSubmitting || undefined} aria-describedby={reason === null ? undefined : REASON_ID} onClick={handleSubmit}>
						{isSubmitting && <Spinner />}
						Create group
					</Button>
				</>
			}
		>
			<div className='flex flex-col gap-4'>
				<div className='flex flex-col gap-2'>
					<Label htmlFor={NAME_FIELD_ID}>Group name</Label>
					<Input id={NAME_FIELD_ID} value={name} maxLength={NAME_MAX_LENGTH} autoComplete='off' placeholder='Weekend plans' onChange={handleNameChange} />
				</div>

				<div className='flex flex-col gap-2'>
					<Label htmlFor={SEARCH_FIELD_ID}>Add people</Label>
					<Input id={SEARCH_FIELD_ID} type='search' autoComplete='off' placeholder='Search by name or number' value={query} onChange={handleSearchChange} />

					{selected.length > 0 && (
						<ul role='list' className='flex flex-wrap gap-1.5 pt-1'>
							{selected.map((user) => (
								<li key={user.id} className='flex min-w-0'>
									<ParticipantChip id={user.id} name={user.name} onRemove={handleRemove} />
								</li>
							))}
						</ul>
					)}

					<p role='status' aria-live='polite' className='sr-only'>
						{selected.length === 0 ? 'No one selected yet' : `${String(selected.length)} selected`}
					</p>

					{!isBlank && (
						<div className='border-border-subtle dark:border-border-subtle-dark rounded-panel max-h-56 overflow-y-auto border'>
							{status === 'loading' && (
								<p className='text-ink-muted dark:text-ink-muted-dark flex items-center gap-2 px-3 py-3 text-sm'>
									<Spinner />
									Searching
								</p>
							)}

							{status === 'error' && (
								<div className='flex items-center justify-between gap-2 px-3 py-3'>
									<p className='text-danger-ink dark:text-danger-ink-dark text-xs text-pretty'>{error ?? 'Search failed.'}</p>
									<Button variant='secondary' size='sm' onClick={retry}>
										Retry
									</Button>
								</div>
							)}

							{status === 'ready' && results.length === 0 && (
								<p className='text-ink-muted dark:text-ink-muted-dark px-3 py-3 text-sm text-pretty'>
									{isSelfMatch ? "That's you. Search for the people you want to add." : 'No one found. Numbers are stored in full international form, so include the country code.'}
								</p>
							)}

							{status === 'ready' && results.length > 0 && (
								<ul role='list' className='flex flex-col py-1'>
									{results.map((user) => (
										<SearchResultRow key={user.id} id={user.id} name={user.name} phone={user.phone} selected={selected.some((entry) => entry.id === user.id)} onSelect={handleToggle} />
									))}
								</ul>
							)}
						</div>
					)}
				</div>

				{reason !== null && (
					<p id={REASON_ID} className='text-ink-muted dark:text-ink-muted-dark text-xs text-pretty'>
						{reason}
					</p>
				)}

				{formError !== null && (
					<p role='alert' className='text-danger-ink dark:text-danger-ink-dark text-xs text-pretty'>
						{formError}
					</p>
				)}
			</div>
		</Dialog>
	);
});

NewGroupDialog.displayName = 'NewGroupDialog';

export default NewGroupDialog;
