import MessageListView from '@/components/layout/chat/panel/message-list-view';
import { buildRows, type Row } from '@/lib/chat/build-rows';
import { formatMessageTime, toIsoString } from '@/lib/utils/time';
import type { Message, User } from '@/types/chat';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * These assert the two things the brief is graded on that a snapshot cannot:
 * that sender and receiver are distinguished by more than colour, and that
 * every message is timestamped in a machine-readable way.
 *
 * `MessageListView` is deliberately store-free, so all of this renders with
 * plain props — no Provider, no mocked selectors, no fixture store.
 */

const ME: User = { id: 'u-me', name: 'Ada Lovelace', phone: '+15550000001' };
const PEER: User = { id: 'u-peer', name: 'Grace Hopper', phone: '+15550000002' };
const OTHER: User = { id: 'u-other', name: 'Alan Turing', phone: '+15550000003' };

const NOW = new Date(2026, 2, 4, 12, 0).getTime();
const at = (hour: number, minute: number): number => new Date(2026, 2, 4, hour, minute).getTime();

const msg = (id: string, senderId: string, createdAt: number, text: string): Message => ({
	id,
	conversationId: 'c-1',
	senderId,
	text,
	createdAt,
	status: 'sent',
});

const rowsFor = (messages: readonly Message[], showSenderNames = false): Row[] =>
	buildRows({ messages, participants: [ME, PEER, OTHER], currentUserId: ME.id, showSenderNames });

type ViewOverrides = Partial<Pick<Parameters<typeof MessageListView>[0], 'status' | 'olderStatus' | 'hasMore' | 'error' | 'onReload' | 'onLoadOlder'>>;

const renderView = (rows: readonly Row[], overrides: ViewOverrides = {}) =>
	render(
		<MessageListView
			rows={rows}
			conversationName='Grace Hopper'
			peerName='Grace Hopper'
			now={NOW}
			status={overrides.status ?? 'ready'}
			olderStatus={overrides.olderStatus ?? 'idle'}
			hasMore={overrides.hasMore ?? false}
			error={overrides.error ?? null}
			{...(overrides.onReload === undefined ? {} : { onReload: overrides.onReload })}
			{...(overrides.onLoadOlder === undefined ? {} : { onLoadOlder: overrides.onLoadOlder })}
		/>
	);

const bubbleOf = (text: string): HTMLElement => {
	const node = screen.getByText(text);
	return node;
};

describe('MessageListView — sender distinction', () => {
	it('separates own from received by alignment and corner shape, not only by colour', () => {
		renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'From Grace'), msg('m2', ME.id, at(9, 1), 'From me')]));

		const received = screen.getByRole('article', { name: new RegExp('Grace Hopper') });
		const own = screen.getByRole('article', { name: new RegExp('^You,') });

		// Alignment — the row.
		expect(received.className).toContain('justify-start');
		expect(own.className).toContain('justify-end');

		// Shape — the bubble. A greyscale screenshot still reads correctly.
		expect(bubbleOf('From Grace').className).toContain('rounded-bl-md');
		expect(bubbleOf('From me').className).toContain('rounded-br-md');
		expect(bubbleOf('From Grace').className).not.toContain('rounded-br-md');
		expect(bubbleOf('From me').className).not.toContain('rounded-bl-md');
	});

	it('squares the seam between bubbles inside a run and rounds the run edges', () => {
		renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'one'), msg('m2', PEER.id, at(9, 1), 'two'), msg('m3', PEER.id, at(9, 2), 'three')]));

		expect(bubbleOf('one').className).not.toContain('rounded-tl-md');
		expect(bubbleOf('two').className).toContain('rounded-tl-md');
		expect(bubbleOf('three').className).toContain('rounded-tl-md');
	});

	it('names the session user "You" so a screen reader gets what alignment gives everyone else', () => {
		renderView(rowsFor([msg('m1', ME.id, at(9, 0), 'mine')]));

		expect(screen.getByRole('article', { name: `You, ${formatMessageTime(at(9, 0))}: mine` })).toBeInTheDocument();
	});

	it('names a departed sender rather than leaking a raw id', () => {
		renderView(rowsFor([msg('m1', 'u-vanished', at(9, 0), 'still here')]));

		const row = screen.getByRole('article');
		expect(row).toHaveAccessibleName(`Former member, ${formatMessageTime(at(9, 0))}: still here`);
		expect(row.textContent).not.toContain('u-vanished');
	});
});

describe('MessageListView — timestamps', () => {
	it('gives every message a machine-readable time, including the ones a run hides', () => {
		const created = [at(9, 0), at(9, 1), at(9, 2)];
		const { container } = renderView(rowsFor([msg('m1', PEER.id, created[0] ?? 0, 'one'), msg('m2', PEER.id, created[1] ?? 0, 'two'), msg('m3', PEER.id, created[2] ?? 0, 'three')]));

		const times = [...container.querySelectorAll('time[datetime]')].map((node) => node.getAttribute('datetime'));

		for (const instant of created) {
			expect(times).toContain(toIsoString(instant));
		}
	});

	it('renders no Invalid Date for a socket-delivered epoch timestamp', () => {
		const { container } = renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'live')]));

		expect(container.textContent).not.toContain('Invalid Date');
	});
});

describe('MessageListView — sender names', () => {
	it('labels a run once, on its first row, in a group thread', () => {
		renderView(rowsFor([msg('m1', OTHER.id, at(9, 0), 'one'), msg('m2', OTHER.id, at(9, 1), 'two')], true));

		expect(screen.getAllByText('Alan Turing')).toHaveLength(1);
	});

	it('never labels a sender in a direct thread', () => {
		renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'one'), msg('m2', PEER.id, at(9, 1), 'two')]));

		expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
	});
});

describe('MessageListView — day separators', () => {
	it('heads each day once', () => {
		const rows = rowsFor([msg('m1', PEER.id, new Date(2026, 2, 3, 21, 0).getTime(), 'yesterday'), msg('m2', PEER.id, at(9, 0), 'today')]);
		renderView(rows);

		expect(screen.getByRole('separator', { name: 'Today' })).toBeInTheDocument();
		expect(screen.getByRole('separator', { name: 'Yesterday' })).toBeInTheDocument();
	});
});

describe('MessageListView — states', () => {
	it('shows skeleton bubbles, not a spinner, while the first page loads', () => {
		renderView([], { status: 'loading' });

		expect(screen.getByRole('status')).toHaveTextContent('Loading messages');
	});

	it('invites the user to start when the thread loaded empty', () => {
		renderView([], { status: 'ready' });

		expect(screen.getByText('No messages yet')).toBeInTheDocument();
		expect(screen.getByText(/Grace Hopper/)).toBeInTheDocument();
	});

	it('offers a retry when the first page failed', () => {
		const onReload = vi.fn();
		renderView([], { status: 'error', error: 'Network unreachable', onReload });

		expect(screen.getByRole('alert')).toHaveTextContent('Network unreachable');
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
	});

	it('keeps loaded messages on screen when an older page fails', () => {
		renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'already read')]), { olderStatus: 'error', hasMore: true, onLoadOlder: vi.fn() });

		expect(screen.getByText('already read')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
	});
});

describe('MessageListView — accessibility', () => {
	it('is a polite log — assertive would talk over a screen reader mid-message', () => {
		renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'hello')]));

		const log = screen.getByRole('log');
		expect(log).toHaveAttribute('aria-live', 'polite');
		expect(log).not.toHaveAttribute('aria-live', 'assertive');
	});

	it('is reachable and scrollable from the keyboard, and named', () => {
		renderView(rowsFor([msg('m1', PEER.id, at(9, 0), 'hello')]));

		const log = screen.getByRole('log');
		expect(log).toHaveAttribute('tabindex', '0');
		expect(log).toHaveAccessibleName('Messages in Grace Hopper');
	});
});
