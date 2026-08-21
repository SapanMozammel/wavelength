import { createGroup, getMessages, listConversations, sendMessage, startDirectConversation } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import { makeStore, type AppStore } from '@/store';
import { selectConversations, selectThreadMessages, selectThreadMeta, selectUnreadCount } from '@/store/slices/chat-selectors';
import { conversationOpened, createGroupConversation, fetchConversations, fetchMessages, fetchOlderMessages, liveMessageReceived, sendChatMessage, startDirect } from '@/store/slices/chat-slice';
import { sessionEstablished } from '@/store/slices/session-slice';
import type { Conversation, Message, MessagePage, User } from '@/types/chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The thunk lifecycles, against a mocked `@/lib/api`. The merge rules
 * themselves are covered without a store in `chat-merge.test.ts`; what is
 * tested here is the wiring — which reducer runs when, and the one place the
 * app decides a session is over.
 */

vi.mock('@/lib/api', () => ({
	listConversations: vi.fn(),
	getMessages: vi.fn(),
	sendMessage: vi.fn(),
	startDirectConversation: vi.fn(),
	createGroup: vi.fn(),
}));

const ME: User = { id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const PEER: User = { id: 'u2', name: 'Grace Hopper', phone: '+15557654321' };

const direct = (id: string, updatedAt: number): Conversation => ({ id, type: 'direct', participant: PEER, lastMessage: null, updatedAt });

const message = (id: string, conversationId: string, createdAt: number): Message => ({ id, conversationId, senderId: PEER.id, text: id, createdAt, status: 'sent' });

const page = (messages: Message[], hasMore = false, nextCursor: string | null = null): MessagePage => ({ messages, hasMore, nextCursor });

const unauthorized = (): ApiError => new ApiError({ kind: 'unauthorized', status: 401, message: 'Invalid token' });

let store: AppStore;

const messageIds = (conversationId: string): string[] => selectThreadMessages(store.getState(), conversationId).map((entry) => entry.id);

beforeEach(() => {
	vi.clearAllMocks();
	store = makeStore();
	store.dispatch(sessionEstablished({ token: 'jwt', user: ME }));
});

describe('fetchConversations', () => {
	it('indexes the list and marks it ready', async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', 2_000), direct('c2', 1_000)]);

		await store.dispatch(fetchConversations());

		expect(selectConversations(store.getState()).map((conversation) => conversation.id)).toEqual(['c1', 'c2']);
	});

	it('surfaces a user-facing message rather than the driver error', async () => {
		vi.mocked(listConversations).mockRejectedValue(new ApiError({ kind: 'server', status: 500, message: 'Cast to ObjectId failed for value' }));

		await store.dispatch(fetchConversations());

		expect(store.getState().chat.conversations.error).toBe('The server had a problem. This is usually temporary — try again.');
	});

	it('rejects before issuing a request when there is no token', async () => {
		store = makeStore();

		await store.dispatch(fetchConversations());

		expect(listConversations).not.toHaveBeenCalled();
	});
});

describe('fetchMessages', () => {
	it('loads history oldest-first into the thread', async () => {
		vi.mocked(getMessages).mockResolvedValue(page([message('m1', 'c1', 1_000), message('m2', 'c1', 2_000)]));

		await store.dispatch(fetchMessages('c1'));

		expect(messageIds('c1')).toEqual(['m1', 'm2']);
	});

	it('marks an empty thread loading while the first page is in flight', () => {
		vi.mocked(getMessages).mockReturnValue(new Promise(() => undefined));

		void store.dispatch(fetchMessages('c1'));

		expect(selectThreadMeta(store.getState(), 'c1').status).toBe('loading');
	});

	it('keeps already-loaded messages visible during a refetch', async () => {
		vi.mocked(getMessages).mockResolvedValue(page([message('m1', 'c1', 1_000)]));
		await store.dispatch(fetchMessages('c1'));

		vi.mocked(getMessages).mockReturnValue(new Promise(() => undefined));
		void store.dispatch(fetchMessages('c1'));

		expect(messageIds('c1')).toEqual(['m1']);
	});

	it('records the failure on the thread it belongs to', async () => {
		vi.mocked(getMessages).mockRejectedValue(new ApiError({ kind: 'not-found', status: 404, message: 'Conversation not found' }));

		await store.dispatch(fetchMessages('c1'));

		expect(selectThreadMeta(store.getState(), 'c1')).toMatchObject({ status: 'error', error: 'That conversation could not be found.' });
	});
});

describe('fetchOlderMessages', () => {
	const loadFirstPage = async (): Promise<void> => {
		vi.mocked(getMessages).mockResolvedValue(page([message('m3', 'c1', 3_000), message('m4', 'c1', 4_000)], true, 'm3'));
		await store.dispatch(fetchMessages('c1'));
	};

	it('passes the thread cursor as `before` rather than trusting a caller', async () => {
		await loadFirstPage();
		vi.mocked(getMessages).mockResolvedValue(page([message('m1', 'c1', 1_000), message('m2', 'c1', 2_000)]));

		await store.dispatch(fetchOlderMessages('c1'));

		expect(getMessages).toHaveBeenLastCalledWith('c1', 'jwt', { before: 'm3' });
	});

	it('prepends the older page in front of what is already on screen', async () => {
		await loadFirstPage();
		vi.mocked(getMessages).mockResolvedValue(page([message('m1', 'c1', 1_000), message('m2', 'c1', 2_000)]));

		await store.dispatch(fetchOlderMessages('c1'));

		expect(messageIds('c1')).toEqual(['m1', 'm2', 'm3', 'm4']);
	});

	it('refuses to fire when the thread is already at the beginning of history', async () => {
		vi.mocked(getMessages).mockResolvedValue(page([message('m1', 'c1', 1_000)]));
		await store.dispatch(fetchMessages('c1'));
		vi.mocked(getMessages).mockClear();

		await store.dispatch(fetchOlderMessages('c1'));

		expect(getMessages).not.toHaveBeenCalled();
	});

	it('keeps the loaded history on screen when a page-up fails', async () => {
		await loadFirstPage();
		vi.mocked(getMessages).mockRejectedValue(new ApiError({ kind: 'network', status: 0, message: 'Could not reach the server.' }));

		await store.dispatch(fetchOlderMessages('c1'));

		expect(messageIds('c1')).toEqual(['m3', 'm4']);
	});

	it('reports the failure on olderStatus, leaving the thread itself ready', async () => {
		await loadFirstPage();
		vi.mocked(getMessages).mockRejectedValue(new ApiError({ kind: 'network', status: 0, message: 'Could not reach the server.' }));

		await store.dispatch(fetchOlderMessages('c1'));

		expect(selectThreadMeta(store.getState(), 'c1')).toMatchObject({ status: 'ready', olderStatus: 'error' });
	});
});

describe('sendChatMessage', () => {
	beforeEach(async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', 1_000)]);
		await store.dispatch(fetchConversations());
		vi.mocked(getMessages).mockResolvedValue(page([]));
		await store.dispatch(fetchMessages('c1'));
	});

	/**
	 * The server sends the author no `message:new` echo, so this dispatch is
	 * the only thing that will ever put the message on screen. It has to land
	 * before the POST is awaited, not after it resolves.
	 */
	it('puts the message on screen synchronously, before the POST resolves', () => {
		vi.mocked(sendMessage).mockReturnValue(new Promise(() => undefined));

		void store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello' }));

		expect(selectThreadMessages(store.getState(), 'c1')).toHaveLength(1);
	});

	it('shows the optimistic message as sending', () => {
		vi.mocked(sendMessage).mockReturnValue(new Promise(() => undefined));

		void store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello' }));

		expect(selectThreadMessages(store.getState(), 'c1').at(0)?.status).toBe('sending');
	});

	it('replaces the echo with the server copy instead of appending a second bubble', async () => {
		vi.mocked(sendMessage).mockResolvedValue({ ...message('m1', 'c1', 5_000), senderId: ME.id });

		await store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello' }));

		expect(messageIds('c1')).toEqual(['m1']);
	});

	it('marks a failed send failed and leaves it in the list', async () => {
		vi.mocked(sendMessage).mockRejectedValue(new ApiError({ kind: 'server', status: 500, message: 'boom' }));

		await store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello' }));

		expect(selectThreadMessages(store.getState(), 'c1').at(0)?.status).toBe('failed');
	});

	it('reuses the bubble when a failed send is retried with its clientId', async () => {
		vi.mocked(sendMessage).mockRejectedValue(new ApiError({ kind: 'server', status: 500, message: 'boom' }));
		await store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello', clientId: 'ca' }));

		vi.mocked(sendMessage).mockResolvedValue({ ...message('m1', 'c1', 5_000), senderId: ME.id });
		await store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello', clientId: 'ca' }));

		expect(messageIds('c1')).toEqual(['m1']);
	});

	it('refreshes the sidebar preview from the confirmed message', async () => {
		vi.mocked(sendMessage).mockResolvedValue({ ...message('m1', 'c1', 5_000), text: 'hello', senderId: ME.id });

		await store.dispatch(sendChatMessage({ conversationId: 'c1', text: 'hello' }));

		expect(selectConversations(store.getState()).at(0)?.lastMessage?.text).toBe('hello');
	});
});

describe('liveMessageReceived', () => {
	beforeEach(async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', 1_000), direct('c2', 900)]);
		await store.dispatch(fetchConversations());
	});

	it('merges into a thread that is already loaded', async () => {
		vi.mocked(getMessages).mockResolvedValue(page([message('m1', 'c1', 1_000)]));
		await store.dispatch(fetchMessages('c1'));

		store.dispatch(liveMessageReceived(message('m2', 'c1', 2_000)));

		expect(messageIds('c1')).toEqual(['m1', 'm2']);
	});

	/**
	 * A thread built from a single socket push has a hole in the middle of it
	 * that the eventual history fetch would merge around. The preview row and
	 * the unread badge carry the news instead.
	 */
	it('does not conjure a thread that has never been loaded', () => {
		store.dispatch(liveMessageReceived(message('m2', 'c2', 2_000)));

		expect(store.getState().chat.threads['c2']).toBeUndefined();
	});

	it('counts an arrival in a conversation that is not open', () => {
		store.dispatch(conversationOpened('c1'));

		store.dispatch(liveMessageReceived(message('m2', 'c2', 2_000)));

		expect(selectUnreadCount(store.getState(), 'c2')).toBe(1);
	});

	it('does not count an arrival in the conversation on screen', () => {
		store.dispatch(conversationOpened('c1'));

		store.dispatch(liveMessageReceived(message('m2', 'c1', 2_000)));

		expect(selectUnreadCount(store.getState(), 'c1')).toBe(0);
	});

	it('clears the badge when the conversation is opened', () => {
		store.dispatch(liveMessageReceived(message('m2', 'c2', 2_000)));

		store.dispatch(conversationOpened('c2'));

		expect(selectUnreadCount(store.getState(), 'c2')).toBe(0);
	});

	it('moves the conversation to the top of the list', () => {
		store.dispatch(liveMessageReceived(message('m2', 'c2', 2_000)));

		expect(selectConversations(store.getState()).map((conversation) => conversation.id)).toEqual(['c2', 'c1']);
	});
});

describe('startDirect', () => {
	it('inserts the new conversation and opens it without a refetch', async () => {
		vi.mocked(startDirectConversation).mockResolvedValue(direct('c9', 5_000));

		await store.dispatch(startDirect(PEER));

		expect(store.getState().chat.activeConversationId).toBe('c9');
	});

	it('replaces by id rather than duplicating an existing conversation', async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', 1_000)]);
		await store.dispatch(fetchConversations());
		vi.mocked(startDirectConversation).mockResolvedValue(direct('c1', 5_000));

		await store.dispatch(startDirect(PEER));

		expect(selectConversations(store.getState())).toHaveLength(1);
	});

	it('surfaces the self-chat guard as a validation failure', async () => {
		vi.mocked(startDirectConversation).mockRejectedValue(new Error('Cannot start a conversation with yourself.'));

		const result = await store.dispatch(startDirect(ME));

		expect(result.payload).toEqual({ kind: 'validation', message: 'Cannot start a conversation with yourself.' });
	});
});

describe('createGroupConversation', () => {
	it('opens the group it just created', async () => {
		const group: Conversation = { id: 'g1', type: 'group', name: 'Bletchley', createdById: ME.id, adminIds: [ME.id], participants: [ME, PEER], lastMessage: null, updatedAt: 5_000 };
		vi.mocked(createGroup).mockResolvedValue(group);

		await store.dispatch(createGroupConversation({ name: 'Bletchley', participantIds: [PEER.id] }));

		expect(store.getState().chat.activeConversationId).toBe('g1');
	});
});

describe('the unauthorized path', () => {
	it('clears the session when a thunk reports an expired token', async () => {
		vi.mocked(listConversations).mockRejectedValue(unauthorized());

		await store.dispatch(fetchConversations());

		expect(store.getState().session).toMatchObject({ token: null, user: null, status: 'anonymous' });
	});

	/**
	 * A dead token usually fails several requests at once. The listener has to
	 * be idempotent, or the user is logged out three times over and the
	 * persistence layer is written three times.
	 */
	it('clears it exactly once when several requests fail together', async () => {
		const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
		vi.mocked(listConversations).mockRejectedValue(unauthorized());
		vi.mocked(getMessages).mockRejectedValue(unauthorized());

		await Promise.all([store.dispatch(fetchConversations()), store.dispatch(fetchMessages('c1')), store.dispatch(fetchMessages('c2'))]);

		expect(removeItem).toHaveBeenCalledTimes(1);
	});

	it('leaves the session alone for a failure that is not an auth failure', async () => {
		vi.mocked(listConversations).mockRejectedValue(new ApiError({ kind: 'network', status: 0, message: 'Could not reach the server.' }));

		await store.dispatch(fetchConversations());

		expect(store.getState().session.token).toBe('jwt');
	});
});
