import NewGroupDialog from '@/components/layout/chat/sidebar/new-group-dialog';
import { createGroup, searchUsers } from '@/lib/api';
import { makeStore, type AppStore } from '@/store';
import { sessionEstablished } from '@/store/slices/session-slice';
import type { Conversation, User } from '@/types/chat';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The server rejects a group with fewer than three members and answers with a
 * 400 worded for a developer. Both halves of that rule — a name, and two other
 * people — are therefore enforced here, before anything is sent, with the
 * reason on screen rather than in a tooltip or a round trip.
 */

vi.mock('@/lib/api', () => ({
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
const THIRD: User = { id: 'u3', name: 'Katherine Johnson', phone: '+15550001111' };

const created: Conversation = {
	id: 'g1',
	type: 'group',
	name: 'Launch crew',
	createdById: ME.id,
	adminIds: [ME.id],
	participants: [ME, PEER, THIRD],
	lastMessage: null,
	updatedAt: 1_700_000_000_000,
};

let store: AppStore;
const onOpenChange = vi.fn();

const renderDialog = () => {
	store = makeStore();
	store.dispatch(sessionEstablished({ token: 'jwt', user: ME }));
	render(
		<Provider store={store}>
			<NewGroupDialog open onOpenChange={onOpenChange} />
		</Provider>
	);
};

const nameField = () => screen.getByLabelText('Group name');
const searchField = () => screen.getByLabelText('Add people');
const submit = () => screen.getByRole('button', { name: /create group/i });

const pick = async (user: User) => {
	await userEvent.clear(searchField());
	await userEvent.type(searchField(), user.name);
	await userEvent.click(await screen.findByLabelText(new RegExp(user.name)));
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(searchUsers).mockImplementation(async (query: string) => [PEER, THIRD].filter((user) => user.name.toLowerCase().includes(query.toLowerCase())));
	vi.mocked(createGroup).mockResolvedValue(created);
});

describe('NewGroupDialog', () => {
	it('refuses to submit without a name, and says which half is missing', async () => {
		renderDialog();
		await pick(PEER);
		await pick(THIRD);

		expect(submit()).toBeDisabled();
		expect(screen.getByText('Give the group a name.')).toBeInTheDocument();
		expect(submit()).toHaveAccessibleDescription('Give the group a name.');
	});

	it('refuses to submit with only one other person selected', async () => {
		renderDialog();
		await userEvent.type(nameField(), 'Launch crew');
		await pick(PEER);

		expect(submit()).toBeDisabled();
		expect(submit()).toHaveAccessibleDescription('Pick at least 2 people. A group needs three members, including you.');
		expect(createGroup).not.toHaveBeenCalled();
	});

	it('shows each selection as a chip that can be taken back', async () => {
		renderDialog();
		await userEvent.type(nameField(), 'Launch crew');
		await pick(PEER);
		await pick(THIRD);

		expect(submit()).toBeEnabled();

		await userEvent.click(screen.getByRole('button', { name: `Remove ${THIRD.name}` }));

		expect(submit()).toBeDisabled();
		expect(screen.queryByRole('button', { name: `Remove ${THIRD.name}` })).not.toBeInTheDocument();
	});

	it('creates the group and closes once both rules are met', async () => {
		renderDialog();
		await userEvent.type(nameField(), '  Launch crew  ');
		await pick(PEER);
		await pick(THIRD);
		await userEvent.click(submit());

		// Trimmed name, ids only — the creator is never sent, the server adds them.
		await waitFor(() => expect(createGroup).toHaveBeenCalledWith('Launch crew', [PEER.id, THIRD.id], 'jwt'));
		await waitFor(() => expect(store.getState().chat.conversations.byId['g1']).toBeDefined());
		expect(store.getState().chat.activeConversationId).toBe('g1');
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('keeps the dialog open and explains a failed create', async () => {
		vi.mocked(createGroup).mockRejectedValue(new Error('Group must have at least 3 participants'));
		renderDialog();
		await userEvent.type(nameField(), 'Launch crew');
		await pick(PEER);
		await pick(THIRD);
		await userEvent.click(submit());

		expect(await screen.findByRole('alert')).toHaveTextContent('Group must have at least 3 participants');
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});
});
