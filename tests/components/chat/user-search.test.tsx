import UserSearch from '@/components/layout/chat/sidebar/user-search';
import { searchUsers, startDirectConversation } from '@/lib/api';
import { makeStore, type AppStore } from '@/store';
import { selectConversations } from '@/store/slices/chat-selectors';
import { sessionEstablished } from '@/store/slices/session-slice';
import type { Conversation, User } from '@/types/chat';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Search is where three of this API's faults meet, and each one has a UI
 * consequence that only shows up here:
 *
 * - a blank `q` returns **every user in the database**, so a blank field must
 *   not reach the network at all;
 * - you are in your own results, and starting a conversation with your own id
 *   opens an unrelated stranger's thread with a 200 — so you are filtered out,
 *   and told why when the term was your own number;
 * - the endpoint is slow, so a keystroke has to cancel the request it replaced
 *   rather than racing it.
 */

vi.mock('@/lib/api', () => ({
	// The real implementation — the `+`-stripping is part of what is under test.
	sanitizeSearchTerm: (query: string) => query.trim().replace(/[.*+?^${}()|[\]\\]/g, ''),
	searchUsers: vi.fn(),
	startDirectConversation: vi.fn(),
	listConversations: vi.fn(),
	getMessages: vi.fn(),
	sendMessage: vi.fn(),
	createGroup: vi.fn(),
}));

const ME: User = { id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const PEER: User = { id: 'u2', name: 'Grace Hopper', phone: '+15557654321' };

const createdDirect = (id: string): Conversation => ({ id, type: 'direct', participant: PEER, lastMessage: null, updatedAt: 1_700_000_000_000 });

let store: AppStore;

const renderSearch = (fallback: ReactNode = <p>Conversation list</p>) => {
	store = makeStore();
	store.dispatch(sessionEstablished({ token: 'jwt', user: ME }));
	render(
		<Provider store={store}>
			<UserSearch fallback={fallback} />
		</Provider>
	);
};

const field = () => screen.getByLabelText('Search people by name or phone number');

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(searchUsers).mockResolvedValue([]);
});

describe('UserSearch', () => {
	it('issues no request for a blank query, and none for a query that sanitizes to nothing', async () => {
		renderSearch();

		await userEvent.type(field(), '   ');
		// `+` alone is stripped by the regex-metacharacter guard, leaving an
		// empty term — which would otherwise dump the whole user directory.
		await userEvent.clear(field());
		await userEvent.type(field(), '+');

		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(searchUsers).not.toHaveBeenCalled();
		expect(screen.getByText('Conversation list')).toBeInTheDocument();
	});

	it('searches a phone number with the leading + stripped, rather than crashing the endpoint', async () => {
		vi.mocked(searchUsers).mockResolvedValue([PEER]);
		renderSearch();

		await userEvent.type(field(), '+15557654321');

		await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('15557654321', 'jwt', expect.any(AbortSignal)));
		expect(await screen.findByText(PEER.name)).toBeInTheDocument();
	});

	it('filters the signed-in user out of the results', async () => {
		vi.mocked(searchUsers).mockResolvedValue([ME, PEER]);
		renderSearch();

		await userEvent.type(field(), 'a');

		expect(await screen.findByText(PEER.name)).toBeInTheDocument();
		expect(screen.queryByText(ME.name)).not.toBeInTheDocument();
	});

	it('says "That\'s you." when the only match is your own number', async () => {
		vi.mocked(searchUsers).mockResolvedValue([ME]);
		renderSearch();

		await userEvent.type(field(), '15551234567');

		expect(await screen.findByText("That's you.")).toBeInTheDocument();
		expect(screen.queryByText('No one found')).not.toBeInTheDocument();
	});

	it('renders an empty state rather than a blank panel when nobody matches', async () => {
		vi.mocked(searchUsers).mockResolvedValue([]);
		renderSearch();

		await userEvent.type(field(), 'zzz');

		expect(await screen.findByText('No one found')).toBeInTheDocument();
	});

	it('aborts the in-flight request when the query changes again', async () => {
		const signals: AbortSignal[] = [];
		vi.mocked(searchUsers).mockImplementation(async (_query, _token, signal) => {
			if (signal !== undefined) {
				signals.push(signal);
			}
			// Never settles — the only thing that can end it is the abort.
			return new Promise<User[]>(() => undefined);
		});

		renderSearch();

		await userEvent.type(field(), 'ada');
		await waitFor(() => expect(signals).toHaveLength(1));
		expect(signals[0]?.aborted).toBe(false);

		await userEvent.type(field(), 'x');
		await waitFor(() => expect(signals).toHaveLength(2));

		expect(signals[0]?.aborted).toBe(true);
		expect(signals[1]?.aborted).toBe(false);
	});

	it('surfaces a failed search with a retry rather than an empty result set', async () => {
		vi.mocked(searchUsers).mockRejectedValue(new Error('boom'));
		renderSearch();

		await userEvent.type(field(), 'ada');

		expect(await screen.findByText('Search failed')).toBeInTheDocument();

		vi.mocked(searchUsers).mockResolvedValue([PEER]);
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

		expect(await screen.findByText(PEER.name)).toBeInTheDocument();
	});

	it('starts a direct conversation from a result and clears the query, with no refetch', async () => {
		vi.mocked(searchUsers).mockResolvedValue([PEER]);
		vi.mocked(startDirectConversation).mockResolvedValue(createdDirect('c-new'));
		renderSearch();

		await userEvent.type(field(), 'grace');
		await userEvent.click(await screen.findByRole('button', { name: /Grace Hopper/ }));

		await waitFor(() => expect(startDirectConversation).toHaveBeenCalledWith(PEER, ME.id, 'jwt'));
		// The created row is folded in from the response plus the peer already in
		// hand — `GET /conversations` is never called again.
		await waitFor(() => expect(selectConversations(store.getState()).map((entry) => entry.id)).toEqual(['c-new']));
		expect(store.getState().chat.activeConversationId).toBe('c-new');
		expect(field()).toHaveValue('');
		expect(screen.getByText('Conversation list')).toBeInTheDocument();
	});

	it('does not insert a duplicate row when the conversation already existed', async () => {
		vi.mocked(searchUsers).mockResolvedValue([PEER]);
		vi.mocked(startDirectConversation).mockResolvedValue(createdDirect('c-existing'));
		renderSearch();

		await userEvent.type(field(), 'grace');
		await userEvent.click(await screen.findByRole('button', { name: /Grace Hopper/ }));
		await waitFor(() => expect(selectConversations(store.getState())).toHaveLength(1));

		await userEvent.type(field(), 'grace');
		await userEvent.click(await screen.findByRole('button', { name: /Grace Hopper/ }));
		await waitFor(() => expect(startDirectConversation).toHaveBeenCalledTimes(2));

		expect(selectConversations(store.getState()).map((entry) => entry.id)).toEqual(['c-existing']);
	});

	it('reports a failed start against the search panel instead of silently doing nothing', async () => {
		vi.mocked(searchUsers).mockResolvedValue([PEER]);
		vi.mocked(startDirectConversation).mockRejectedValue(new Error('Cannot start a conversation with yourself.'));
		renderSearch();

		await userEvent.type(field(), 'grace');
		await userEvent.click(await screen.findByRole('button', { name: /Grace Hopper/ }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Cannot start a conversation with yourself.');
	});
});
