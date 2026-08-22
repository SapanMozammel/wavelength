'use client';

import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Label from '@/components/ui/label';
import { memo, useId, useState, type FormEvent } from 'react';

type RenameGroupFieldProps = {
	name: string;
	busy: boolean;
	onRename: (name: string) => Promise<boolean>;
};

/**
 * Inline rename for admins.
 *
 * A blank name is blocked here as well as by the server. The API does reject it
 * with a good message, but a disabled control that explains itself beats a round
 * trip that returns an error.
 */
const RenameGroupField = memo(({ name, busy, onRename }: RenameGroupFieldProps) => {
	const [draft, setDraft] = useState(name);
	const fieldId = useId();

	const trimmed = draft.trim();
	const isUnchanged = trimmed === name;
	const canSubmit = trimmed !== '' && !isUnchanged && !busy;

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canSubmit) {
			return;
		}
		await onRename(trimmed);
	};

	return (
		<form onSubmit={submit} className='flex flex-col gap-1.5'>
			<Label htmlFor={fieldId}>Group name</Label>
			<div className='flex items-center gap-2'>
				<Input
					id={fieldId}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						// Escape abandons the edit rather than the sheet.
						if (event.key === 'Escape') {
							event.stopPropagation();
							setDraft(name);
						}
					}}
					invalid={trimmed === ''}
					className='flex-1'
				/>
				<Button type='submit' variant='secondary' size='sm' disabled={!canSubmit}>
					{busy ? 'Saving…' : 'Save'}
				</Button>
			</div>
			{trimmed === '' && <p className='text-danger-ink dark:text-danger-ink-dark text-xs'>A group needs a name.</p>}
		</form>
	);
});

RenameGroupField.displayName = 'RenameGroupField';

export default RenameGroupField;
