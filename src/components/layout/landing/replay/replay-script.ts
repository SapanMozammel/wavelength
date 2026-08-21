import type { Message, MessageStatus, User } from '@/types/chat';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Midnight at the start of the calendar day containing `ms`. */
const startOfDay = (ms: number): number => new Date(ms).setHours(0, 0, 0, 0);

/**
 * A wall-clock time on the previous calendar day.
 *
 * The older half of the transcript is anchored this way rather than by a plain
 * "hours ago" offset, because an offset large enough to guarantee a different
 * calendar day can also straddle midnight and split one exchange across two
 * separators. Anchoring to yesterday evening pins both lines to the same day
 * whatever time the page is rendered.
 */
const yesterdayAt = (now: number, hour: number, minute: number): number => startOfDay(now) - DAY + hour * HOUR + minute * MINUTE;

export const REPLAY_CONVERSATION_ID = 'replay-towpath';

/** The other side of the conversation. A real-shaped `User`, not a stub. */
export const REPLAY_PEER: User = { id: 'replay-peer', name: 'Priya Raman', phone: '+15551230134' };

/** The reader's stand-in, so the transcript has a sent side and a received side. */
export const REPLAY_SELF: User = { id: 'replay-self', name: 'You', phone: '+15551230199' };

type ScriptLine = {
	from: 'peer' | 'self';
	text: string;
	/** Resolves this line's timestamp against the render clock. */
	at: (now: number) => number;
	/** Defaults to `sent`; the last line is deliberately still in flight. */
	status?: MessageStatus;
};

/**
 * The transcript, written to exercise the three things the message list has to
 * get right rather than to sell anything:
 *
 * - **A day separator.** The first two lines are pinned to yesterday evening,
 *   so they fall on a different calendar day from the rest no matter what time
 *   the page is rendered — and on the *same* day as each other.
 * - **Run grouping.** Priya sends three in a row, then two come back the other
 *   way — so consecutive-sender collapsing is visible on both sides.
 * - **Delivery state.** The final line is still `sending`, because the API
 *   never echoes your own message back over the socket and the local echo is
 *   therefore load-bearing rather than cosmetic.
 */
const SCRIPT: ScriptLine[] = [
	{ from: 'peer', text: 'Are we still on for the 7am ride tomorrow?', at: (now) => yesterdayAt(now, 20, 41) },
	{ from: 'self', text: 'Yes. Meet at the bridge.', at: (now) => yesterdayAt(now, 21, 6) },
	{ from: 'peer', text: "I'm on the towpath.", at: (now) => now - 9 * MINUTE },
	{ from: 'peer', text: 'Bridge in about four minutes.', at: (now) => now - 8 * MINUTE - 30_000 },
	{ from: 'peer', text: "Bring the pump — mine's dead.", at: (now) => now - 8 * MINUTE },
	{ from: 'self', text: "Pump's in the bag.", at: (now) => now - 6 * MINUTE },
	{ from: 'self', text: 'Two minutes out.', at: (now) => now - 5 * MINUTE },
	{ from: 'peer', text: 'I can see you.', at: (now) => now - 2 * MINUTE },
	{ from: 'self', text: 'Wave, then.', at: (now) => now - 4_000, status: 'sending' },
];

/**
 * The transcript as real `Message` values.
 *
 * Typed against the domain type on purpose: if `Message` changes shape, this
 * fails to compile instead of quietly rendering something wrong on the page
 * that is supposed to be showing the product off.
 *
 * Timestamps are computed from the render clock rather than frozen into the
 * data, so the conversation never reads as a screenshot taken months ago.
 */
export const buildReplayScript = (now: number = Date.now()): Message[] =>
	SCRIPT.map((line, index) => ({
		id: `replay-${index.toString()}`,
		conversationId: REPLAY_CONVERSATION_ID,
		senderId: line.from === 'self' ? REPLAY_SELF.id : REPLAY_PEER.id,
		text: line.text,
		createdAt: line.at(now),
		status: line.status ?? 'sent',
	}));

/** Sender lookup for the transcript, used by the rendered panel and its summary. */
export const replaySenderName = (senderId: string): string => (senderId === REPLAY_SELF.id ? REPLAY_SELF.name : REPLAY_PEER.name);

/**
 * The clock the server-rendered transcript is anchored to.
 *
 * Read once at module load rather than inside the component body: `Date.now()`
 * during render is an impure call, and a value that can differ between two
 * renders of the same tree is exactly the instability that rule guards against.
 * For a statically prerendered page, module load *is* render time.
 */
export const REPLAY_RENDERED_AT = Date.now();

/** The transcript as the server renders it. */
export const REPLAY_MESSAGES: Message[] = buildReplayScript(REPLAY_RENDERED_AT);
