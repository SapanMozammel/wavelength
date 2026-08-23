import { appendHistory, appendOptimistic, confirmOptimistic, emptyThread, failOptimistic, prependPage, receiveLive, threadMessages, type OptimisticMessage, type Thread } from '@/store/slices/chat-merge';
import type { Message, MessagePage } from '@/types/chat';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The highest-risk code in the app. Three writers mutate one list — an
 * optimistic send, a socket arrival, and a paginated history fetch — and every
 * ordering bug in a chat client lives in the seams between them.
 *
 * Written before `chat-merge.ts` existed, on purpose: each block below is a
 * failure mode named in `docs/api/quirks.md` or in the plan, pinned down while
 * the implementation was still negotiable.
 */

const CONVERSATION_ID = 'c1';

const sent = (id: string, createdAt: number): Message => ({
	id,
	conversationId: CONVERSATION_ID,
	senderId: 'u1',
	text: id,
	createdAt,
	status: 'sent',
});

const optimistic = (clientId: string, createdAt: number): OptimisticMessage => ({
	id: clientId,
	conversationId: CONVERSATION_ID,
	senderId: 'me',
	text: clientId,
	createdAt,
	status: 'sending',
	clientId,
});

const page = (messages: Message[], hasMore = false, nextCursor: string | null = null): MessagePage => ({ messages, hasMore, nextCursor });

/** A thread already holding `ids`, oldest-first, one second apart. */
const threadWith = (...messages: Message[]): Thread => appendHistory(emptyThread(), page(messages));

describe('appendOptimistic + confirmOptimistic', () => {
	it('collapses an optimistic send and its server confirmation into one message', () => {
		const withOptimistic = appendOptimistic(threadWith(sent('m0', 1_000)), optimistic('ca', 2_000));
		const confirmed = confirmOptimistic(withOptimistic, 'ca', sent('m1', 2_050));

		expect(threadMessages(confirmed).map((message) => message.id)).toEqual(['m0', 'm1']);
	});

	it('keeps the confirmed message at the index the optimistic one occupied', () => {
		const withOptimistic = appendOptimistic(threadWith(sent('m0', 1_000)), optimistic('ca', 2_000));
		const confirmed = confirmOptimistic(withOptimistic, 'ca', sent('m1', 2_050));

		expect(confirmed.orderedIds.indexOf('m1')).toBe(1);
	});

	it('drops the client-side key so a later socket echo dedupes against the server id', () => {
		const withOptimistic = appendOptimistic(threadWith(), optimistic('ca', 2_000));
		const confirmed = confirmOptimistic(withOptimistic, 'ca', sent('m1', 2_050));

		expect(confirmed.byId['ca']).toBeUndefined();
	});

	it('retains the clientId on the confirmed message so the bubble keeps a stable React key', () => {
		const withOptimistic = appendOptimistic(threadWith(), optimistic('ca', 2_000));
		const confirmed = confirmOptimistic(withOptimistic, 'ca', sent('m1', 2_050));

		expect(confirmed.byId['m1']?.clientId).toBe('ca');
	});

	it('marks an optimistic message as sending regardless of the status handed in', () => {
		const withOptimistic = appendOptimistic(threadWith(), { ...optimistic('ca', 2_000), status: 'sent' });

		expect(withOptimistic.byId['ca']?.status).toBe('sending');
	});

	it('ignores a confirmation for a clientId that is not in the thread', () => {
		const thread = threadWith(sent('m0', 1_000));

		expect(confirmOptimistic(thread, 'ghost', sent('m1', 2_000))).toBe(thread);
	});
});

describe('two concurrent sends confirmed out of order', () => {
	/**
	 * The reason `confirmOptimistic` replaces in place instead of removing and
	 * re-appending: two messages typed a second apart, whose POSTs resolve in
	 * the opposite order, must still read in the order they were typed.
	 */
	const raced = (): Thread => {
		const both = appendOptimistic(appendOptimistic(threadWith(), optimistic('ca', 2_000)), optimistic('cb', 2_100));
		const secondFirst = confirmOptimistic(both, 'cb', sent('m2', 2_400));
		return confirmOptimistic(secondFirst, 'ca', sent('m1', 2_500));
	};

	it('holds the order the user typed, not the order the server answered', () => {
		expect(raced().orderedIds).toEqual(['m1', 'm2']);
	});

	it('does not duplicate either message', () => {
		expect(threadMessages(raced())).toHaveLength(2);
	});
});

describe('receiveLive', () => {
	it('is a no-op when the id is already present, so history and socket cannot double up', () => {
		const thread = threadWith(sent('m1', 1_000), sent('m2', 2_000));

		expect(receiveLive(thread, sent('m2', 2_000))).toBe(thread);
	});

	it('does not duplicate a message it already holds', () => {
		const thread = threadWith(sent('m1', 1_000), sent('m2', 2_000));

		expect(threadMessages(receiveLive(thread, sent('m2', 2_000)))).toHaveLength(2);
	});

	it('inserts an out-of-order arrival by createdAt rather than pushing it onto the tail', () => {
		const thread = threadWith(sent('m1', 1_000), sent('m3', 3_000));

		expect(receiveLive(thread, sent('m2', 2_000)).orderedIds).toEqual(['m1', 'm2', 'm3']);
	});

	it('appends an arrival that is newer than everything held', () => {
		const thread = threadWith(sent('m1', 1_000), sent('m2', 2_000));

		expect(receiveLive(thread, sent('m3', 3_000)).orderedIds).toEqual(['m1', 'm2', 'm3']);
	});

	it('places an arrival that ties on createdAt after the existing message', () => {
		const thread = threadWith(sent('m1', 1_000), sent('m2', 2_000));

		expect(receiveLive(thread, sent('m3', 2_000)).orderedIds).toEqual(['m1', 'm2', 'm3']);
	});

	it('prepends an arrival older than everything held', () => {
		const thread = threadWith(sent('m2', 2_000), sent('m3', 3_000));

		expect(receiveLive(thread, sent('m1', 1_000)).orderedIds).toEqual(['m1', 'm2', 'm3']);
	});
});

describe('prependPage', () => {
	const tail = (): Thread => threadWith(sent('m3', 3_000), sent('m4', 4_000));

	it('puts the older page in front of the tail', () => {
		expect(prependPage(tail(), page([sent('m1', 1_000), sent('m2', 2_000)])).orderedIds).toEqual(['m1', 'm2', 'm3', 'm4']);
	});

	it('leaves the already-rendered tail untouched', () => {
		const before = tail();
		const after = prependPage(before, page([sent('m1', 1_000), sent('m2', 2_000)]));

		expect(after.byId['m4']).toBe(before.byId['m4']);
	});

	/**
	 * Quirk: `?before=X` is INCLUSIVE and returns X again as the first element.
	 * `normalizeMessagePage` already strips it; this is the belt-and-braces
	 * layer, because one duplicated message per page is invisible in review and
	 * obvious to a user.
	 */
	it('dedupes a page whose first element repeats the cursor message', () => {
		const thread = threadWith(sent('m2', 2_000), sent('m3', 3_000));

		expect(prependPage(thread, page([sent('m1', 1_000), sent('m2', 2_000)])).orderedIds).toEqual(['m1', 'm2', 'm3']);
	});

	it('keeps the copy already in the thread when the cursor message repeats', () => {
		const thread = threadWith(sent('m2', 2_000), sent('m3', 3_000));
		const after = prependPage(thread, page([sent('m1', 1_000), { ...sent('m2', 2_000), text: 'stale' }]));

		expect(after.byId['m2']?.text).toBe('m2');
	});

	it('carries the page cursor forward so the next scroll-up knows where to resume', () => {
		const after = prependPage(tail(), page([sent('m1', 1_000)], true, 'm1'));

		expect([after.hasMore, after.nextCursor]).toEqual([true, 'm1']);
	});
});

describe('failOptimistic', () => {
	it('never removes the message — a vanishing bubble reads as delivered', () => {
		const failed = failOptimistic(appendOptimistic(threadWith(sent('m0', 1_000)), optimistic('ca', 2_000)), 'ca');

		expect(failed.orderedIds).toEqual(['m0', 'ca']);
	});

	it('marks it failed so the bubble can offer a retry', () => {
		const failed = failOptimistic(appendOptimistic(threadWith(), optimistic('ca', 2_000)), 'ca');

		expect(failed.byId['ca']?.status).toBe('failed');
	});

	it('survives a retry that confirms the same clientId', () => {
		const failed = failOptimistic(appendOptimistic(threadWith(), optimistic('ca', 2_000)), 'ca');

		expect(confirmOptimistic(failed, 'ca', sent('m1', 2_400)).byId['m1']?.status).toBe('sent');
	});

	it('does not duplicate the bubble when a failed send is retried with the same clientId', () => {
		const failed = failOptimistic(appendOptimistic(threadWith(sent('m0', 1_000)), optimistic('ca', 2_000)), 'ca');

		expect(appendOptimistic(failed, optimistic('ca', 2_000)).orderedIds).toEqual(['m0', 'ca']);
	});

	it('returns a retried send to sending', () => {
		const failed = failOptimistic(appendOptimistic(threadWith(), optimistic('ca', 2_000)), 'ca');

		expect(appendOptimistic(failed, optimistic('ca', 2_000)).byId['ca']?.status).toBe('sending');
	});
});

describe('appendHistory', () => {
	it('replaces the thread contents with the page', () => {
		const reloaded = appendHistory(threadWith(sent('m9', 9_000)), page([sent('m1', 1_000), sent('m2', 2_000)]));

		expect(reloaded.orderedIds).toEqual(['m1', 'm2']);
	});

	it('marks the thread ready and clears any previous error', () => {
		const errored: Thread = { ...emptyThread(), status: 'error', error: 'boom' };
		const reloaded = appendHistory(errored, page([sent('m1', 1_000)]));

		expect([reloaded.status, reloaded.error]).toEqual(['ready', null]);
	});

	it('records the cursor for the first scroll-up', () => {
		const reloaded = appendHistory(emptyThread(), page([sent('m1', 1_000), sent('m2', 2_000)], true, 'm1'));

		expect([reloaded.hasMore, reloaded.nextCursor]).toEqual([true, 'm1']);
	});
});

describe('module boundary', () => {
	/**
	 * The merge rules are the one piece of this app that must stay testable
	 * without a store and without a renderer. Guarding it with an assertion
	 * rather than a comment, because an accidental `createSelector` import here
	 * would drag Redux into every future test of this file.
	 */
	it('imports nothing from Redux or React', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/store/slices/chat-merge.ts'), 'utf8');

		expect(source).not.toMatch(/from '(react|@reduxjs\/toolkit|react-redux|immer)'/);
	});
});
