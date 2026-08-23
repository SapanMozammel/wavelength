import { buildRows, FORMER_MEMBER_NAME, RUN_WINDOW_MS, type DayRow, type MessageRow, type Row } from '@/lib/chat/build-rows';
import type { Message, User } from '@/types/chat';
import { describe, expect, it } from 'vitest';

/**
 * Row building is the highest-risk logic in the message panel: day separators,
 * run collapsing, run geometry and sender resolution all fall out of one pass,
 * and every one of them is an off-by-one waiting to happen. It is a plain
 * module precisely so these can be asserted with no renderer involved.
 *
 * Timestamps are built from local-time `Date` parts rather than fixed epoch
 * numbers, because day breaks are a **calendar** question — a UTC constant that
 * reads as two days in London is one day in Los Angeles, and the test would
 * pass or fail on the machine's timezone rather than on the code.
 */

const ALICE: User = { id: 'u-alice', name: 'Alice Nguyen', phone: '+15550000001' };
const BOB: User = { id: 'u-bob', name: 'Bob Marsh', phone: '+15550000002' };

/** Local wall-clock instant, so "different day" means what a reader would mean. */
const at = (day: number, hour: number, minute: number, second = 0): number => new Date(2026, 2, day, hour, minute, second).getTime();

const msg = (id: string, senderId: string, createdAt: number, text = 'hello'): Message => ({
	id,
	conversationId: 'c-1',
	senderId,
	text,
	createdAt,
	status: 'sent',
});

type BuildOptions = {
	currentUserId?: string;
	participants?: readonly User[];
	showSenderNames?: boolean;
};

const build = (messages: readonly Message[], options: BuildOptions = {}): Row[] =>
	buildRows({
		messages,
		participants: options.participants ?? [ALICE, BOB],
		currentUserId: options.currentUserId ?? ALICE.id,
		showSenderNames: options.showSenderNames ?? true,
	});

const messageRows = (rows: readonly Row[]): MessageRow[] => rows.filter((row): row is MessageRow => row.kind === 'message');
const dayRows = (rows: readonly Row[]): DayRow[] => rows.filter((row): row is DayRow => row.kind === 'day');
const positions = (rows: readonly Row[]): string[] => messageRows(rows).map((row) => row.runPosition);

describe('buildRows — day separators', () => {
	it('emits exactly one separator between two messages on different days', () => {
		const rows = build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', BOB.id, at(5, 9, 0))]);

		expect(dayRows(rows)).toHaveLength(2);
		expect(rows.map((row) => row.kind)).toEqual(['day', 'message', 'day', 'message']);
	});

	it('emits one separator for a whole day, not one per message', () => {
		const rows = build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', ALICE.id, at(4, 13, 0)), msg('m3', BOB.id, at(4, 18, 0))]);

		expect(dayRows(rows)).toHaveLength(1);
	});

	it('keys a separator by its calendar day, so a prepended older page cannot collide or churn', () => {
		const first = dayRows(build([msg('m1', BOB.id, at(4, 9, 0))]))[0];
		const later = dayRows(build([msg('m0', ALICE.id, at(4, 7, 30)), msg('m1', BOB.id, at(4, 9, 0))]))[0];

		expect(first?.key).toBe(later?.key);
	});

	it('produces no rows at all for an empty thread — no phantom separator', () => {
		expect(build([])).toEqual([]);
	});
});

describe('buildRows — run collapsing', () => {
	it('collapses three consecutive messages inside the window into one run', () => {
		const rows = build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', BOB.id, at(4, 9, 2)), msg('m3', BOB.id, at(4, 9, 4))]);

		expect(positions(rows)).toEqual(['first', 'middle', 'last']);
	});

	it('breaks the run at the first gap wider than the window, not at the span of the group', () => {
		// 9:00 -> 9:02 stays together; the six-minute silence before 9:08 does not.
		const rows = build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', BOB.id, at(4, 9, 2)), msg('m3', BOB.id, at(4, 9, 8))]);

		expect(positions(rows)).toEqual(['first', 'last', 'single']);
	});

	it('treats a gap of exactly the window as still inside the run', () => {
		const start = at(4, 9, 0);
		const rows = build([msg('m1', BOB.id, start), msg('m2', BOB.id, start + RUN_WINDOW_MS)]);

		expect(positions(rows)).toEqual(['first', 'last']);
	});

	it('splits a run across a day break even when the messages are a minute apart', () => {
		const rows = build([msg('m1', BOB.id, at(4, 23, 59, 30)), msg('m2', BOB.id, at(5, 0, 0, 30))]);

		expect(positions(rows)).toEqual(['single', 'single']);
		expect(dayRows(rows)).toHaveLength(2);
	});

	it('never collapses across senders', () => {
		const rows = build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', ALICE.id, at(4, 9, 1)), msg('m3', BOB.id, at(4, 9, 2)), msg('m4', ALICE.id, at(4, 9, 3))]);

		expect(positions(rows)).toEqual(['single', 'single', 'single', 'single']);
	});
});

describe('buildRows — name and timestamp placement', () => {
	it('shows the sender name on the run start only', () => {
		const rows = messageRows(build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', BOB.id, at(4, 9, 2)), msg('m3', BOB.id, at(4, 9, 4))]));

		expect(rows.map((row) => row.showSender)).toEqual([true, false, false]);
	});

	it('shows the visible timestamp on the run end only', () => {
		const rows = messageRows(build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', BOB.id, at(4, 9, 2)), msg('m3', BOB.id, at(4, 9, 4))]));

		expect(rows.map((row) => row.showTimestamp)).toEqual([false, false, true]);
	});

	it('never labels the session user, whose messages are identified by alignment', () => {
		const rows = messageRows(build([msg('m1', ALICE.id, at(4, 9, 0))]));

		expect(rows[0]?.showSender).toBe(false);
	});

	it('never labels a sender in a direct thread, where there is only one other person', () => {
		const rows = messageRows(build([msg('m1', BOB.id, at(4, 9, 0))], { showSenderNames: false }));

		expect(rows[0]?.showSender).toBe(false);
	});
});

describe('buildRows — identity', () => {
	it('marks only the session user as the owner', () => {
		const rows = messageRows(build([msg('m1', ALICE.id, at(4, 9, 0)), msg('m2', BOB.id, at(4, 9, 1))], { currentUserId: ALICE.id }));

		expect(rows.map((row) => row.isOwn)).toEqual([true, false]);
	});

	it('resolves a sender against the participant list', () => {
		const rows = messageRows(build([msg('m1', BOB.id, at(4, 9, 0))]));

		expect(rows[0]?.sender).toEqual(BOB);
		expect(rows[0]?.senderName).toBe(BOB.name);
	});

	it('renders a departed member as a name, never a blank or a raw id', () => {
		const rows = messageRows(build([msg('m1', 'u-gone', at(4, 9, 0))]));

		expect(rows[0]?.sender).toBeNull();
		expect(rows[0]?.senderName).toBe(FORMER_MEMBER_NAME);
		expect(rows[0]?.senderName).not.toContain('u-gone');
	});
});

describe('buildRows — keys', () => {
	it('gives every row a key unique across the whole list', () => {
		const rows = build([msg('m1', BOB.id, at(4, 9, 0)), msg('m2', BOB.id, at(4, 9, 2)), msg('m3', ALICE.id, at(5, 9, 0)), msg('m4', ALICE.id, at(5, 9, 1))]);
		const keys = rows.map((row) => row.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	it('keys a message row by its message id, so a socket echo replacing an optimistic copy remounts once', () => {
		const rows = messageRows(build([msg('m1', BOB.id, at(4, 9, 0))]));

		expect(rows[0]?.key).toContain('m1');
	});
});
