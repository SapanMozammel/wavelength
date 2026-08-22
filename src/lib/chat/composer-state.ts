import type { WakeStatus } from '@/lib/api/health';
import type { SocketStatus } from '@/lib/socket/client';

/**
 * What the composer is allowed to do, and what it says about it.
 *
 * A plain module rather than a hook: this is the one piece of composer
 * behaviour with real branching, and it is worth being able to test every
 * combination of socket state and wake state without a renderer.
 */

export type ComposerNotice = {
	/** One short line, shown above the field and pointed at by `aria-describedby`. */
	line: string;
	/** Whether this state also prevents sending, or is merely worth saying. */
	blocking: boolean;
};

/**
 * Sending is blocked when the socket is genuinely down, and only then.
 *
 * The nuance worth stating: a REST `POST /messages` would still succeed with
 * the socket disconnected — but every *other* participant receives the message
 * through the server's socket fan-out, so a send that appears to work while
 * nobody is on the other end is a lie told in UI. Refusing, with the reason on
 * screen, is the honest option.
 *
 * `connecting` is deliberately **not** blocking. It is the cold-start case, not
 * a failure: the API sleeps on a free tier and the first connection of a
 * session can take most of a minute (quirk 20). Locking the composer for that
 * whole window would punish the user for the server's hosting plan.
 */
export const canSendOnSocket = (socketStatus: SocketStatus): boolean => socketStatus !== 'disconnected' && socketStatus !== 'unauthorized';

/**
 * The line under the composer, or `null` for silence.
 *
 * Silence is the common case and it is deliberate. A connection indicator that
 * flashes "Connecting…" on every page load trains the user to ignore it, and by
 * the time it has something real to say nobody is reading.
 *
 * The one composed case is the cold start: `connecting` **while the health
 * probe reports `waking`** is not a network hiccup, it is a server that is
 * asleep — so it says so, in the same words the login screen and the
 * conversation list use. One state, one story.
 */
export const composerNoticeFor = (socketStatus: SocketStatus, wakeStatus: WakeStatus): ComposerNotice | null => {
	if (socketStatus === 'unauthorized') {
		return { line: 'Your session has expired. Log in again to send.', blocking: true };
	}
	if (socketStatus === 'disconnected') {
		return { line: 'Reconnecting… messages can’t be delivered right now.', blocking: true };
	}
	if (socketStatus === 'reconnecting') {
		return { line: 'Reconnecting…', blocking: false };
	}
	if (socketStatus === 'connecting' && wakeStatus === 'waking') {
		return { line: 'Waking the server…', blocking: false };
	}
	return null;
};
