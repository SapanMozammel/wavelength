import type { AsyncStatus, Message, MessagePage } from '@/types/chat';

/**
 * The merge rules for one conversation's message list.
 *
 * Three sources write to this list and none of them know about each other: an
 * optimistic send fired from the composer, a `message:new` socket arrival, and
 * a page of REST history. `CLAUDE.md` states the constraint directly — whatever
 * holds the list needs **one** owner of merge order — and this module is it.
 *
 * Everything here is a pure function from `Thread` to `Thread`. No Redux, no
 * React, no `immer` assumptions: the slice assigns the returned object back
 * into its draft, and the tests import these functions with no store at all.
 * When nothing changed, the same `Thread` reference is returned so a no-op
 * socket arrival cannot re-render a list.
 */

export type Thread = {
	/** Keyed by server `id`, or by `clientId` while a send is still in flight. */
	byId: Record<string, Message>;
	/** Oldest-first — the order the list renders, so nothing sorts during render. */
	orderedIds: string[];
	hasMore: boolean;
	/** Pass as `before` to fetch the next older page, or `null` at the beginning of history. */
	nextCursor: string | null;
	status: AsyncStatus;
	/** Tracked apart from `status` so a failed page-up never blanks the loaded history. */
	olderStatus: AsyncStatus;
	error: string | null;
};

/** A locally-echoed message. `clientId` is mandatory — it is the only handle on it until the POST answers. */
export type OptimisticMessage = Message & { clientId: string };

export const emptyThread = (): Thread => ({
	byId: {},
	orderedIds: [],
	hasMore: false,
	nextCursor: null,
	status: 'idle',
	olderStatus: 'idle',
	error: null,
});

/** Materialises the list. The one place `orderedIds` becomes an array of messages. */
export const threadMessages = (thread: Thread): Message[] => thread.orderedIds.map((id) => thread.byId[id]).filter((message): message is Message => message !== undefined);

const indexById = (messages: Message[]): Record<string, Message> => Object.fromEntries(messages.map((message) => [message.id, message]));

/**
 * Local echo, appended to the tail.
 *
 * Mandatory rather than optional: the server sends no `message:new` back to the
 * author, so a client that waits for socket confirmation of its own send
 * displays nothing at all. The message is keyed by `clientId` because it has no
 * server id yet, and its status is forced to `sending` so a caller cannot hand
 * in an already-`sent` message and skip the pending state.
 *
 * Idempotent on `clientId`, because retrying a failed send re-uses it: the
 * message returns to `sending` where it already sits instead of appearing a
 * second time at the bottom of the list.
 */
export const appendOptimistic = (thread: Thread, message: OptimisticMessage): Thread => {
	const pending: Message = { ...message, id: message.clientId, status: 'sending' };
	const alreadyPresent = thread.byId[message.clientId] !== undefined;

	return {
		...thread,
		byId: { ...thread.byId, [message.clientId]: pending },
		orderedIds: alreadyPresent ? thread.orderedIds : [...thread.orderedIds, message.clientId],
	};
};

/**
 * Swaps the local echo for the server's copy **at the same array index**.
 *
 * Removing the optimistic entry and appending the confirmed one would be
 * simpler and wrong: two messages typed a second apart whose POSTs resolve out
 * of order would swap places on screen. Replacing in place is the single rule
 * that stops that.
 *
 * The `clientId` is carried onto the confirmed message so the bubble's React
 * key does not change underneath it, and the old key is dropped so a later
 * socket echo of the same message dedupes against the server id.
 */
export const confirmOptimistic = (thread: Thread, clientId: string, server: Message): Thread => {
	const index = thread.orderedIds.indexOf(clientId);
	if (index === -1) {
		return thread;
	}

	const confirmed: Message = { ...server, status: 'sent', clientId };
	const byId = { ...thread.byId, [server.id]: confirmed };
	delete byId[clientId];

	const orderedIds = [...thread.orderedIds];
	orderedIds[index] = server.id;

	return { ...thread, byId, orderedIds };
};

/**
 * Marks a send as failed and leaves it exactly where it is.
 *
 * Never removes it: a bubble that disappears on failure is indistinguishable
 * from one that was delivered, and the user has no idea their message is gone.
 * It stays put, visibly failed, retryable.
 */
export const failOptimistic = (thread: Thread, clientId: string): Thread => {
	const pending = thread.byId[clientId];
	if (pending === undefined) {
		return thread;
	}

	return { ...thread, byId: { ...thread.byId, [clientId]: { ...pending, status: 'failed' } } };
};

/**
 * Drops a failed send, at the user's explicit request.
 *
 * The `failed` guard is the whole safety of this function: it can only ever
 * remove a message that never reached the server, so there is no path by which
 * "Dismiss" deletes something another participant has already read. The control
 * is worded "Dismiss" rather than "Delete" for the same reason — this API
 * offers no message deletion, and implying otherwise would promise something
 * the product cannot do.
 *
 * Nothing calls this automatically. A failed message that vanished on its own
 * would be indistinguishable from one that was delivered.
 */
export const dismissOptimistic = (thread: Thread, clientId: string): Thread => {
	const pending = thread.byId[clientId];
	if (pending === undefined || pending.status !== 'failed') {
		return thread;
	}

	const byId = { ...thread.byId };
	delete byId[clientId];

	return { ...thread, byId, orderedIds: thread.orderedIds.filter((id) => id !== clientId) };
};

/**
 * Upper-bound binary search over `orderedIds` by `createdAt`.
 *
 * Ties land after the message already held, so a burst delivered within the
 * same millisecond keeps arrival order.
 */
const insertionIndex = (thread: Thread, createdAt: number): number => {
	let low = 0;
	let high = thread.orderedIds.length;

	while (low < high) {
		const mid = (low + high) >>> 1;
		const at = thread.byId[thread.orderedIds[mid] ?? '']?.createdAt ?? 0;
		if (at <= createdAt) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}

	return low;
};

/**
 * A `message:new` arrival from the socket.
 *
 * Dedupes by `id` first — the same message is very likely already present from
 * the REST history fetch, and both transports normalize to the same `id`.
 * Otherwise it is inserted by `createdAt` rather than pushed: sockets are not
 * required to deliver in order, and a sort-on-every-arrival would cost more
 * than a binary search on every arrival.
 */
export const receiveLive = (thread: Thread, message: Message): Thread => {
	if (thread.byId[message.id] !== undefined) {
		return thread;
	}

	const orderedIds = [...thread.orderedIds];
	orderedIds.splice(insertionIndex(thread, message.createdAt), 0, message.id);

	return { ...thread, byId: { ...thread.byId, [message.id]: message }, orderedIds };
};

/**
 * The initial history load. Replaces the thread's contents outright.
 *
 * TODO(scope-out): a send fired between mount and this page landing is
 * discarded, because the page is authoritative. Vanishingly rare in practice
 * (the composer is not reachable until the panel renders) and out of scope for
 * this plan, but it is the one case where "replaces contents" loses data.
 */
export const appendHistory = (thread: Thread, pageResult: MessagePage): Thread => ({
	...thread,
	byId: indexById(pageResult.messages),
	orderedIds: pageResult.messages.map((message) => message.id),
	hasMore: pageResult.hasMore,
	nextCursor: pageResult.nextCursor,
	status: 'ready',
	error: null,
});

/**
 * An older page, prepended.
 *
 * Quirk: the `before` cursor is INCLUSIVE, so the first element of every page
 * after the first is a message the thread already holds. `normalizeMessagePage`
 * strips it at the boundary; this dedupe is the second layer, and it keeps the
 * copy already on screen rather than the one just fetched — the resident copy
 * may carry a `clientId` that a bubble is keyed on.
 */
export const prependPage = (thread: Thread, pageResult: MessagePage): Thread => {
	const incoming = pageResult.messages.filter((message) => thread.byId[message.id] === undefined);

	return {
		...thread,
		byId: { ...indexById(incoming), ...thread.byId },
		orderedIds: [...incoming.map((message) => message.id), ...thread.orderedIds],
		hasMore: pageResult.hasMore,
		nextCursor: pageResult.nextCursor,
		olderStatus: 'ready',
		error: null,
	};
};
