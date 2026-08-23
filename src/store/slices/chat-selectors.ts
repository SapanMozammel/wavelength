import type { SocketStatus } from '@/lib/socket/client';
import type { RootState } from '@/store';
import type { AsyncStatus, Conversation, Message } from '@/types/chat';
import { createSelector } from '@reduxjs/toolkit';
import { threadMessages, type Thread } from './chat-merge';

/**
 * Every read of chat state goes through here.
 *
 * The point of the `byId` + `orderedIds` shape is that the message array is
 * materialised in exactly one place — `selectThreadMessages` — so a socket
 * arrival in conversation B cannot hand conversation A's list a new array and
 * re-render it. RTK's `createSelector` memoizes per argument set (reselect's
 * `weakMapMemoize`), so the per-conversation selectors below do not thrash when
 * two threads are read in the same render.
 */

/** Stable empty results, so "nothing loaded yet" is not a new array every render. */
const NO_MESSAGES: readonly Message[] = Object.freeze([]);
const NO_CONVERSATIONS: readonly Conversation[] = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* Conversations                                                               */
/* -------------------------------------------------------------------------- */

const selectConversationsSlice = (state: RootState) => state.chat.conversations;

/**
 * The list, in server order. `GET /conversations` already returns `updatedAt`
 * descending and the reducer keeps it that way on a live arrival, so this never
 * sorts.
 */
export const selectConversations = createSelector([selectConversationsSlice], (conversations): readonly Conversation[] =>
	conversations.orderedIds.length === 0 ? NO_CONVERSATIONS : conversations.orderedIds.map((id) => conversations.byId[id]).filter((conversation): conversation is Conversation => conversation !== undefined)
);

export const selectConversationsStatus = (state: RootState): AsyncStatus => state.chat.conversations.status;

export const selectConversationsError = (state: RootState): string | null => state.chat.conversations.error;

export const selectConversationById = (state: RootState, conversationId: string): Conversation | undefined => state.chat.conversations.byId[conversationId];

export const selectActiveConversationId = (state: RootState): string | null => state.chat.activeConversationId;

export const selectActiveConversation = (state: RootState): Conversation | undefined => {
	const activeId = state.chat.activeConversationId;
	return activeId === null ? undefined : state.chat.conversations.byId[activeId];
};

/* -------------------------------------------------------------------------- */
/* Threads                                                                     */
/* -------------------------------------------------------------------------- */

const selectThread = (state: RootState, conversationId: string): Thread | undefined => state.chat.threads[conversationId];

/**
 * The only place `orderedIds` becomes an array of messages.
 *
 * The input selector reaches straight for one thread rather than the whole
 * `threads` record: under immer an untouched thread keeps its object identity,
 * so a message arriving in another conversation leaves this memoized result
 * alone.
 */
export const selectThreadMessages = createSelector([selectThread], (thread): readonly Message[] => (thread === undefined ? NO_MESSAGES : threadMessages(thread)));

/** Everything the message list needs to pick a state, without materialising the list. */
export const selectThreadMeta = createSelector([selectThread], (thread) => ({
	status: thread?.status ?? ('idle' as AsyncStatus),
	olderStatus: thread?.olderStatus ?? ('idle' as AsyncStatus),
	hasMore: thread?.hasMore ?? false,
	error: thread?.error ?? null,
	isEmpty: (thread?.orderedIds.length ?? 0) === 0,
}));

export const selectLastMessage = createSelector([selectThread], (thread): Message | undefined => {
	const lastId = thread?.orderedIds.at(-1);
	return lastId === undefined ? undefined : thread?.byId[lastId];
});

/* -------------------------------------------------------------------------- */
/* Unread + socket                                                             */
/* -------------------------------------------------------------------------- */

export const selectUnreadCount = (state: RootState, conversationId: string): number => state.chat.unread[conversationId] ?? 0;

/** Feeds the `aria-live` announcement in plans 04 and 07. */
export const selectTotalUnread = createSelector([(state: RootState) => state.chat.unread], (unread) => Object.values(unread).reduce((total, count) => total + count, 0));

export const selectSocketStatus = (state: RootState): SocketStatus => state.chat.socketStatus;
