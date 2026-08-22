import ConversationList from '@/components/layout/chat/sidebar/conversation-list';
import { listConversations } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import { makeStore, type AppStore } from '@/store';
import { fetchConversations } from '@/store/slices/chat-slice';
import { sessionEstablished } from '@/store/slices/session-slice';
import type { Conversation, Message, User } from '@/types/chat';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The list is a discriminated union rendered through one row component, and
 * the union is the whole risk: a `direct` row has a singular `participant` and
 * *no* `participants` field at all, so the obvious `.participants.length` read
 * is `undefined.length` and a crash. Rows go through `conversationTitle` /
 * `conversationSubtitle` instead, and these tests pin both branches.
 *
 * The error case is split deliberately. A refresh that fails after rows are on
 * screen keeps the rows: discarding conversations the user can already read in
 * order to show a retry button is a worse outcome than the failure.
 */

vi.mock('@/lib/api', () => ({
	sanitizeSearchTerm: (query: string) => query.trim(),
	searchUsers: vi.fn(),
	startDirectConversation: vi.fn(),
	listConversations: vi.fn(),
	getMessages: vi.fn(),
	sendMessage: vi.fn(),
	createGroup: vi.fn(),
}));

const ME: User = { id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const PEER: User = { id: 'u2', name: 'Grace Hopper', phone: '+15557654321' };
const THIRD: User = { id: 'u3', name: 'Katherine Johnson', phone: '+15550001111' };

const lastMessage = (conversationId: string, text: string): Message => ({ id: `${conversationId}:last`, conversationId, senderId: PEER.id, text, createdAt: 1_700_000_000_000, status: 'sent' });

const direct = (id: string, message: Message | null): Conversation => ({ id, type: 'direct', participant: PEER, lastMessage: message, updatedAt: 1_700_000_000_000 });

const group = (id: string): Conversation => ({
	id,
	type: 'group',
	name: 'Launch crew',
	createdById: ME.id,
	adminIds: [ME.id],
	participants: [ME, PEER, THIRD],
	lastMessage: lastMessage(id, 'Wheels up at nine'),
	updatedAt: 1_700_000_000_000,
});

let store: AppStore;

const renderList = (seed: Conversation[] = []) => {
	store = makeStore();
	store.dispatch(sessionEstablished({ token: 'jwt', user: ME }));
	if (seed.length > 0) {
		store.dispatch(fetchConversations.fulfilled(seed, 'seed', undefined));
	}
	render(
		<Provider store={store}>
			<ConversationList />
		</Provider>
	);
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(listConversations).mockResolvedValue([]);
});

describe('ConversationList', () => {
	it('renders the peer for a direct row and the group name for a group row', async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', lastMessage('c1', 'On my way')), group('c2')]);
		renderList();

		expect(await screen.findByText(PEER.name)).toBeInTheDocument();
		expect(screen.getByText('Launch crew')).toBeInTheDocument();
		expect(screen.getByText('On my way')).toBeInTheDocument();
		// The group's member count, from `conversationSubtitle` — never read off
		// a direct row, where the field does not exist.
		expect(screen.getByText('3 members')).toBeInTheDocument();
	});

	it('says "No messages yet" rather than leaving the preview line blank', async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', null)]);
		renderList();

		expect(await screen.findByText('No messages yet')).toBeInTheDocument();
	});

	it('narrates the wait while the list is loading', () => {
		vi.mocked(listConversations).mockImplementation(async () => new Promise<Conversation[]>(() => undefined));
		renderList();

		expect(screen.getByRole('status')).toHaveTextContent('Loading your conversations');
	});

	it('offers a retry when the first load fails', async () => {
		vi.mocked(listConversations).mockRejectedValue(new ApiError({ kind: 'server', status: 500, message: 'boom' }));
		renderList();

		expect(await screen.findByText('Could not load your conversations')).toBeInTheDocument();

		vi.mocked(listConversations).mockResolvedValue([direct('c1', null)]);
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

		expect(await screen.findByText(PEER.name)).toBeInTheDocument();
	});

	it('keeps the rows already on screen when a refresh fails', async () => {
		vi.mocked(listConversations).mockRejectedValue(new ApiError({ kind: 'network', status: 0, message: 'offline' }));
		renderList([direct('c1', lastMessage('c1', 'Still here'))]);

		// The mount refetch rejects, but nothing that was already rendered is lost.
		expect(await screen.findByRole('alert')).toBeInTheDocument();
		expect(screen.getByText(PEER.name)).toBeInTheDocument();
		expect(screen.getByText('Still here')).toBeInTheDocument();
	});

	it('invites the first conversation instead of rendering an empty box', async () => {
		vi.mocked(listConversations).mockResolvedValue([]);
		renderList();

		expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
	});

	it('opens a conversation on click and marks the row current', async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', null), group('c2')]);
		renderList();

		await userEvent.click(await screen.findByRole('button', { name: new RegExp(PEER.name) }));

		expect(store.getState().chat.activeConversationId).toBe('c1');
		await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(PEER.name) })).toHaveAttribute('aria-current', 'true'));
		expect(screen.getByRole('button', { name: /Launch crew/ })).not.toHaveAttribute('aria-current');
	});

	it('expands an unread count for assistive technology instead of showing a bare number', async () => {
		vi.mocked(listConversations).mockResolvedValue([direct('c1', lastMessage('c1', 'Ping'))]);
		renderList();
		await screen.findByText(PEER.name);

		store.dispatch({ type: 'chat/liveMessageReceived', payload: lastMessage('c1', 'Ping again') });

		expect(await screen.findByText('1 unread message')).toBeInTheDocument();
	});
});
