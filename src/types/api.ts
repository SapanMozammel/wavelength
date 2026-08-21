/**
 * Raw wire types — the shapes the Chat API actually returns.
 *
 * These are deliberately kept separate from the domain types in `chat.ts`.
 * The API is inconsistent across transports and across endpoints (see
 * `docs/api/README.md` § Quirks), so every wire type is normalized exactly
 * once, at the boundary, in `@/lib/api/normalize`. Nothing outside that module
 * should import from this file.
 */

/** Mongo `_id` leaks through the whole REST surface. */
export type WireUser = {
	_id: string;
	name: string;
	phone: string;
	/** Present on /auth/login and /auth/me; absent from /users/search results. */
	createdAt?: string;
};

export type WireLoginResponse = {
	token: string;
	user: WireUser;
};

/**
 * REST message. Note `_id` + ISO-8601 `createdAt`, and that `conversation` /
 * `sender` are raw id strings, never populated objects.
 */
export type WireRestMessage = {
	_id: string;
	conversation: string;
	sender: string;
	text: string;
	createdAt: string;
};

/**
 * Socket `message:new` payload. The SAME logical entity as `WireRestMessage`
 * but with two different key/format choices: `id` instead of `_id`, and
 * `createdAt` as epoch milliseconds instead of an ISO string.
 */
export type WireSocketMessage = {
	id: string;
	conversation: string;
	sender: string;
	text: string;
	createdAt: number;
};

export type WireMessagePage = {
	messages: WireRestMessage[];
	hasMore: boolean;
};

/** `lastMessage` is `{}` — not `null` — for a conversation with no messages yet. */
export type WireLastMessage =
	| Record<string, never>
	| {
			text: string;
			sender: string;
			createdAt: string;
	  };

export type WireDirectConversationSummary = {
	_id: string;
	type: 'direct';
	lastMessage: WireLastMessage;
	updatedAt: string;
	/** Singular, and already resolved to a user object. */
	participant: WireUser;
};

export type WireGroupConversationSummary = {
	_id: string;
	type: 'group';
	lastMessage: WireLastMessage;
	updatedAt: string;
	name: string;
	createdBy: string;
	admins: string[];
	/** Plural, resolved to user objects. */
	participants: WireUser[];
};

export type WireConversationSummary = WireDirectConversationSummary | WireGroupConversationSummary;

export type WireConversationList = {
	data: WireConversationSummary[];
};

/**
 * `POST /conversations` returns a DIFFERENT shape from the same conversation as
 * it appears in `GET /conversations`: no `type`, no resolved participant, and
 * `participants` is an array of id strings.
 */
export type WireCreatedDirectConversation = {
	_id: string;
	participants: string[];
	createdAt: string;
};

/** `POST /conversations/group` (201) and every group mutation return this. */
export type WireGroupConversation = {
	_id: string;
	type: 'group';
	name: string;
	createdBy: string;
	admins: string[];
	participants: WireUser[];
	createdAt: string;
	updatedAt: string;
};

export type WireApiError = {
	error: {
		message: string;
		/** String codes for handled errors, numeric for leaked driver errors. */
		code: string | number;
		details?: { path: string; message: string }[];
	};
};
