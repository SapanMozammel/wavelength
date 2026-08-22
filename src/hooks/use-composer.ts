'use client';

import { useAutoGrowTextarea, type AutoGrowTextarea } from '@/hooks/use-auto-grow-textarea';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';
import { canSendOnSocket, composerNoticeFor, type ComposerNotice } from '@/lib/chat/composer-state';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectSocketStatus } from '@/store/slices/chat-selectors';
import { optimisticDismissed, sendChatMessage } from '@/store/slices/chat-slice';
import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';

export type ComposerState = {
	draft: string;
	/** Whether the send control is operable right now. */
	canSend: boolean;
	/** The socket line above the field, or `null` for silence. */
	notice: ComposerNotice | null;
	textarea: AutoGrowTextarea;
	onDraftChange: (value: string) => void;
	onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	/** Re-sends a failed message under its original `clientId`, so it replaces rather than duplicates. */
	onRetry: (clientId: string, text: string) => void;
	onDismiss: (clientId: string) => void;
};

/**
 * Everything the composer does, kept out of the markup.
 *
 * **The empty-message rule is enforced three times, and all three are needed.**
 * The API accepts `""` and `"   "` with a 200 — there is no server-side text
 * validation at all — so this is entirely the client's job. The send control is
 * disabled on a trimmed-empty draft; the submit handler returns early on the
 * same condition, because a disabled button does not stop the Enter key; and
 * `sendMessage()` throws before issuing the request. Only the first is visible,
 * and only the last is load-bearing if the other two are ever refactored away.
 *
 * **The draft clears before the await, not after.** Waiting on the network to
 * empty the field makes a fast typist lose the sentence they started while the
 * last one was in flight. The optimistic message is already on screen by then,
 * so there is nothing to be gained by holding the text.
 *
 * A failed send is never removed automatically — see `dismissOptimistic`. Retry
 * reuses the original `clientId`, and `appendOptimistic` is idempotent on it, so
 * a retried message returns to `sending` in place instead of appearing twice.
 */
export const useComposer = (conversationId: string): ComposerState => {
	const dispatch = useAppDispatch();
	const socketStatus = useAppSelector(selectSocketStatus);
	const wakeStatus = useAppSelector((state) => state.chat.wakeStatus);
	const isCoarsePointer = useCoarsePointer();

	const [draft, setDraft] = useState('');
	const textarea = useAutoGrowTextarea(draft);

	const notice = composerNoticeFor(socketStatus, wakeStatus);
	const hasText = draft.trim() !== '';
	const canSend = hasText && canSendOnSocket(socketStatus);

	const submit = useCallback(() => {
		const text = draft.trim();
		// Guard two: Enter bypasses a disabled control entirely.
		if (text === '' || !canSendOnSocket(socketStatus)) {
			return;
		}
		setDraft('');
		textarea.focus();
		void dispatch(sendChatMessage({ conversationId, text }));
	}, [draft, socketStatus, dispatch, conversationId, textarea]);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			submit();
		},
		[submit]
	);

	/**
	 * Enter sends, Shift+Enter breaks the line — but only where Enter is a
	 * deliberate keystroke. On a touch keyboard the return key sits under the
	 * thumb and is how half-finished messages get delivered, so there it inserts
	 * a newline and the button is the only way to send.
	 */
	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key !== 'Enter' || event.shiftKey || isCoarsePointer || event.nativeEvent.isComposing) {
				return;
			}
			event.preventDefault();
			submit();
		},
		[isCoarsePointer, submit]
	);

	const onDraftChange = useCallback((value: string) => {
		setDraft(value);
	}, []);

	const onRetry = useCallback(
		(clientId: string, text: string) => {
			void dispatch(sendChatMessage({ conversationId, text, clientId }));
		},
		[dispatch, conversationId]
	);

	const onDismiss = useCallback(
		(clientId: string) => {
			dispatch(optimisticDismissed({ conversationId, clientId }));
		},
		[dispatch, conversationId]
	);

	return { draft, canSend, notice, textarea, onDraftChange, onKeyDown, onSubmit, onRetry, onDismiss };
};
