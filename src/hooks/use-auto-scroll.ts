'use client';

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * How close to the bottom still counts as "pinned there".
 *
 * A threshold rather than an equality test, and that is the whole trick. A
 * trackpad leaves fractional `scrollTop` values, and browser zoom leaves
 * sub-pixel ones, so `scrollTop + clientHeight === scrollHeight` is false for a
 * reader who is visibly at the bottom — and they then get treated as though
 * they had scrolled away.
 */
export const NEAR_BOTTOM_PX = 80;

export type AutoScroll = {
	/** Attach to the scrolling element. */
	onScroll: () => void;
	/** Messages that arrived while the reader was reading something else. */
	missedCount: number;
	/** Jump to the newest message and clear the counter. */
	jumpToLatest: () => void;
};

type UseAutoScrollArgs = {
	scrollRef: RefObject<HTMLDivElement | null>;
	/** Total rows rendered — the signal that something was appended. */
	rowCount: number;
	/** Id of the newest message, so an append can be told from a re-render. */
	latestId: string | null;
	/** Whether the newest message is the reader's own. */
	latestIsOwn: boolean;
};

/**
 * The auto-scroll rule the brief calls out by name: follow the conversation by
 * default, but never yank a reader who has scrolled up to read history.
 *
 * Three triggers, three different answers, and conflating them is the bug:
 *
 * | what happened | what should happen |
 * |---|---|
 * | reader is near the bottom, a message arrives | scroll |
 * | reader has scrolled up, a message arrives | **stay put**, count it |
 * | the reader sent it | scroll regardless — sending is an explicit request to see the result |
 *
 * `isNearBottom` lives in a **ref**, updated by a passive scroll listener, and
 * is mirrored into state only when the pill's visibility actually changes.
 * Storing it as state outright would re-render the entire message list on every
 * frame of a scroll.
 */
export const useAutoScroll = ({ scrollRef, rowCount, latestId, latestIsOwn }: UseAutoScrollArgs): AutoScroll => {
	const isNearBottom = useRef(true);
	const lastSeenId = useRef<string | null>(null);
	const [missedCount, setMissedCount] = useState(0);

	const measure = useCallback((): boolean => {
		const element = scrollRef.current;
		if (element === null) {
			return true;
		}
		return element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
	}, [scrollRef]);

	const onScroll = useCallback(() => {
		const near = measure();
		isNearBottom.current = near;
		if (near) {
			// Reaching the bottom is itself an acknowledgement.
			setMissedCount((current) => (current === 0 ? current : 0));
		}
	}, [measure]);

	const jumpToLatest = useCallback(() => {
		const element = scrollRef.current;
		if (element !== null) {
			element.scrollTop = element.scrollHeight;
		}
		isNearBottom.current = true;
		setMissedCount(0);
	}, [scrollRef]);

	useLayoutEffect(() => {
		const element = scrollRef.current;
		if (element === null || latestId === null) {
			return;
		}

		const isFirstPaint = lastSeenId.current === null;
		const isNewArrival = lastSeenId.current !== latestId;
		lastSeenId.current = latestId;

		if (!isNewArrival) {
			return;
		}

		// Opening a thread lands at the newest message; so does anything the
		// reader sent; so does anything arriving while they are already at the
		// bottom. Everything else leaves the viewport exactly where it was.
		if (isFirstPaint || latestIsOwn || isNearBottom.current) {
			element.scrollTop = element.scrollHeight;
			isNearBottom.current = true;
			setMissedCount(0);
			return;
		}

		setMissedCount((current) => current + 1);
		// `rowCount` participates so a prepended page cannot be mistaken for an
		// arrival: it changes the count without changing the newest id.
	}, [latestId, latestIsOwn, rowCount, scrollRef]);

	return { onScroll, missedCount, jumpToLatest };
};
