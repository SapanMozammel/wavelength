import { useMountEffect } from '@/hooks/use-mount-effect';
import { probeHealth } from '@/lib/api/health';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { wakeAcknowledged, wakeProbeStarted, wakeStatusChanged } from '@/store/slices/chat-slice';
import { useState } from 'react';

/**
 * The narration threshold, and the single most consequential number here.
 *
 * A warm server answers `/health` in roughly 300ms. Anything that narrates
 * before this is noise on every normal page load — and a component that cries
 * "waking the server" a hundred times a day is worse than no component at all,
 * because by the time it is telling the truth nobody reads it. 2.5s is tuned,
 * not derived: high enough to clear a warm response and a slow phone
 * connection, low enough that the reviewer is not staring at a blank panel.
 */
export const WAKE_THRESHOLD_MS = 2_500;

/** After this, stop claiming it is waking up and admit it is not answering. */
export const WAKE_BUDGET_MS = 60_000;

/** Render answers 502 while a service spins up, so a fast failure means "not yet", not "dead". */
export const WAKE_RETRY_DELAY_MS = 2_000;

/** The elapsed counter's tick. It is `aria-hidden`, so this costs nothing to a screen reader. */
export const WAKE_TICK_MS = 1_000;

/** How long the closing acknowledgement stays before it fades. */
export const WAKE_ACK_MS = 2_400;

/** The fade-out that follows it. */
export const WAKE_FADE_MS = 400;

/**
 * The escalating copy, newest boundary first.
 *
 * Naming the cause is the entire point. "Loading…" held for 45 seconds reads
 * as a bug; "the API is on a free tier that sleeps after inactivity" reads as
 * someone who knows their own infrastructure. Escalation is what makes it feel
 * like a system that is watching the clock rather than a string that got stuck.
 *
 * One line at a time, never stacked.
 */
export const WAKE_COPY = [
	{ atMs: 45_000, line: 'Almost there — free-tier cold starts can take up to a minute.' },
	{ atMs: 25_000, line: 'Still waking up. The API is on a free tier that sleeps after inactivity.' },
	{ atMs: 8_000, line: 'Waking the demo server — this takes about 30 seconds on a cold start.' },
	{ atMs: 0, line: 'Waking the demo server…' },
] as const;

/** Pure, so the escalation boundaries can be tested without a clock. */
export const wakeCopyFor = (elapsedMs: number): string => {
	const tier = WAKE_COPY.find((candidate) => elapsedMs >= candidate.atMs);
	return (tier ?? WAKE_COPY[WAKE_COPY.length - 1]).line;
};

/**
 * Fires one health probe for the whole app and reports what it finds.
 *
 * Nothing here blocks paint and nothing here gates a route: the app renders
 * immediately, and the narration appears only if the wait turns abnormal. Three
 * clocks run against each other —
 *
 * - the probe itself, retried every {@link WAKE_RETRY_DELAY_MS} while it fails,
 *   because a cold Render instance rejects a few connections before it serves;
 * - a {@link WAKE_THRESHOLD_MS} timer that promotes the status to `waking`
 *   **only if the probe has not already come back**, which is the mechanism
 *   that keeps a warm server completely silent;
 * - a {@link WAKE_BUDGET_MS} timer that gives up and says so.
 *
 * Mounted once, in `WakeBoot`. Re-running it means remounting it — see the
 * `key` in that component — so retrying never leaves two probe loops racing.
 */
export const useApiWake = (): void => {
	const dispatch = useAppDispatch();

	useMountEffect(() => {
		type Timer = ReturnType<typeof setTimeout>;

		const controller = new AbortController();
		let settled = false;
		// Held in one bag rather than three bindings so `settle` — defined
		// before the timers it has to cancel — can reach every clock without a
		// forward reference.
		const timers: { threshold?: Timer; budget?: Timer; retry?: Timer } = {};

		const stopClocks = () => {
			clearTimeout(timers.threshold);
			clearTimeout(timers.budget);
			clearTimeout(timers.retry);
		};

		const settle = (status: 'awake' | 'unreachable') => {
			if (settled) {
				return;
			}
			settled = true;
			stopClocks();
			controller.abort();
			dispatch(wakeStatusChanged(status));
		};

		timers.threshold = setTimeout(() => {
			if (!settled) {
				dispatch(wakeStatusChanged('waking'));
			}
		}, WAKE_THRESHOLD_MS);

		timers.budget = setTimeout(() => settle('unreachable'), WAKE_BUDGET_MS);

		const attempt = async (): Promise<void> => {
			let healthy = false;
			try {
				healthy = await probeHealth(controller.signal);
			} catch {
				// `AbortError` — we are unmounting or we have already settled.
				return;
			}
			if (settled || controller.signal.aborted) {
				return;
			}
			if (healthy) {
				settle('awake');
				return;
			}
			timers.retry = setTimeout(() => void attempt(), WAKE_RETRY_DELAY_MS);
		};

		dispatch(wakeProbeStarted(Date.now()));
		void attempt();

		return () => {
			settled = true;
			stopClocks();
			controller.abort();
		};
	});
};

/**
 * Milliseconds since the current probe began, ticking once a second.
 *
 * Local to whichever surface is narrating, never in the store: a value that
 * changes every second would re-render every subscriber in the app for a number
 * that is decorative. The *start time* is in the store, which is what lets a
 * surface mounted at t=10s — a visitor who lands on `/login` mid-wake — count
 * from the real beginning rather than from its own mount.
 *
 * Only ever called from a component that renders while `waking`, so the
 * interval exists exactly as long as there is something on screen using it.
 */
export const useWakeElapsed = (): number => {
	const startedAt = useAppSelector((state) => state.chat.wakeStartedAt);
	const [now, setNow] = useState(() => Date.now());

	useMountEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), WAKE_TICK_MS);
		return () => clearInterval(timer);
	});

	return startedAt === null ? 0 : Math.max(0, now - startedAt);
};

/**
 * Closes the loop: shows the acknowledgement for a beat, fades it, drops it.
 *
 * Dismissal is dispatched rather than kept local so every placement clears
 * together — one state, one story. Returns whether the notice is on its way
 * out, which is the only thing the component needs to drive the fade.
 */
export const useWakeDismissal = (): boolean => {
	const dispatch = useAppDispatch();
	const [leaving, setLeaving] = useState(false);

	useMountEffect(() => {
		const fade = setTimeout(() => setLeaving(true), WAKE_ACK_MS);
		const drop = setTimeout(() => dispatch(wakeAcknowledged()), WAKE_ACK_MS + WAKE_FADE_MS);
		return () => {
			clearTimeout(fade);
			clearTimeout(drop);
		};
	});

	return leaving;
};
