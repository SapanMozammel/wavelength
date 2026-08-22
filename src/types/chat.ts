/**
 * Domain types — the only chat shapes the UI is allowed to see.
 *
 * Invariants guaranteed by `@/lib/api/normalize`:
 * - every entity is keyed on `id` (never `_id`)
 * - every timestamp is epoch milliseconds (never an ISO string, never a Date)
 * - `lastMessage` is `Message | null` (never `{}`)
 * - message lists are oldest-first (the API returns newest-first)
 */

export type User = {
	id: string;
	name: string;
	phone: string;
};

export type Session = {
	token: string;
	user: User;
};

/** Delivery state for a message rendered in the list. */
export type MessageStatus = 'sending' | 'sent' | 'failed';

export type Message = {
	id: string;
	conversationId: string;
	senderId: string;
	text: string;
	/** Epoch milliseconds. */
	createdAt: number;
	status: MessageStatus;
	/**
	 * Set on optimistic messages so the server echo can replace the local copy
	 * instead of appending a duplicate.
	 */
	clientId?: string;
};

/**
 * Where a message sits inside a run of consecutive messages from one sender.
 *
 * Drives bubble corner geometry and the placement of the sender name and the
 * visible timestamp, so it is a domain-shaped enum rather than a pair of
 * booleans: `first`/`last` are not independent, and a type that can express
 * "starts a run and also ends it" as anything other than `single` invites the
 * bug where a lone message renders with two squared-off seams and no tail.
 */
export type MessageRunPosition = 'single' | 'first' | 'middle' | 'last';

export type ConversationBase = {
	id: string;
	lastMessage: Message | null;
	/** Epoch milliseconds. */
	updatedAt: number;
};

export type DirectConversation = ConversationBase & {
	type: 'direct';
	/** The other person. Always exactly one. */
	participant: User;
};

export type GroupConversation = ConversationBase & {
	type: 'group';
	name: string;
	createdById: string;
	adminIds: string[];
	participants: User[];
};

export type Conversation = DirectConversation | GroupConversation;

export type MessagePage = {
	messages: Message[];
	hasMore: boolean;
	/** Cursor to pass as `before` for the next (older) page, or null at the end. */
	nextCursor: string | null;
};

/** Display title for either conversation kind. */
export const conversationTitle = (conversation: Conversation): string => (conversation.type === 'group' ? conversation.name : conversation.participant.name);

/** Stable subtitle: phone for a direct chat, member count for a group. */
export const conversationSubtitle = (conversation: Conversation): string => (conversation.type === 'group' ? `${conversation.participants.length} members` : conversation.participant.phone);

/**
 * Everyone who can appear as a sender, for either conversation kind.
 *
 * Deliberately does **not** include the session user: a direct conversation's
 * `participant` is only the other person, and the API never returns the caller
 * in a participant list. Callers that need the full sender universe — message
 * row building, for one — append the session user themselves, which keeps the
 * "who am I" question in exactly one place instead of two.
 */
export const conversationParticipants = (conversation: Conversation): readonly User[] => (conversation.type === 'group' ? conversation.participants : [conversation.participant]);

/**
 * Lifecycle of anything fetched from the API. `ready` rather than `success`
 * because a thread that loaded zero messages is still ready to render.
 */
export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The failure kinds a chat surface can be asked to render.
 *
 * This is deliberately a structural mirror of `ApiErrorKind` in
 * `@/lib/api/errors` rather than a re-export: the domain layer must not import
 * from the API layer. `toChatError` in `chat-slice.ts` assigns an
 * `ApiErrorKind` into this type, so if the two ever drift the build breaks
 * there instead of at runtime here.
 */
export type ChatErrorKind = 'network' | 'offline' | 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'rate-limited' | 'server' | 'unknown';

/** A rejected chat thunk's payload. Never a raw driver message. */
export type ChatError = {
	kind: ChatErrorKind;
	message: string;
};
