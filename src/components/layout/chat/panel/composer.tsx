'use client';

import IconButton from '@/components/ui/icon-button';
import Textarea from '@/components/ui/textarea';
import { useComposer } from '@/hooks/use-composer';
import { cn } from '@/lib/utils';
import { IconSend } from '@tabler/icons-react';
import { memo, useId } from 'react';

type ComposerProps = {
	conversationId: string;
	/** Named in the field's accessible label, so the target of the message is never ambiguous. */
	conversationName: string;
	className?: string;
};

/**
 * The message input.
 *
 * The send control is disabled on an empty draft and while the socket is down,
 * and in both cases the reason is a real node wired through `aria-describedby`
 * rather than a tooltip — a disabled control with an invisible reason is the
 * same dead end whether you can see it or not.
 *
 * Nothing here is an `aria-live` region. The message list already announces
 * additions, and a second live region over the composer would make a screen
 * reader read every sent message twice.
 */
const Composer = memo(({ conversationId, conversationName, className }: ComposerProps) => {
	const { draft, canSend, notice, textarea, onDraftChange, onKeyDown, onSubmit } = useComposer(conversationId);
	const fieldId = useId();
	const noticeId = `${fieldId}-notice`;
	const hintId = `${fieldId}-hint`;

	const describedBy = notice === null ? hintId : `${noticeId} ${hintId}`;

	return (
		<form
			onSubmit={onSubmit}
			className={cn('border-border-subtle dark:border-border-subtle-dark bg-surface dark:bg-surface-dark shrink-0 border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4', className)}
		>
			{notice !== null && (
				<p id={noticeId} className={cn('mb-2 text-xs', notice.blocking ? 'text-danger-ink dark:text-danger-ink-dark' : 'text-ink-muted dark:text-ink-muted-dark')}>
					{notice.line}
				</p>
			)}

			<div className='bg-surface-raised dark:bg-surface-raised-dark rounded-panel flex items-end gap-2 px-3 py-2'>
				<label htmlFor={fieldId} className='sr-only'>
					Message {conversationName}
				</label>
				<Textarea
					id={fieldId}
					ref={textarea.ref}
					value={draft}
					onChange={(event) => onDraftChange(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder='Write a message'
					aria-describedby={describedBy}
					className='max-h-32 min-h-6 rounded-none border-0 bg-transparent px-0 py-0 text-[0.9375rem] dark:bg-transparent'
				/>
				<IconButton label='Send message' type='submit' variant='primary' size='sm' disabled={!canSend} aria-describedby={describedBy} icon={<IconSend aria-hidden='true' className='size-4' />} />
			</div>

			<p id={hintId} className='text-ink-muted dark:text-ink-muted-dark mt-1.5 hidden text-[0.6875rem] sm:block'>
				Enter to send, Shift+Enter for a new line
			</p>
		</form>
	);
});

Composer.displayName = 'Composer';

export default Composer;
