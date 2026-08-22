'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

export type ScrollAnchor = {
	/** Attach to the scrolling element — the one with `overflow-y: auto`. */
	scrollRef: RefObject<HTMLDivElement | null>;
};

/**
 * Keeps the viewport where the reader left it when content changes above it.
 *
 * Two moments, one mechanism — both are measurements against the live DOM, so
 * both belong in a hook and never in a component:
 *
 * 1. **First content.** A thread opens at its newest message, not its oldest.
 *    Without this the panel renders scrolled to the top of history, which is
 *    the wrong end of a conversation.
 * 2. **An older page prepends.** Inserting content above the scroll position
 *    pushes everything down by the height of what was inserted, so the reader
 *    is thrown back to messages they have already read. Recording
 *    `scrollHeight` after every commit and adding the difference on the next
 *    one puts the same pixels back under the same line of text.
 *
 * The anchor is gated on the **first row's key changing**, not on the row count
 * changing. An arriving message appends at the bottom, which does not move
 * `scrollTop` at all; adding a delta for it would scroll the reader away from
 * the thing that just arrived.
 *
 * `useLayoutEffect`, not `useEffect`: the correction has to land in the same
 * frame as the DOM mutation, or the jump is painted before it is undone.
 *
 * Auto-scroll on a live arrival — and the "stay put if the reader has scrolled
 * up" rule that goes with it — lives in `use-auto-scroll`. This hook deliberately
 * handles only content appearing *above* the viewport, so the two never fight
 * over `scrollTop`.
 */
export const useScrollAnchor = (topRowKey: string | null, rowCount: number): ScrollAnchor => {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	/** The previous commit's measurements. `null` topRowKey means "nothing rendered yet". */
	const previous = useRef<{ topRowKey: string | null; scrollHeight: number }>({ topRowKey: null, scrollHeight: 0 });

	useLayoutEffect(() => {
		const element = scrollRef.current;
		if (element === null) {
			return;
		}

		const before = previous.current;

		if (before.topRowKey === null && topRowKey !== null) {
			// Opening the thread: land on the newest message.
			element.scrollTop = element.scrollHeight;
		} else if (topRowKey !== before.topRowKey && element.scrollHeight > before.scrollHeight) {
			// A page prepended: give back exactly the height that was inserted.
			element.scrollTop += element.scrollHeight - before.scrollHeight;
		}

		previous.current = { topRowKey, scrollHeight: element.scrollHeight };
		// `rowCount` is a dependency rather than a used value: an append changes
		// the height without changing the top row, and the next prepend has to
		// measure against the height that includes it.
	}, [topRowKey, rowCount]);

	return { scrollRef };
};
