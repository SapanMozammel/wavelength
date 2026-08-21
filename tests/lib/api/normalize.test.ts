import {
	normalizeConversation,
	normalizeCreatedDirectConversation,
	normalizeMessagePage,
	normalizeRestMessage,
	normalizeSocketMessage,
	normalizeUser,
} from '@/lib/api/normalize';
import type { WireConversationSummary, WireMessagePage, WireRestMessage, WireSocketMessage, WireUser } from '@/types/api';
import { describe, expect, it } from 'vitest';

/**
 * These tests are the executable half of `docs/api/README.md` § Quirks. Each
 * block names the upstream inconsistency it pins down, so a future API fix that
 * changes a shape fails loudly here instead of silently in the UI.
 */

const wireUser: WireUser = { _id: 'u1', name: 'Ada Lovelace', phone: '+15551234567' };

describe('normalizeUser', () => {
	it('renames Mongo _id to id', () => {
		expect(normalizeUser(wireUser)).toEqual({ id: 'u1', name: 'Ada Lovelace', phone: '+15551234567' });
	});
});

describe('message normalization across transports', () => {
	const rest: WireRestMessage = {
		_id: 'm1',
		conversation: 'c1',
		sender: 'u1',
		text: 'Hello',
		createdAt: '2026-08-21T16:45:37.548Z',
	};

	const socket: WireSocketMessage = {
		id: 'm1',
		conversation: 'c1',
		sender: 'u1',
		text: 'Hello',
		createdAt: Date.parse('2026-08-21T16:45:37.548Z'),
	};

	it('collapses the REST (_id + ISO string) and socket (id + epoch ms) shapes to one', () => {
		expect(normalizeRestMessage(rest)).toEqual(normalizeSocketMessage(socket));
	});

	it('always yields epoch milliseconds', () => {
		expect(normalizeRestMessage(rest).createdAt).toBe(1787330737548);
	});
});

describe('normalizeConversation', () => {
	it('maps a direct row, which carries a singular resolved participant', () => {
		const wire: WireConversationSummary = {
			_id: 'c1',
			type: 'direct',
			lastMessage: { text: 'hi', sender: 'u1', createdAt: '2026-08-21T16:45:40.226Z' },
			updatedAt: '2026-08-21T16:45:40.461Z',
			participant: wireUser,
		};

		const result = normalizeConversation(wire);
		expect(result.type).toBe('direct');
		expect(result.type === 'direct' && result.participant.id).toBe('u1');
	});

	it('maps a group row, which carries plural participants plus name and admins', () => {
		const wire: WireConversationSummary = {
			_id: 'c2',
			type: 'group',
			lastMessage: {},
			updatedAt: '2026-08-21T16:46:21.363Z',
			name: 'Wavelength Crew',
			createdBy: 'u1',
			admins: ['u1'],
			participants: [wireUser],
		};

		const result = normalizeConversation(wire);
		expect(result.type).toBe('group');
		expect(result.type === 'group' && result.adminIds).toEqual(['u1']);
	});

	it('turns the empty-object lastMessage into null rather than a blank preview', () => {
		const wire: WireConversationSummary = {
			_id: 'c2',
			type: 'group',
			lastMessage: {},
			updatedAt: '2026-08-21T16:46:21.363Z',
			name: 'Wavelength Crew',
			createdBy: 'u1',
			admins: ['u1'],
			participants: [wireUser],
		};

		expect(normalizeConversation(wire).lastMessage).toBeNull();
	});
});

describe('normalizeCreatedDirectConversation', () => {
	it('reconstitutes the stub POST response into a renderable conversation', () => {
		const result = normalizeCreatedDirectConversation({ _id: 'c1', participants: ['u0', 'u1'], createdAt: '2026-08-21T16:45:35.293Z' }, normalizeUser(wireUser));

		expect(result.type).toBe('direct');
		expect(result.type === 'direct' && result.participant.name).toBe('Ada Lovelace');
	});
});

describe('normalizeMessagePage', () => {
	const page: WireMessagePage = {
		messages: [
			{ _id: 'm3', conversation: 'c1', sender: 'u1', text: 'third', createdAt: '2026-08-21T16:45:40.226Z' },
			{ _id: 'm2', conversation: 'c1', sender: 'u1', text: 'second', createdAt: '2026-08-21T16:45:38.968Z' },
			{ _id: 'm1', conversation: 'c1', sender: 'u1', text: 'first', createdAt: '2026-08-21T16:45:37.548Z' },
		],
		hasMore: false,
	};

	it('reverses the newest-first API order into render order', () => {
		expect(normalizeMessagePage(page).messages.map((m) => m.text)).toEqual(['first', 'second', 'third']);
	});

	it('drops the cursor message, because `before` is inclusive upstream', () => {
		const result = normalizeMessagePage(page, 'm3');
		expect(result.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
	});

	it('reports no next cursor once hasMore is false', () => {
		expect(normalizeMessagePage(page).nextCursor).toBeNull();
	});

	it('points the next cursor at the oldest message when more remain', () => {
		expect(normalizeMessagePage({ ...page, hasMore: true }).nextCursor).toBe('m1');
	});
});
