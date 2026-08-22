import { isDifferentDay } from '@/lib/utils/time';
import type { Message, MessageRunPosition, User } from '@/types/chat';

/**
 * Turns a flat, oldest-first message list into the exact sequence of things the
 * panel renders: day separators interleaved with messages, each message already
 * carrying its run geometry, its resolved sender and whether it belongs to the
 * session user.
 *
 * This is a plain module rather than a hook on purpose. Grouping, day breaks
 * and run geometry are the logic most likely to carry an off-by-one, and they
 * are cheapest to test with no renderer in the way.
 *
 * **One pass, not three.** Day membership, run membership and sender identity
 * are all decided from the same neighbour comparison, so they are computed
 * together. Walking the array once per concern would be three times the work
 * for an array that is rebuilt on every socket arrival.
 */

/**
 * How long a silence has to be before the next message from the same person
 * starts a new visual group.
 *
 * A judgement call, not something the brief specifies — which is exactly why it
 * is a named constant with one reference. Five minutes is long enough that a
 * burst of typing stays together and short enough that "later that morning"
 * reads as a separate thought.
 */
export const RUN_WINDOW_MS = 5 * 60_000;

/**
 * What a sender who is no longer in the conversation is called.
 *
 * A group member can leave while their messages remain, and the API's `sender`
 * is a bare id with no populated variant — so an unresolvable sender is
 * reachable, not theoretical. The alternatives are both bad: a blank name reads
 * as a rendering bug, and a raw ObjectId leaks a database identifier into the UI.
 */
export const FORMER_MEMBER_NAME = 'Former member';

/** A date heading between two messages that fall on different calendar days. */
export type DayRow = {
	kind: 'day';
	key: string;
	/** An instant on that day; the formatter reduces it to a calendar date. */
	at: number;
};

/** One message, with everything the row needs to render already decided. */
export type MessageRow = {
	kind: 'message';
	key: string;
	message: Message;
	/** Drives alignment, bubble shape and colour — all three, never colour alone. */
	isOwn: boolean;
	/** `null` when the sender has left the conversation. */
	sender: User | null;
	/** Always a human-readable name, never blank and never an id. */
	senderName: string;
	/** True on the first row of a run in a thread that labels senders at all. */
	showSender: boolean;
	/** True on the last row of a run. Every message keeps its `<time>` regardless. */
	showTimestamp: boolean;
	runPosition: MessageRunPosition;
};

export type Row = DayRow | MessageRow;

export type BuildRowsInput = {
	/** Oldest-first, as `normalizeMessagePage` and the thread reducer guarantee. */
	messages: readonly Message[];
	/** Everyone who can appear as a sender. Order is irrelevant. */
	participants: readonly User[];
	/** The session user's id — the sole source of `isOwn`. */
	currentUserId: string;
	/**
	 * Group threads label each run with its sender; a direct thread never does,
	 * because the only other name in the room is already in the panel header.
	 */
	showSenderNames: boolean;
};

/** Midnight local time — the stable identity of a calendar day. */
const startOfDay = (epochMs: number): number => new Date(epochMs).setHours(0, 0, 0, 0);

/**
 * True when `message` opens a new visual group.
 *
 * A day break always terminates a run: two messages a minute apart across
 * midnight belong to different days, and a run that straddles the separator
 * would render as a group cut in half by a heading.
 */
const startsNewRun = (message: Message, previous: Message | null, startsDay: boolean): boolean =>
	previous === null || startsDay || previous.senderId !== message.senderId || message.createdAt - previous.createdAt > RUN_WINDOW_MS;

const runPositionOf = (isRunStart: boolean, isRunEnd: boolean): MessageRunPosition => {
	if (isRunStart) {
		return isRunEnd ? 'single' : 'first';
	}
	return isRunEnd ? 'last' : 'middle';
};

/**
 * Sender lookup for one conversation.
 *
 * Exported so a caller holding a stable participant list can build it once and
 * reuse it; `buildRows` builds its own when it is not given one, because the
 * cost of a handful of `Map` entries is nothing next to the risk of a caller
 * forgetting to rebuild a cached map when a member joins.
 */
export const buildParticipantMap = (participants: readonly User[]): ReadonlyMap<string, User> => new Map(participants.map((participant) => [participant.id, participant]));

export const buildRows = ({ messages, participants, currentUserId, showSenderNames }: BuildRowsInput): Row[] => {
	const byId = buildParticipantMap(participants);
	const rows: Row[] = [];

	for (let index = 0; index < messages.length; index += 1) {
		const message = messages[index];
		if (message === undefined) {
			continue;
		}

		const previous = index === 0 ? null : (messages[index - 1] ?? null);
		const next = index === messages.length - 1 ? null : (messages[index + 1] ?? null);

		const startsDay = previous === null || isDifferentDay(previous.createdAt, message.createdAt);
		if (startsDay) {
			// Keyed by the calendar day rather than by the message that happens to
			// open it: prepending an older page can put a different message first
			// on that day, and a key that moved would remount the heading.
			rows.push({ kind: 'day', key: `day-${startOfDay(message.createdAt).toString()}`, at: message.createdAt });
		}

		const isRunStart = startsNewRun(message, previous, startsDay);
		const isRunEnd = next === null || startsNewRun(next, message, isDifferentDay(message.createdAt, next.createdAt));

		const sender = byId.get(message.senderId) ?? null;
		const isOwn = message.senderId === currentUserId;

		rows.push({
			kind: 'message',
			key: `message-${message.id}`,
			message,
			isOwn,
			sender,
			senderName: sender?.name ?? FORMER_MEMBER_NAME,
			showSender: showSenderNames && isRunStart && !isOwn,
			showTimestamp: isRunEnd,
			runPosition: runPositionOf(isRunStart, isRunEnd),
		});
	}

	return rows;
};
