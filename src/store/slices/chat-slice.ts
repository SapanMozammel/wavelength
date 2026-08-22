import { createGroup, getMessages, listConversations, sendMessage, startDirectConversation } from '@/lib/api';
import { ApiError, userFacingMessage } from '@/lib/api/errors';
import type { WakeStatus } from '@/lib/api/health';
import type { SocketStatus } from '@/lib/socket/client';
import type { AsyncStatus, ChatError, ChatErrorKind, Conversation, Message, MessagePage, User } from '@/types/chat';
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { appendHistory, appendOptimistic, confirmOptimistic, emptyThread, failOptimistic, prependPage, receiveLive, type OptimisticMessage, type Thread } from './chat-merge';

/**
 * The chat state container.
 *
 * `CLAUDE.md` leaves the home of chat data open and states the constraint that
 * decides it: optimistic sends, socket arrivals and paginated history all
 * mutate the same message list, so one reducer has to own merge order. This is
 * that reducer. It owns *ordering*; the merge rules themselves live in
 * `chat-merge.ts` so they can be tested without a store, and every list
 * mutation below delegates to them rather than splicing arrays inline.
 */

export type ConversationsState = {
	byId: Record<string, Conversation>;
	/** Server order — `GET /conversations` is already `updatedAt` desc, so nothing re-sorts. */
	orderedIds: string[];
	status: AsyncStatus;
	error: string | null;
};

export type ChatState = {
	conversations: ConversationsState;
	threads: Record<string, Thread>;
	activeConversationId: string | null;
	/**
	 * Derived client-side: the API has no unread concept at all. Counted from
	 * arrivals while a conversation is not active, cleared on open, and gone on
	 * reload — which is stated in the write-up rather than faked.
	 */
	unread: Record<string, number>;
	socketStatus: SocketStatus;

	/**
	 * Cold-start narration (quirk 20). The API is on a free Render tier that
	 * sleeps after inactivity, so the first request of a session can take 30 to
	 * 60 seconds. These four fields are what lets the app say so out loud
	 * instead of spinning at the user — and, just as importantly, what keeps it
	 * silent when the server is already warm.
	 */
	wakeStatus: WakeStatus;
	/** When the current probe began, so a surface mounted late still counts from the real start. */
	wakeStartedAt: number | null;
	/** Bumped by a retry. `WakeBoot` keys the probe on it, so a change remounts and re-probes. */
	wakeAttempt: number;
	/**
	 * Whether narration was actually shown. This is what gates the closing
	 * acknowledgement: on a warm server the status goes straight to `awake`,
	 * nothing was ever said, and "Server's awake" would be an answer to a
	 * question nobody asked.
	 */
	wakeNarrated: boolean;
};

const initialState: ChatState = {
	conversations: { byId: {}, orderedIds: [], status: 'idle', error: null },
	threads: {},
	activeConversationId: null,
	unread: {},
	socketStatus: 'disconnected',
	wakeStatus: 'unknown',
	wakeStartedAt: null,
	wakeAttempt: 0,
	wakeNarrated: false,
};

/**
 * Runs one merge rule against a thread and writes the result back.
 *
 * The identity check matters: `receiveLive` returns the *same* thread when the
 * message is already present, and assigning it back anyway would mark the
 * draft modified and re-render a list that did not change.
 */
const applyToThread = (state: ChatState, conversationId: string, merge: (thread: Thread) => Thread): void => {
	const current = state.threads[conversationId];
	const next = merge(current ?? emptyThread());
	if (next !== current) {
		state.threads[conversationId] = next;
	}
};

/** Moves a conversation to the top of the list and refreshes its preview row. */
const touchConversation = (state: ChatState, message: Message): void => {
	const conversation = state.conversations.byId[message.conversationId];
	if (conversation === undefined) {
		return;
	}

	conversation.lastMessage = message;
	conversation.updatedAt = message.createdAt;

	const index = state.conversations.orderedIds.indexOf(message.conversationId);
	if (index > 0) {
		state.conversations.orderedIds.splice(index, 1);
		state.conversations.orderedIds.unshift(message.conversationId);
	}
};

/** Replaces a conversation row by id, or inserts it at the top if it is new. */
const upsertConversation = (state: ChatState, conversation: Conversation): void => {
	if (state.conversations.byId[conversation.id] === undefined) {
		state.conversations.orderedIds.unshift(conversation.id);
	}
	state.conversations.byId[conversation.id] = conversation;
};

/* -------------------------------------------------------------------------- */
/* Thunks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The state the thunks read, described structurally rather than as `RootState`.
 *
 * `src/store/index.ts` imports this module to build its reducer map, so a
 * `RootState` import here would be a circular type reference. Every real store
 * shape that satisfies this is accepted, which is all these thunks need.
 */
type ChatThunkState = {
	chat: ChatState;
	session: { token: string | null; user: User | null };
};

type ChatThunkConfig = { state: ChatThunkState; rejectValue: ChatError };

/**
 * Every rejection carries an `ApiErrorKind`, never a raw driver message.
 *
 * `unauthorized` in particular is handled exactly once, by listener middleware
 * in `src/store/index.ts`. No thunk here decides on its own to log the user out.
 */
const toChatError = (error: unknown): ChatError => {
	if (error instanceof ApiError) {
		// This assignment is the compile-time link between `ApiErrorKind` and
		// `ChatErrorKind`: widening one without the other breaks the build here
		// rather than silently rendering a fallback message.
		const kind: ChatErrorKind = error.kind;
		return { kind, message: userFacingMessage(error) };
	}
	// The only plain `Error`s thrown out of `@/lib/api` are its client-side
	// precondition guards — empty message text, starting a chat with yourself —
	// whose messages are already written for a human.
	if (error instanceof Error) {
		return { kind: 'validation', message: error.message };
	}
	return { kind: 'unknown', message: 'Something went wrong. Please try again.' };
};

const requireSession = (state: ChatThunkState): { token: string; user: User } => {
	const { token, user } = state.session;
	if (token === null || user === null) {
		throw new ApiError({ kind: 'unauthorized', status: 401, message: 'Your session has expired. Please log in again.' });
	}
	return { token, user };
};

let fallbackClientIdCounter = 0;

/**
 * `crypto.randomUUID` requires a secure context — true on `localhost` and on
 * HTTPS, which covers dev and deploy. The counter fallback keeps sending
 * working anywhere else instead of throwing inside the composer.
 */
const createClientId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	fallbackClientIdCounter += 1;
	return `local-${Date.now().toString(36)}-${String(fallbackClientIdCounter)}`;
};

export const fetchConversations = createAsyncThunk<Conversation[], void, ChatThunkConfig>('chat/fetchConversations', async (_arg, api) => {
	try {
		return await listConversations(requireSession(api.getState()).token);
	} catch (error) {
		return api.rejectWithValue(toChatError(error));
	}
});

export const fetchMessages = createAsyncThunk<{ conversationId: string; page: MessagePage }, string, ChatThunkConfig>('chat/fetchMessages', async (conversationId, api) => {
	try {
		const page = await getMessages(conversationId, requireSession(api.getState()).token);
		return { conversationId, page };
	} catch (error) {
		return api.rejectWithValue(toChatError(error));
	}
});

/**
 * One page further back. The cursor is read from the thread rather than passed
 * in, so a component cannot hand over a stale one, and `condition` refuses the
 * dispatch when there is nothing older or a page is already in flight — which
 * is what stops a scroll-to-top gesture firing five identical requests.
 */
export const fetchOlderMessages = createAsyncThunk<{ conversationId: string; page: MessagePage }, string, ChatThunkConfig>(
	'chat/fetchOlderMessages',
	async (conversationId, api) => {
		const cursor = api.getState().chat.threads[conversationId]?.nextCursor ?? undefined;
		try {
			const page = await getMessages(conversationId, requireSession(api.getState()).token, cursor === undefined ? {} : { before: cursor });
			return { conversationId, page };
		} catch (error) {
			return api.rejectWithValue(toChatError(error));
		}
	},
	{
		condition: (conversationId, api) => {
			const thread = api.getState().chat.threads[conversationId];
			return thread !== undefined && thread.hasMore && thread.olderStatus !== 'loading';
		},
	}
);

export type SendChatMessageArg = {
	conversationId: string;
	text: string;
	/** Supplied when retrying a failed send, so the bubble is reused rather than duplicated. */
	clientId?: string;
};

/**
 * Send, with mandatory local echo.
 *
 * The server delivers `message:new` to every participant **except the author**,
 * so nothing will ever put this message on screen but this dispatch. The
 * optimistic append therefore happens synchronously, before the first `await`;
 * the POST's response — which carries the real `id` and `createdAt` — replaces
 * it in place afterwards. It never waits on the socket.
 */
export const sendChatMessage = createAsyncThunk<{ conversationId: string; clientId: string; message: Message }, SendChatMessageArg, ChatThunkConfig>(
	'chat/sendChatMessage',
	async ({ conversationId, text, clientId }, api) => {
		let session: { token: string; user: User };
		try {
			session = requireSession(api.getState());
		} catch (error) {
			return api.rejectWithValue(toChatError(error));
		}

		const key = clientId ?? createClientId();
		const optimistic: OptimisticMessage = {
			id: key,
			conversationId,
			senderId: session.user.id,
			text: text.trim(),
			createdAt: Date.now(),
			status: 'sending',
			clientId: key,
		};
		api.dispatch(optimisticAppended({ conversationId, message: optimistic }));

		try {
			const message = await sendMessage(conversationId, text, session.token);
			return { conversationId, clientId: key, message };
		} catch (error) {
			api.dispatch(optimisticFailed({ conversationId, clientId: key }));
			return api.rejectWithValue(toChatError(error));
		}
	}
);

/**
 * Opens (or creates) a one-to-one conversation with `peer`.
 *
 * The self-chat guard lives in `startDirectConversation`: passing your own id
 * returns an unrelated existing conversation rather than an error, which
 * silently opens the wrong thread.
 */
export const startDirect = createAsyncThunk<Conversation, User, ChatThunkConfig>('chat/startDirect', async (peer, api) => {
	try {
		const { token, user } = requireSession(api.getState());
		return await startDirectConversation(peer, user.id, token);
	} catch (error) {
		return api.rejectWithValue(toChatError(error));
	}
});

export type CreateGroupArg = { name: string; participantIds: string[] };

export const createGroupConversation = createAsyncThunk<Conversation, CreateGroupArg, ChatThunkConfig>('chat/createGroupConversation', async ({ name, participantIds }, api) => {
	try {
		return await createGroup(name, participantIds, requireSession(api.getState()).token);
	} catch (error) {
		return api.rejectWithValue(toChatError(error));
	}
});

const chatSlice = createSlice({
	name: 'chat',
	initialState,
	reducers: {
		/** Opening a conversation is also what clears its unread badge. */
		conversationOpened: (state, action: PayloadAction<string>) => {
			state.activeConversationId = action.payload;
			delete state.unread[action.payload];
		},

		conversationClosed: (state) => {
			state.activeConversationId = null;
		},

		socketStatusChanged: (state, action: PayloadAction<SocketStatus>) => {
			state.socketStatus = action.payload;
		},

		/** A probe has been fired; the payload is its start time. */
		wakeProbeStarted: (state, action: PayloadAction<number>) => {
			state.wakeStartedAt = action.payload;
		},

		/**
		 * The only writer of `wakeStatus`.
		 *
		 * Reaching `waking` is also what records that something was said, and
		 * that flag is deliberately *not* cleared on `awake` — the closing
		 * acknowledgement needs to know the wait happened.
		 */
		wakeStatusChanged: (state, action: PayloadAction<WakeStatus>) => {
			state.wakeStatus = action.payload;
			if (action.payload === 'waking') {
				state.wakeNarrated = true;
			}
		},

		/** The acknowledgement has had its moment; drop the notice everywhere at once. */
		wakeAcknowledged: (state) => {
			state.wakeNarrated = false;
		},

		wakeRetryRequested: (state) => {
			state.wakeStatus = 'unknown';
			state.wakeStartedAt = null;
			state.wakeNarrated = false;
			state.wakeAttempt += 1;
		},

		/**
		 * A `message:new` push.
		 *
		 * A thread that has never been loaded is deliberately **not** created
		 * here. Fabricating one from a single socket message leaves a hole in
		 * the middle of the list that the eventual history fetch merges around;
		 * the preview row and the unread badge carry the news instead.
		 */
		liveMessageReceived: (state, action: PayloadAction<Message>) => {
			const message = action.payload;

			if (state.threads[message.conversationId] !== undefined) {
				applyToThread(state, message.conversationId, (thread) => receiveLive(thread, message));
			}

			touchConversation(state, message);

			if (state.activeConversationId !== message.conversationId) {
				state.unread[message.conversationId] = (state.unread[message.conversationId] ?? 0) + 1;
			}
		},

		unreadCleared: (state, action: PayloadAction<string>) => {
			delete state.unread[action.payload];
		},

		/** The synchronous half of `sendChatMessage` — see the thunk for why it cannot wait. */
		optimisticAppended: (state, action: PayloadAction<{ conversationId: string; message: OptimisticMessage }>) => {
			const { conversationId, message } = action.payload;
			applyToThread(state, conversationId, (thread) => appendOptimistic(thread, message));
		},

		optimisticFailed: (state, action: PayloadAction<{ conversationId: string; clientId: string }>) => {
			const { conversationId, clientId } = action.payload;
			applyToThread(state, conversationId, (thread) => failOptimistic(thread, clientId));
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchConversations.pending, (state) => {
				state.conversations.status = 'loading';
				state.conversations.error = null;
			})
			.addCase(fetchConversations.fulfilled, (state, action) => {
				state.conversations.byId = Object.fromEntries(action.payload.map((conversation) => [conversation.id, conversation]));
				state.conversations.orderedIds = action.payload.map((conversation) => conversation.id);
				state.conversations.status = 'ready';
				state.conversations.error = null;
			})
			.addCase(fetchConversations.rejected, (state, action) => {
				state.conversations.status = 'error';
				state.conversations.error = action.payload?.message ?? 'Could not load your conversations.';
			})

			/**
			 * `loading` only while the thread is genuinely empty. A refetch on
			 * re-open keeps the messages already on screen rather than blanking
			 * them back to a skeleton.
			 */
			.addCase(fetchMessages.pending, (state, action) => {
				const thread = state.threads[action.meta.arg] ?? emptyThread();
				state.threads[action.meta.arg] = { ...thread, status: thread.orderedIds.length === 0 ? 'loading' : thread.status, error: null };
			})
			.addCase(fetchMessages.fulfilled, (state, action) => {
				applyToThread(state, action.payload.conversationId, (thread) => appendHistory(thread, action.payload.page));
			})
			.addCase(fetchMessages.rejected, (state, action) => {
				const thread = state.threads[action.meta.arg] ?? emptyThread();
				state.threads[action.meta.arg] = { ...thread, status: 'error', error: action.payload?.message ?? 'Could not load this conversation.' };
			})

			/**
			 * A failed page-up sets `olderStatus` alone, so the list keeps every
			 * message already loaded and shows a retry strip at the top.
			 * Discarding read history on a pagination failure is the mistake.
			 */
			.addCase(fetchOlderMessages.pending, (state, action) => {
				const thread = state.threads[action.meta.arg] ?? emptyThread();
				state.threads[action.meta.arg] = { ...thread, olderStatus: 'loading' };
			})
			.addCase(fetchOlderMessages.fulfilled, (state, action) => {
				applyToThread(state, action.payload.conversationId, (thread) => prependPage(thread, action.payload.page));
			})
			.addCase(fetchOlderMessages.rejected, (state, action) => {
				const thread = state.threads[action.meta.arg] ?? emptyThread();
				state.threads[action.meta.arg] = { ...thread, olderStatus: 'error', error: action.payload?.message ?? 'Could not load older messages.' };
			})

			.addCase(sendChatMessage.fulfilled, (state, action) => {
				const { conversationId, clientId, message } = action.payload;
				applyToThread(state, conversationId, (thread) => confirmOptimistic(thread, clientId, message));
				touchConversation(state, message);
			})

			.addCase(startDirect.fulfilled, (state, action) => {
				upsertConversation(state, action.payload);
				state.activeConversationId = action.payload.id;
				delete state.unread[action.payload.id];
			})

			.addCase(createGroupConversation.fulfilled, (state, action) => {
				upsertConversation(state, action.payload);
				state.activeConversationId = action.payload.id;
			});
	},
});

export const {
	conversationOpened,
	conversationClosed,
	socketStatusChanged,
	liveMessageReceived,
	unreadCleared,
	optimisticAppended,
	optimisticFailed,
	wakeProbeStarted,
	wakeStatusChanged,
	wakeAcknowledged,
	wakeRetryRequested,
} = chatSlice.actions;

export default chatSlice.reducer;
