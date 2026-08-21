import type { WireConversationList, WireCreatedDirectConversation, WireGroupConversation, WireLoginResponse, WireMessagePage, WireRestMessage, WireUser } from '@/types/api';
import type { Conversation, Message, MessagePage, Session, User } from '@/types/chat';
import { request } from './http';
import { normalizeConversation, normalizeCreatedDirectConversation, normalizeGroupConversation, normalizeMessagePage, normalizeRestMessage, normalizeUser } from './normalize';

/**
 * The typed API surface. Every function returns a domain type — callers never
 * see a wire shape. Endpoint paths mirror the upstream Swagger; where this
 * project would have designed them differently, the rationale is recorded in
 * `docs/api/README.md` § Redesign rather than diverging from the live server.
 */

export const login = async (phone: string, name: string): Promise<Session> => {
	const wire = await request<WireLoginResponse>('/auth/login', { method: 'POST', body: { phone, name } });
	return { token: wire.token, user: normalizeUser(wire.user) };
};

export const getCurrentUser = async (token: string, signal?: AbortSignal): Promise<User> => {
	const wire = await request<WireUser>('/auth/me', { token, ...(signal === undefined ? {} : { signal }) });
	return normalizeUser(wire);
};

/**
 * Quirk: `q` is documented as required, but omitting it returns every user in
 * the database. A blank query is therefore short-circuited client-side rather
 * than dumping the directory into the search panel.
 *
 * Quirk: `q` is interpolated into a Mongo `$regex` unescaped, so a bare `+`
 * — the first character of any E.164 phone number — crashes the endpoint with
 * a 500. Regex metacharacters are stripped before the term is sent.
 */
export const searchUsers = async (query: string, token: string, signal?: AbortSignal): Promise<User[]> => {
	const term = sanitizeSearchTerm(query);
	if (term === '') {
		return [];
	}
	const wire = await request<WireUser[]>('/users/search', { token, query: { q: term }, ...(signal === undefined ? {} : { signal }) });
	return wire.map(normalizeUser);
};

/** Strips the regex metacharacters that make the upstream `$regex` throw. */
export const sanitizeSearchTerm = (query: string): string => query.trim().replace(/[.*+?^${}()|[\]\\]/g, '');

export const listConversations = async (token: string, signal?: AbortSignal): Promise<Conversation[]> => {
	const wire = await request<WireConversationList>('/conversations', { token, ...(signal === undefined ? {} : { signal }) });
	return wire.data.map(normalizeConversation);
};

/**
 * Quirk: passing your own id does not create a self-chat — it returns an
 * unrelated existing conversation that merely contains your id, which silently
 * opens the wrong thread. The guard is client-side because the server has none.
 */
export const startDirectConversation = async (peer: User, currentUserId: string, token: string): Promise<Conversation> => {
	if (peer.id === currentUserId) {
		throw new Error('Cannot start a conversation with yourself.');
	}
	const wire = await request<WireCreatedDirectConversation>('/conversations', { method: 'POST', token, body: { userId: peer.id } });
	return normalizeCreatedDirectConversation(wire, peer);
};

export const getMessages = async (conversationId: string, token: string, options: { limit?: number; before?: string; signal?: AbortSignal } = {}): Promise<MessagePage> => {
	const { limit = 30, before, signal } = options;
	const wire = await request<WireMessagePage>(`/conversations/${conversationId}/messages`, {
		token,
		query: { limit, before },
		...(signal === undefined ? {} : { signal }),
	});
	return normalizeMessagePage(wire, before);
};

/**
 * Quirk: the server accepts `""` and `"   "` with a 200. The assignment
 * requires empty messages to be unsendable, so the rule is enforced here and
 * again in the composer UI.
 */
export const sendMessage = async (conversationId: string, text: string, token: string): Promise<Message> => {
	const trimmed = text.trim();
	if (trimmed === '') {
		throw new Error('Cannot send an empty message.');
	}
	const wire = await request<WireRestMessage>('/messages', { method: 'POST', token, body: { conversationId, text: trimmed } });
	return normalizeRestMessage(wire);
};

/** Quirk: the server rejects fewer than 3 total members with a 400. */
export const createGroup = async (name: string, participantIds: string[], token: string): Promise<Conversation> => {
	const wire = await request<WireGroupConversation>('/conversations/group', { method: 'POST', token, body: { name: name.trim(), participantIds } });
	return normalizeGroupConversation(wire);
};

export const addParticipants = async (conversationId: string, userIds: string[], token: string): Promise<Conversation> => {
	const wire = await request<WireGroupConversation>(`/conversations/${conversationId}/participants`, { method: 'POST', token, body: { userIds } });
	return normalizeGroupConversation(wire);
};

/** Passing your own id is how you leave the group. */
export const removeParticipant = async (conversationId: string, userId: string, token: string): Promise<Conversation> => {
	const wire = await request<WireGroupConversation>(`/conversations/${conversationId}/participants/${userId}`, { method: 'DELETE', token });
	return normalizeGroupConversation(wire);
};

export const promoteToAdmin = async (conversationId: string, userId: string, token: string): Promise<Conversation> => {
	const wire = await request<WireGroupConversation>(`/conversations/${conversationId}/admins`, { method: 'POST', token, body: { userId } });
	return normalizeGroupConversation(wire);
};

export const renameGroup = async (conversationId: string, name: string, token: string): Promise<Conversation> => {
	const wire = await request<WireGroupConversation>(`/conversations/${conversationId}`, { method: 'PATCH', token, body: { name: name.trim() } });
	return normalizeGroupConversation(wire);
};
