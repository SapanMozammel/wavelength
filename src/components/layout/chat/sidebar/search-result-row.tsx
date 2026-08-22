'use client';

import Avatar from '@/components/ui/avatar';
import Checkbox from '@/components/ui/checkbox';
import Spinner from '@/components/ui/spinner';
import { formatPhoneForDisplay } from '@/lib/utils/phone';
import { memo, useCallback } from 'react';

type SearchResultRowProps = {
	id: string;
	name: string;
	phone: string;
	/**
	 * Multi-select mode — the group dialog. Omitted entirely by the start-a-chat
	 * list, which is a plain button per row.
	 */
	selected?: boolean;
	/** A `startDirect` is in flight for this person. */
	isPending?: boolean;
	/** Another start is in flight; every other row goes inert until it settles. */
	disabled?: boolean;
	onSelect: (id: string) => void;
};

/**
 * One person found by search.
 *
 * Two shapes, one component, because the identity block is identical and it is
 * the part that has to stay consistent: name in sans, number in mono, tone
 * seeded from the user id so the same person is the same colour everywhere.
 *
 * The multi-select variant is a real `Checkbox` with a `<label htmlFor>` rather
 * than a button pretending to be one — `aria-checked` on a `<button role>` is
 * easy to get subtly wrong, and the native pairing is free.
 */
const SearchResultRow = memo(({ id, name, phone, selected, isPending = false, disabled = false, onSelect }: SearchResultRowProps) => {
	const handleSelect = useCallback(() => {
		onSelect(id);
	}, [onSelect, id]);

	const identity = (
		<>
			<Avatar name={name} seed={id} size='sm' />
			<span className='flex min-w-0 flex-1 flex-col'>
				<span className='text-ink dark:text-ink-dark truncate text-sm font-medium'>{name}</span>
				<span className='text-ink-muted dark:text-ink-muted-dark truncate font-mono text-xs'>{formatPhoneForDisplay(phone)}</span>
			</span>
		</>
	);

	if (selected !== undefined) {
		const checkboxId = `group-member-${id}`;
		return (
			<li className='flex items-center gap-3 px-3 py-2'>
				<Checkbox id={checkboxId} checked={selected} onCheckedChange={handleSelect} />
				<label htmlFor={checkboxId} className='flex min-w-0 flex-1 cursor-pointer items-center gap-3'>
					{identity}
				</label>
			</li>
		);
	}

	return (
		<li>
			<button
				type='button'
				data-search-result=''
				onClick={handleSelect}
				disabled={disabled || isPending}
				aria-busy={isPending || undefined}
				className='hover:bg-surface-raised dark:hover:bg-surface-raised-dark flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'
			>
				{identity}
				{isPending && <Spinner className='text-signal-600 dark:text-signal-300 shrink-0' />}
				<span className='sr-only'>Start a conversation</span>
			</button>
		</li>
	);
});

SearchResultRow.displayName = 'SearchResultRow';

export default SearchResultRow;
