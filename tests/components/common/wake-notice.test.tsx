import WakeNotice from '@/components/layout/common/wake-notice';
import { makeStore, type AppStore } from '@/store';
import { wakeProbeStarted, wakeStatusChanged } from '@/store/slices/chat-slice';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

/**
 * What the reviewer actually sees.
 *
 * The first two assertions are the ones with teeth: on a warm server — which is
 * every ordinary load — this component must contribute exactly nothing to the
 * DOM. A notice that appears on every page load is noise wearing a feature's
 * clothes, and it would make the one time it matters invisible.
 */

const wrap = (store: AppStore) => ({
	wrapper: ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>,
});

/** Puts the store into a given wake state the way the hook would. */
const storeAt = (status: 'unknown' | 'waking' | 'awake' | 'unreachable', options: { viaWaking?: boolean } = {}): AppStore => {
	const store = makeStore();
	store.dispatch(wakeProbeStarted(Date.now()));
	if (options.viaWaking === true && status !== 'waking') {
		store.dispatch(wakeStatusChanged('waking'));
	}
	if (status !== 'unknown') {
		store.dispatch(wakeStatusChanged(status));
	}
	return store;
};

describe('WakeNotice — silence is the default', () => {
	it('renders nothing before any probe has completed', () => {
		const { container } = render(<WakeNotice />, wrap(storeAt('unknown')));
		expect(container).toBeEmptyDOMElement();
	});

	it('renders nothing on a warm server, which never narrated', () => {
		// Straight to `awake` with no `waking` in between — the ordinary load.
		// No wait was announced, so there is nothing to acknowledge.
		const { container } = render(<WakeNotice />, wrap(storeAt('awake')));
		expect(container).toBeEmptyDOMElement();
	});
});

describe('WakeNotice — a cold start', () => {
	it('announces politely rather than interrupting', () => {
		render(<WakeNotice />, wrap(storeAt('waking')));

		const notice = screen.getByRole('status');
		expect(notice).toHaveAttribute('aria-live', 'polite');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('names the cause instead of saying "loading"', () => {
		render(<WakeNotice />, wrap(storeAt('waking')));

		expect(screen.getByRole('status')).toHaveTextContent(/waking the demo server/i);
		expect(screen.queryByText(/^loading/i)).not.toBeInTheDocument();
	});

	it('hides the ticking counter from assistive technology', () => {
		const { container } = render(<WakeNotice />, wrap(storeAt('waking')));

		// A number read aloud every second is hostile; the escalating copy
		// carries the information instead.
		const counter = container.querySelector('[aria-hidden="true"].font-mono');
		expect(counter).not.toBeNull();
		expect(counter).toHaveTextContent(/^\d+s$/);
	});
});

describe('WakeNotice — closing the loop', () => {
	it('acknowledges the wake only when a wait was actually narrated', () => {
		render(<WakeNotice />, wrap(storeAt('awake', { viaWaking: true })));

		expect(screen.getByRole('status')).toHaveTextContent(/awake/i);
	});
});

describe('WakeNotice — unreachable is the one real error', () => {
	it('escalates to an alert with a focusable retry', async () => {
		const store = storeAt('unreachable', { viaWaking: true });
		render(<WakeNotice />, wrap(store));

		expect(screen.getByRole('alert')).toHaveTextContent(/isn’t responding/i);

		const retry = screen.getByRole('button', { name: /retry/i });
		retry.focus();
		expect(retry).toHaveFocus();

		await userEvent.click(retry);

		// The retry has to genuinely re-probe: `wakeAttempt` is `WakeBoot`'s
		// remount key, so bumping it is what re-fires the request.
		const state = store.getState().chat;
		expect(state.wakeStatus).toBe('unknown');
		expect(state.wakeAttempt).toBe(1);
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
