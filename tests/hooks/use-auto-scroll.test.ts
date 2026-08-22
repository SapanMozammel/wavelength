import { NEAR_BOTTOM_PX, useAutoScroll } from '@/hooks/use-auto-scroll';
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

/**
 * The auto-scroll rule the brief calls out by name:
 *
 * > the view should auto-scroll to the latest message by default, but should
 * > not force-scroll the user down if they've scrolled up to read earlier
 * > messages.
 *
 * That is three separate rules wearing one sentence, and conflating them is the
 * bug. These tests pin all three, plus the threshold that makes the "is the
 * reader at the bottom" question answerable at all.
 */

/** A scroll container whose metrics can be positioned exactly. */
const container = (options: { scrollHeight?: number; clientHeight?: number; scrollTop?: number } = {}) => {
	const element = document.createElement('div');
	const { scrollHeight = 1_000, clientHeight = 400 } = options;
	Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
	Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
	element.scrollTop = options.scrollTop ?? scrollHeight - clientHeight;
	return element;
};

const mount = (element: HTMLDivElement, latestId: string | null, latestIsOwn = false, rowCount = 3) => {
	const scrollRef = createRef<HTMLDivElement>();
	// The hook only ever reads this ref, so handing it the node directly is the
	// whole setup — no renderer needed to attach it.
	scrollRef.current = element;

	return renderHook((props: { latestId: string | null; latestIsOwn: boolean; rowCount: number }) => useAutoScroll({ scrollRef, ...props }), {
		initialProps: { latestId, latestIsOwn, rowCount },
	});
};

describe('useAutoScroll', () => {
	it('lands on the newest message when a thread first opens', () => {
		const element = container({ scrollTop: 0 });
		mount(element, 'm1');
		expect(element.scrollTop).toBe(element.scrollHeight);
	});

	it('follows an arrival while the reader is already at the bottom', () => {
		const element = container();
		const { rerender } = mount(element, 'm1');

		element.scrollTop = 0;
		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });

		expect(element.scrollTop).toBe(element.scrollHeight);
	});

	it('does NOT move the viewport when the reader has scrolled up', () => {
		const element = container();
		const { result, rerender } = mount(element, 'm1');

		// Scroll well away from the bottom and let the handler record it.
		element.scrollTop = 100;
		act(() => {
			result.current.onScroll();
		});

		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });

		// The whole point: the reader stays exactly where they were reading.
		expect(element.scrollTop).toBe(100);
		expect(result.current.missedCount).toBe(1);
	});

	it('counts each further arrival while the reader stays away', () => {
		const element = container();
		const { result, rerender } = mount(element, 'm1');

		element.scrollTop = 100;
		act(() => {
			result.current.onScroll();
		});

		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });
		rerender({ latestId: 'm3', latestIsOwn: false, rowCount: 5 });

		expect(result.current.missedCount).toBe(2);
		expect(element.scrollTop).toBe(100);
	});

	it('scrolls for the reader OWN message even when they had scrolled up', () => {
		const element = container();
		const { result, rerender } = mount(element, 'm1');

		element.scrollTop = 100;
		act(() => {
			result.current.onScroll();
		});

		// Sending is an explicit request to see the result, so this one overrides
		// the stay-put rule.
		rerender({ latestId: 'mine', latestIsOwn: true, rowCount: 4 });

		expect(element.scrollTop).toBe(element.scrollHeight);
		expect(result.current.missedCount).toBe(0);
	});

	it('treats a fractional scrollTop as still being at the bottom', () => {
		// A trackpad and browser zoom both leave sub-pixel values, so an equality
		// test would classify a reader who is visibly pinned to the bottom as
		// having scrolled away — and then stop following the conversation.
		const element = container({ scrollHeight: 1_000, clientHeight: 400 });
		const { result, rerender } = mount(element, 'm1');

		element.scrollTop = 600 - 0.5;
		act(() => {
			result.current.onScroll();
		});

		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });

		expect(element.scrollTop).toBe(element.scrollHeight);
		expect(result.current.missedCount).toBe(0);
	});

	it('holds position at exactly the threshold boundary', () => {
		const element = container({ scrollHeight: 1_000, clientHeight: 400 });
		const { result, rerender } = mount(element, 'm1');

		// Exactly NEAR_BOTTOM_PX away is outside the window, so this counts as away.
		element.scrollTop = 600 - NEAR_BOTTOM_PX;
		act(() => {
			result.current.onScroll();
		});

		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });

		expect(element.scrollTop).toBe(600 - NEAR_BOTTOM_PX);
		expect(result.current.missedCount).toBe(1);
	});

	it('jumps to the newest message and clears the counter on demand', () => {
		const element = container();
		const { result, rerender } = mount(element, 'm1');

		element.scrollTop = 100;
		act(() => {
			result.current.onScroll();
		});
		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });
		expect(result.current.missedCount).toBe(1);

		act(() => {
			result.current.jumpToLatest();
		});

		expect(element.scrollTop).toBe(element.scrollHeight);
		expect(result.current.missedCount).toBe(0);
	});

	it('clears the counter when the reader scrolls back down themselves', () => {
		const element = container();
		const { result, rerender } = mount(element, 'm1');

		element.scrollTop = 100;
		act(() => {
			result.current.onScroll();
		});
		rerender({ latestId: 'm2', latestIsOwn: false, rowCount: 4 });
		expect(result.current.missedCount).toBe(1);

		// Reaching the bottom is itself an acknowledgement — no click required.
		element.scrollTop = element.scrollHeight - element.clientHeight;
		act(() => {
			result.current.onScroll();
		});

		expect(result.current.missedCount).toBe(0);
	});

	it('ignores a prepended page: more rows, same newest message', () => {
		const element = container();
		const { result, rerender } = mount(element, 'm5', false, 5);

		element.scrollTop = 100;
		act(() => {
			result.current.onScroll();
		});

		// Loading older history changes the row count but not the newest id, and
		// must not be mistaken for an arrival.
		rerender({ latestId: 'm5', latestIsOwn: false, rowCount: 25 });

		expect(result.current.missedCount).toBe(0);
		expect(element.scrollTop).toBe(100);
	});
});
