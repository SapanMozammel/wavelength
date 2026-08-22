'use client';

import { useMountEffect } from '@/hooks/use-mount-effect';
import { normalizeSocketMessage } from '@/lib/api/normalize';
import { createChatSocket, isAuthError } from '@/lib/socket/client';
import { useAppDispatch } from '@/store/hooks';
import { fetchConversations, liveMessageReceived, socketStatusChanged } from '@/store/slices/chat-slice';

/**
 * Owns the socket connection for the whole app.
 *
 * Mounted once, under a `key` on the session token: a token change remounts and
 * builds a clean connection rather than trying to re-authenticate one in place.
 * That is deliberate — `createChatSocket` returns a fresh instance for exactly
 * this reason, and a half-authenticated socket is worse than no socket.
 *
 * Two facts about this server shape everything here:
 *
 * - The socket lives at the **origin root**, not under the `/api` REST base.
 *   Pointing it at the base fails silently and forever.
 * - **The sender receives no echo of their own message.** Only other
 *   participants get `message:new`, and the send ack carries no message body.
 *   So the socket is never the source of truth for your own send — that is the
 *   composer's local echo — and nothing here waits on it.
 *
 * `message:new` also arrives in a different shape from REST: `id` rather than
 * `_id`, epoch milliseconds rather than ISO. `normalizeSocketMessage` is the
 * only thing that knows that.
 */
export const useChatSocket = (token: string): void => {
	const dispatch = useAppDispatch();

	useMountEffect(() => {
		const socket = createChatSocket(token);
		dispatch(socketStatusChanged('connecting'));

		let refetchTimer: ReturnType<typeof setTimeout> | null = null;

		socket.on('connect', () => {
			dispatch(socketStatusChanged('connected'));
		});

		socket.on('disconnect', () => {
			dispatch(socketStatusChanged('disconnected'));
		});

		socket.io.on('reconnect_attempt', () => {
			dispatch(socketStatusChanged('reconnecting'));
		});

		socket.on('connect_error', (error: Error) => {
			// An invalid token is reported here, not through a dedicated event.
			// Routing it to `unauthorized` lets the store's single listener clear
			// the session, rather than the socket deciding to log anyone out.
			dispatch(socketStatusChanged(isAuthError(error) ? 'unauthorized' : 'reconnecting'));
		});

		socket.on('message:new', (payload) => {
			dispatch(liveMessageReceived(normalizeSocketMessage(payload)));
		});

		socket.on('conversation:updated', () => {
			// The payload is only `{ _id }`, so a refetch is the reliable response.
			// Debounced because a group edit can fire several in a burst.
			if (refetchTimer !== null) {
				clearTimeout(refetchTimer);
			}
			refetchTimer = setTimeout(() => {
				void dispatch(fetchConversations());
			}, 300);
		});

		return () => {
			if (refetchTimer !== null) {
				clearTimeout(refetchTimer);
			}
			socket.removeAllListeners();
			socket.close();
		};
	});
};
