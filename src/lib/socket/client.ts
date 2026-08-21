import { env } from '@/lib/env';
import type { WireSocketMessage } from '@/types/api';
import { io, type Socket } from 'socket.io-client';

/**
 * Socket.io transport for live message delivery.
 *
 * Two things about this server drive the design:
 *
 * 1. The socket lives at the server ROOT, not under the `/api` REST base.
 *    Pointing it at the REST base fails silently — hence the separate
 *    `NEXT_PUBLIC_SOCKET_URL`.
 * 2. The sender does NOT receive their own `message:new` echo. Only other
 *    participants do. Any local-echo strategy therefore has to come from the
 *    client, never from waiting on the socket.
 */

export type ServerToClientEvents = {
	'message:new': (payload: WireSocketMessage) => void;
	'conversation:updated': (payload: { _id: string }) => void;
};

export type ClientToServerEvents = {
	'message:send': (payload: { conversationId: string; text: string }, ack?: (response: { ok: boolean; error?: string }) => void) => void;
};

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unauthorized';

/**
 * Creates a connected socket. The caller owns the lifecycle and must call
 * `.close()`; nothing here is a singleton, so a token change produces a clean
 * new connection rather than a half-authenticated old one.
 */
export const createChatSocket = (token: string): ChatSocket =>
	io(env.NEXT_PUBLIC_SOCKET_URL, {
		auth: { token },
		transports: ['websocket'],
		// The demo API is on a free tier that cold-starts; give it room to wake
		// up rather than surfacing a failure the user cannot act on.
		reconnectionAttempts: 12,
		reconnectionDelay: 1_000,
		reconnectionDelayMax: 10_000,
		timeout: 20_000,
	});

/** An invalid token is reported through `connect_error`, not a dedicated event. */
export const isAuthError = (error: Error): boolean => error.message.toLowerCase().includes('token');
