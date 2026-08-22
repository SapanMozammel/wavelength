'use client';

import { useCallback, useLayoutEffect, useRef, type RefCallback } from 'react';

/** Matches `max-h-32` on the field. Beyond this the textarea scrolls instead of growing. */
export const AUTO_GROW_MAX_PX = 128;

export type AutoGrowTextarea = {
	/** Attach to the `<textarea>`. A callback ref, so it fires exactly when the node attaches. */
	ref: RefCallback<HTMLTextAreaElement>;
	/** Puts the caret back in the field — after a send, or after a retry. */
	focus: () => void;
};

/**
 * Grows a textarea to fit its content, up to a cap, then lets it scroll.
 *
 * Height is a **DOM measurement**, not state: `scrollHeight` can only be read
 * from a laid-out element, and mirroring it into React state would re-render
 * the whole composer on every keystroke to produce a number the browser
 * already knows. So the node is held in a ref, written to directly, and React
 * never learns the height at all.
 *
 * The measurement is `reset-then-read`: `height: auto` first, because
 * `scrollHeight` of an element already sized to its content reports that size
 * and the field could then only ever grow, never shrink when text is deleted.
 *
 * `useLayoutEffect` rather than a call inside `onChange`. The two are not
 * equivalent: the draft is also cleared *programmatically* after a send, and at
 * the moment that handler runs the DOM still holds the old text. Keying off the
 * committed value covers typing, pasting, cutting and the post-send clear with
 * one rule. It lives here, in a hook, and never in a component.
 */
export const useAutoGrowTextarea = (value: string, maxHeightPx: number = AUTO_GROW_MAX_PX): AutoGrowTextarea => {
	const nodeRef = useRef<HTMLTextAreaElement | null>(null);

	const measure = useCallback(
		(node: HTMLTextAreaElement | null): void => {
			if (node === null) {
				return;
			}
			node.style.height = 'auto';
			// `box-sizing: border-box` is on globally, so `height` has to include
			// the borders that `scrollHeight` excludes. Without this the field
			// loses two pixels of content box per measurement and grows a
			// permanent scrollbar on a single line of text.
			const borders = node.offsetHeight - node.clientHeight;
			const content = node.scrollHeight + borders;
			node.style.height = `${Math.min(content, maxHeightPx).toString()}px`;
			node.style.overflowY = content > maxHeightPx ? 'auto' : 'hidden';
		},
		[maxHeightPx]
	);

	const ref = useCallback<RefCallback<HTMLTextAreaElement>>(
		(node) => {
			nodeRef.current = node;
			measure(node);
		},
		[measure]
	);

	useLayoutEffect(() => {
		measure(nodeRef.current);
	}, [value, measure]);

	const focus = useCallback((): void => {
		nodeRef.current?.focus();
	}, []);

	return { ref, focus };
};
