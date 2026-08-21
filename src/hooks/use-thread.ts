'use client';

import { useMountEffect } from '@/hooks/use-mount-effect';
import type { RootState } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectThreadMessages, selectThreadMeta } from '@/store/slices/chat-selectors';
import { fetchMessages, fetchOlderMessages } from '@/store/slices/chat-slice';
import type { AsyncStatus, Message } from '@/types/chat';
import { useCallback } from 'react';

export type UseThreadResult = {
	messages: readonly Message[];
	status: AsyncStatus;
	/** Tracked apart from `status` so a failed page-up never blanks loaded history. */
	olderStatus: AsyncStatus;
	hasMore: boolean;
	error: string | null;
	isEmpty: boolean;
	/** Scroll-to-top handler. Safe to call repeatedly — the thunk's `condition` refuses duplicates. */
	loadOlder: () => void;
	/** Retry for the initial-load error state. */
	reload: () => void;
};

/**
 * One conversation's messages, loaded when the panel mounts.
 *
 * Designed for **key-based remount** (`no-use-effect` Rule 5): the panel renders
 * `<MessageList key={conversationId} />`, so switching threads unmounts and
 * remounts this hook and `useMountEffect` fetches the new history. There is no
 * dependency array trying to tear down one thread and set up another in place,
 * and therefore no window in which a late response lands in the wrong thread.
 */
export const useThread = (conversationId: string): UseThreadResult => {
	const dispatch = useAppDispatch();
	const messages = useAppSelector((state: RootState) => selectThreadMessages(state, conversationId));
	const meta = useAppSelector((state: RootState) => selectThreadMeta(state, conversationId));

	const reload = useCallback(() => {
		void dispatch(fetchMessages(conversationId));
	}, [dispatch, conversationId]);

	const loadOlder = useCallback(() => {
		void dispatch(fetchOlderMessages(conversationId));
	}, [dispatch, conversationId]);

	useMountEffect(() => {
		void dispatch(fetchMessages(conversationId));
	});

	return { messages, ...meta, loadOlder, reload };
};
