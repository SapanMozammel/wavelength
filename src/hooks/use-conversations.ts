'use client';

import { useMountEffect } from '@/hooks/use-mount-effect';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectConversations, selectConversationsError, selectConversationsStatus } from '@/store/slices/chat-selectors';
import { fetchConversations } from '@/store/slices/chat-slice';
import type { AsyncStatus, Conversation } from '@/types/chat';
import { useCallback } from 'react';

export type UseConversationsResult = {
	conversations: readonly Conversation[];
	status: AsyncStatus;
	error: string | null;
	/** For the error state's retry control. */
	reload: () => void;
};

/**
 * The conversation list, fetched once when the sidebar mounts.
 *
 * `useMountEffect` rather than `useEffect` — this is the sanctioned wrapper for
 * genuine mount-time sync with an external system, and the fetch has no
 * dependencies to choreograph. Everything after mount arrives through the
 * socket (`liveMessageReceived`) or through an explicit `reload()`.
 */
export const useConversations = (): UseConversationsResult => {
	const dispatch = useAppDispatch();
	const conversations = useAppSelector(selectConversations);
	const status = useAppSelector(selectConversationsStatus);
	const error = useAppSelector(selectConversationsError);

	const reload = useCallback(() => {
		void dispatch(fetchConversations());
	}, [dispatch]);

	useMountEffect(() => {
		void dispatch(fetchConversations());
	});

	return { conversations, status, error, reload };
};
