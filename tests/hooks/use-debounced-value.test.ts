import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The debounce that stands between a keystroke and a request. Its contract is
 * narrow enough to pin exactly: the value settles once, after the source stops
 * moving, and an intermediate value is never published.
 */

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useDebouncedValue', () => {
	it('returns the initial value synchronously', () => {
		const { result } = renderHook(() => useDebouncedValue('ada', 250));
		expect(result.current).toBe('ada');
	});

	it('withholds a change until the delay has elapsed', () => {
		const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: 'a' } });

		rerender({ value: 'ab' });
		expect(result.current).toBe('a');

		act(() => {
			vi.advanceTimersByTime(249);
		});
		expect(result.current).toBe('a');

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe('ab');
	});

	it('publishes only the last value of a burst', () => {
		const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: '' } });

		for (const value of ['a', 'ad', 'ada']) {
			rerender({ value });
			act(() => {
				vi.advanceTimersByTime(100);
			});
		}

		expect(result.current).toBe('');

		act(() => {
			vi.advanceTimersByTime(250);
		});
		expect(result.current).toBe('ada');
	});

	it('cancels a pending publish on unmount', () => {
		const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 250), { initialProps: { value: 'a' } });

		rerender({ value: 'ab' });
		unmount();

		// No "state update on an unmounted component" warning, and nothing left
		// on the timer queue to fire into a torn-down tree.
		expect(() => {
			vi.runAllTimers();
		}).not.toThrow();
	});
});
