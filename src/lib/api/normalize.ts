import type { WireConversationSummary, WireCreatedDirectConversation, WireGroupConversation, WireLastMessage, WireMessagePage, WireRestMessage, WireSocketMessage, WireUser } from '@/types/api';
import type { Conversation, Message, MessagePage, User } from '@/types/chat';

/**
 * The boundary layer. Every wire shape becomes a domain shape here and nowhere
 * else, so the rest of the app never sees `_id`, never branches on whether a
 * timestamp is a string or a number, and never guards against `lastMessage`
 * being an empty object.
 *
 * Each function below names the specific API inconsistency it absorbs; see
 * `docs/api/README.md` § Quirks for the full catalogue and the evidence.
 */

/** Quirk: Mongo `_id` is exposed verbatim across the REST surface. */
export const normalizeUser = (wire: WireUser): User => ({
	id: wire._id,
	name: wire.name,
	phone: wire.phone,
});

/**
 * Quirk: the same message arrives as `_id` + ISO-8601 over REST and as `id` +
 * epoch-milliseconds over the socket. Both collapse to `id` + epoch ms here,
 * which is what makes REST history and socket pushes mergeable at all.
 */
export const normalizeRestMessage = (wire: WireRestMessage): Message => ({
	id: wire._id,
	conversationId: wire.conversation,
	senderId: wire.sender,
	text: wire.text,
	createdAt: Date.parse(wire.createdAt),
	status: 'sent',
});

export const normalizeSocketMessage = (wire: WireSocketMessage): Message => ({
	id: wire.id,
	conversationId: wire.conversation,
	senderId: wire.sender,
	text: wire.text,
	createdAt: wire.createdAt,
	status: 'sent',
});

/**
 * Quirk: a conversation with no messages carries `lastMessage: {}` rather than
 * `null`, so a naive `lastMessage.text` read yields `undefined` and renders as
 * a blank preview row.
 */
const normalizeLastMessage = (wire: WireLastMessage, conversationId: string): Message | null => {
	if (!('text' in wire)) {
		return null;
	}
	return {
		id: `${conversationId}:last`,
		conversationId,
		senderId: wire.sender,
		text: wire.text,
		createdAt: Date.parse(wire.createdAt),
		status: 'sent',
	};
};

/**
 * Quirk: `GET /conversations` is a discriminated union in all but name — a
 * `direct` row has a singular resolved `participant`, a `group` row has plural
 * `participants` plus `name`/`admins`/`createdBy`. Reading `participants` on a
 * direct row is `undefined`, which is the classic crash here.
 */
export const normalizeConversation = (wire: WireConversationSummary): Conversation => {
	const base = {
		id: wire._id,
		lastMessage: normalizeLastMessage(wire.lastMessage, wire._id),
		updatedAt: Date.parse(wire.updatedAt),
	};

	if (wire.type === 'group') {
		return {
			...base,
			type: 'group',
			name: wire.name,
			createdById: wire.createdBy,
			adminIds: wire.admins,
			participants: wire.participants.map(normalizeUser),
		};
	}

	return { ...base, type: 'direct', participant: normalizeUser(wire.participant) };
};

export const normalizeGroupConversation = (wire: WireGroupConversation): Conversation => ({
	id: wire._id,
	type: 'group',
	name: wire.name,
	createdById: wire.createdBy,
	adminIds: wire.admins,
	participants: wire.participants.map(normalizeUser),
	lastMessage: null,
	updatedAt: Date.parse(wire.updatedAt),
});

/**
 * Quirk: `POST /conversations` returns a stub — no `type`, no resolved
 * participant, `participants` as bare id strings — so the freshly created
 * conversation cannot be rendered in the list from its own response. The peer
 * the caller already has in hand is folded back in to reconstitute a full
 * `DirectConversation` without a second round trip.
 */
export const normalizeCreatedDirectConversation = (wire: WireCreatedDirectConversation, peer: User): Conversation => ({
	id: wire._id,
	type: 'direct',
	participant: peer,
	lastMessage: null,
	updatedAt: Date.parse(wire.createdAt),
});

/**
 * Quirks, two of them:
 *
 * 1. History comes back newest-first; the UI renders oldest-first, so the page
 *    is reversed here rather than at every call site.
 * 2. The `before` cursor is INCLUSIVE — `?before=X` returns X again as the
 *    first element. Left alone this duplicates one message per page load, so
 *    the cursor message is dropped when one was supplied.
 */
export const normalizeMessagePage = (wire: WireMessagePage, cursor?: string): MessagePage => {
	const ascending = [...wire.messages].reverse().map(normalizeRestMessage);
	const deduped = cursor === undefined ? ascending : ascending.filter((message) => message.id !== cursor);
	const oldest = deduped.at(0) ?? ascending.at(0);

	return {
		messages: deduped,
		hasMore: wire.hasMore,
		nextCursor: wire.hasMore && oldest !== undefined ? oldest.id : null,
	};
};
