import { useApiWake, WAKE_BUDGET_MS, WAKE_RETRY_DELAY_MS, WAKE_THRESHOLD_MS, wakeCopyFor } from '@/hooks/use-api-wake';
import type { WakeStatus } from '@/lib/api/health';
import { makeStore, type AppStore } from '@/store';
import { wakeRetryRequested } from '@/store/slices/chat-slice';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cold-start probe.
 *
 * One test in this file matters more than the rest put together: **a warm
 * server must produce no narration at all.** A cold start is the exception, not
 * the norm, and a component that announces one on every page load is a
 * regression dressed up as a feature — by the time it is telling the truth,
 * nobody is reading it. `never enters "waking"` is the assertion that protects
 * that, and everything else here is downstream of it.
 */

const { probeHealth } = vi.hoisted(() => ({ probeHealth: vi.fn() }));

vi.mock('@/lib/api/health', () => ({ probeHealth }));

const wrapper = (store: AppStore) => {
	const Wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
	return Wrapper;
};

/** Records every distinct `wakeStatus` the store ever held, in order. */
const trackStatuses = (store: AppStore): WakeStatus[] => {
	const seen: WakeStatus[] = [store.getState().chat.wakeStatus];
	store.subscribe(() => {
		const status = store.getState().chat.wakeStatus;
		if (seen[seen.length - 1] !== status) {
			seen.push(status);
		}
	});
	return seen;
};

/** Advances fake time *and* flushes the promises it unblocks, inside `act`. */
const advance = async (ms: number): Promise<void> => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
};

/** A probe that answers `healthy` after `afterMs` of fake time. */
const respondsIn = (afterMs: number, healthy: boolean) => () =>
	new Promise<boolean>((resolve) => {
		setTimeout(() => resolve(healthy), afterMs);
	});

const boot = () => {
	const store = makeStore();
	const seen = trackStatuses(store);
	const view = renderHook(() => useApiWake(), { wrapper: wrapper(store) });
	return { store, seen, view };
};

beforeEach(() => {
	vi.useFakeTimers();
	probeHealth.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useApiWake — a warm server says nothing', () => {
	it('never enters "waking" when the probe answers in 300ms', async () => {
		probeHealth.mockImplementation(respondsIn(300, true));

		const { store, seen } = boot();
		await advance(300);

		expect(store.getState().chat.wakeStatus).toBe('awake');
		expect(seen).toEqual(['unknown', 'awake']);
		expect(seen).not.toContain('waking');

		// And it stays quiet: the threshold timer must have been cleared, not
		// merely out-raced. Walking past 2.5s proves nothing fires late.
		await advance(WAKE_THRESHOLD_MS * 2);
		expect(store.getState().chat.wakeStatus).toBe('awake');
		expect(seen).toEqual(['unknown', 'awake']);
	});

	it('leaves `wakeNarrated` false, so no acknowledgement is offered either', async () => {
		probeHealth.mockImplementation(respondsIn(300, true));

		const { store } = boot();
		await advance(300);

		expect(store.getState().chat.wakeNarrated).toBe(false);
	});

	it('answers just under the threshold without narrating', async () => {
		probeHealth.mockImplementation(respondsIn(WAKE_THRESHOLD_MS - 1, true));

		const { store, seen } = boot();
		await advance(WAKE_THRESHOLD_MS + 500);

		expect(store.getState().chat.wakeStatus).toBe('awake');
		expect(seen).not.toContain('waking');
	});
});

describe('useApiWake — a cold server explains itself', () => {
	it('promotes to "waking" once the probe is outstanding past the threshold', async () => {
		probeHealth.mockImplementation(respondsIn(40_000, true));

		const { store } = boot();

		await advance(WAKE_THRESHOLD_MS - 1);
		expect(store.getState().chat.wakeStatus).toBe('unknown');

		await advance(1);
		expect(store.getState().chat.wakeStatus).toBe('waking');
		expect(store.getState().chat.wakeNarrated).toBe(true);
	});

	it('records the start time so a surface mounted mid-wake counts from the real beginning', async () => {
		probeHealth.mockImplementation(respondsIn(40_000, true));

		const { store } = boot();
		await advance(0);

		expect(store.getState().chat.wakeStartedAt).toEqual(expect.any(Number));
	});

	it('resolves at 40s to "awake" and keeps `wakeNarrated` for the acknowledgement', async () => {
		probeHealth.mockImplementation(respondsIn(40_000, true));

		const { store, seen } = boot();
		await advance(40_000);

		expect(store.getState().chat.wakeStatus).toBe('awake');
		expect(seen).toEqual(['unknown', 'waking', 'awake']);
		// The acknowledgement exists precisely because narration happened.
		expect(store.getState().chat.wakeNarrated).toBe(true);
	});

	it('re-probes rather than giving up when a waking instance rejects the connection', async () => {
		// Render answers 502 or drops the socket while a service spins up. A
		// fast failure means "not yet", not "dead" — declaring `unreachable`
		// at 50ms would be the most obvious way to get this wrong.
		probeHealth.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);

		const { store } = boot();
		await advance(0);
		expect(store.getState().chat.wakeStatus).toBe('unknown');
		expect(probeHealth).toHaveBeenCalledTimes(1);

		await advance(WAKE_RETRY_DELAY_MS);
		expect(probeHealth).toHaveBeenCalledTimes(2);

		await advance(WAKE_RETRY_DELAY_MS);
		expect(store.getState().chat.wakeStatus).toBe('awake');
	});
});

describe('useApiWake — giving up honestly', () => {
	it('declares "unreachable" when nothing answers within the budget', async () => {
		probeHealth.mockImplementation(() => new Promise<boolean>(() => undefined));

		const { store, seen } = boot();

		await advance(WAKE_BUDGET_MS - 1);
		expect(store.getState().chat.wakeStatus).toBe('waking');

		await advance(1);
		expect(store.getState().chat.wakeStatus).toBe('unreachable');
		expect(seen).toEqual(['unknown', 'waking', 'unreachable']);
	});

	it('stops retrying once it has given up', async () => {
		probeHealth.mockResolvedValue(false);

		const { store } = boot();
		await advance(WAKE_BUDGET_MS);
		expect(store.getState().chat.wakeStatus).toBe('unreachable');

		const callsAtGiveUp = probeHealth.mock.calls.length;
		await advance(WAKE_RETRY_DELAY_MS * 5);
		expect(probeHealth).toHaveBeenCalledTimes(callsAtGiveUp);
	});

	it('resets to a clean slate and bumps the remount key when a retry is requested', async () => {
		probeHealth.mockImplementation(() => new Promise<boolean>(() => undefined));

		const { store } = boot();
		await advance(WAKE_BUDGET_MS);
		expect(store.getState().chat.wakeStatus).toBe('unreachable');

		act(() => {
			store.dispatch(wakeRetryRequested());
		});

		const state = store.getState().chat;
		expect(state.wakeStatus).toBe('unknown');
		expect(state.wakeStartedAt).toBeNull();
		expect(state.wakeNarrated).toBe(false);
		// `WakeBoot` renders the probe with this as its `key`, so the change is
		// what actually re-fires it — no second loop racing the first.
		expect(state.wakeAttempt).toBe(1);
	});

	it('aborts the probe and fires nothing further after unmount', async () => {
		probeHealth.mockImplementation(() => new Promise<boolean>(() => undefined));

		const { store, view } = boot();
		view.unmount();

		await advance(WAKE_BUDGET_MS * 2);
		expect(store.getState().chat.wakeStatus).toBe('unknown');
		expect(probeHealth).toHaveBeenCalledWith(expect.any(AbortSignal));
	});
});

describe('wakeCopyFor — the copy escalates with the wait', () => {
	it('opens with the shortest line', () => {
		expect(wakeCopyFor(0)).toBe('Waking the demo server…');
		expect(wakeCopyFor(7_999)).toBe('Waking the demo server…');
	});

	it('names the expected duration at 8s', () => {
		expect(wakeCopyFor(8_000)).toBe('Waking the demo server — this takes about 30 seconds on a cold start.');
		expect(wakeCopyFor(24_999)).toContain('about 30 seconds');
	});

	it('names the cause at 25s — the line that turns a bug into an explanation', () => {
		expect(wakeCopyFor(25_000)).toBe('Still waking up. The API is on a free tier that sleeps after inactivity.');
		expect(wakeCopyFor(44_999)).toContain('free tier that sleeps');
	});

	it('reassures at 45s rather than repeating itself', () => {
		expect(wakeCopyFor(45_000)).toBe('Almost there — free-tier cold starts can take up to a minute.');
		expect(wakeCopyFor(120_000)).toContain('Almost there');
	});

	it('never returns an empty line, including for nonsense input', () => {
		expect(wakeCopyFor(-1)).toBe('Waking the demo server…');
	});
});
