'use client';

import { IconX } from '@tabler/icons-react';
import { memo, useCallback } from 'react';

type ParticipantChipProps = {
	id: string;
	name: string;
	onRemove: (id: string) => void;
};

/**
 * A chosen group member, and the way to un-choose them.
 *
 * The whole chip is the remove control rather than a tiny `×` inside it: a
 * 12px hit area is unusable on a phone, and `h-9` matches the project's dense
 * control size. The count is never ambiguous because the chips *are* the count
 * — a bare "3 selected" line leaves the user guessing which three.
 */
const ParticipantChip = memo(({ id, name, onRemove }: ParticipantChipProps) => {
	const handleRemove = useCallback(() => {
		onRemove(id);
	}, [onRemove, id]);

	return (
		<button
			type='button'
			onClick={handleRemove}
			aria-label={`Remove ${name}`}
			className='bg-signal-100 text-signal-800 hover:bg-signal-200 dark:bg-signal-900 dark:text-signal-100 dark:hover:bg-signal-800 inline-flex h-9 max-w-full items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-xs font-medium transition-colors duration-150'
		>
			<span className='truncate'>{name}</span>
			<IconX aria-hidden='true' className='size-3.5 shrink-0' />
		</button>
	);
});

ParticipantChip.displayName = 'ParticipantChip';

export default ParticipantChip;
