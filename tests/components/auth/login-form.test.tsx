import LoginForm from '@/components/layout/auth/login-form';
import { ApiError } from '@/lib/api/errors';
import { makeStore } from '@/store';
import { SESSION_STORAGE_KEY } from '@/store/slices/session-slice';
import type { Session } from '@/types/chat';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The login form is the only place a phone number enters this system, and the
 * only place quirk 14 (login *is* rename) can be surfaced to a user. These
 * tests pin the two invariants that make it safe:
 *
 * 1. What is displayed and what is sent are different strings — the field shows
 *    grouped digits, the request carries E.164. `/users/search` substring-
 *    matches the stored string, so sending display format would create an
 *    account nobody could ever find, with no error from any request.
 * 2. Nothing reaches the network until the client has agreed it could work.
 *    The API validates nothing, so this form is the only gate.
 */

const { replace, login } = vi.hoisted(() => ({ replace: vi.fn(), login: vi.fn() }));

vi.mock('next/navigation', () => ({
	useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({ login }));

const SESSION: Session = { token: 'jwt-token', user: { id: 'u1', name: 'Ada', phone: '+15551234567' } };

const persist = (session: Session) => localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

const renderForm = () => {
	const store = makeStore();
	render(
		<Provider store={store}>
			<LoginForm />
		</Provider>
	);
	return store;
};

const phoneField = () => screen.getByLabelText('Phone number');
const nameField = () => screen.getByLabelText('Display name');
const submitButton = () => screen.getByRole('button', { name: /continue/i });

beforeEach(() => {
	localStorage.clear();
	replace.mockReset();
	login.mockReset();
	login.mockResolvedValue(SESSION);
});

describe('LoginForm', () => {
	it('blocks an empty submit and names both missing fields', async () => {
		renderForm();
		await userEvent.click(submitButton());

		expect(await screen.findByText('Enter your phone number.')).toBeInTheDocument();
		expect(screen.getByText('Enter the name other people will see.')).toBeInTheDocument();
		expect(login).not.toHaveBeenCalled();
	});

	it('refuses a number with no country code before any request is made', async () => {
		renderForm();
		await userEvent.type(phoneField(), '5551234567');
		await userEvent.type(nameField(), 'Ada');
		await userEvent.click(submitButton());

		expect(await screen.findByText('Include the country code, like +1 555 123 4567.')).toBeInTheDocument();
		expect(login).not.toHaveBeenCalled();
	});

	it('marks the field it rejected, so the error is not a guessing game', async () => {
		renderForm();
		await userEvent.type(phoneField(), '5551234567');
		await userEvent.click(submitButton());

		await waitFor(() => expect(phoneField()).toHaveAttribute('aria-invalid', 'true'));
		expect(phoneField()).toHaveAccessibleDescription(/include the country code/i);
	});

	it('sends E.164 even though the field shows a grouped number', async () => {
		const store = renderForm();
		await userEvent.type(phoneField(), '+15551234567');
		await userEvent.type(nameField(), 'Ada');

		// Formatted for the eye…
		expect(phoneField()).toHaveValue('+1 555 123 4567');

		await userEvent.click(submitButton());

		// …canonical for the wire.
		await waitFor(() => expect(login).toHaveBeenCalledWith('+15551234567', 'Ada'));
		await waitFor(() => expect(store.getState().session.status).toBe('authenticated'));
		expect(store.getState().session.token).toBe('jwt-token');
		expect(replace).toHaveBeenCalledWith('/chat');
	});

	it('surfaces a server validation error against the field the API blamed', async () => {
		login.mockRejectedValue(
			new ApiError({
				kind: 'validation',
				status: 400,
				message: 'Validation failed',
				code: 'VALIDATION_ERROR',
				fieldErrors: [{ path: 'name', message: 'Name is already taken.' }],
			})
		);

		renderForm();
		await userEvent.type(phoneField(), '+15551234567');
		await userEvent.type(nameField(), 'Ada');
		await userEvent.click(submitButton());

		expect(await screen.findByText('Name is already taken.')).toBeInTheDocument();
		await waitFor(() => expect(nameField()).toHaveAttribute('aria-invalid', 'true'));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('reports a failure the form cannot blame on a field in a form-level alert', async () => {
		login.mockRejectedValue(new ApiError({ kind: 'network', status: 0, message: 'Could not reach the server.' }));

		renderForm();
		await userEvent.type(phoneField(), '+15551234567');
		await userEvent.type(nameField(), 'Ada');
		await userEvent.click(submitButton());

		expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
	});

	it('pre-fills both fields from the persisted session so a return visit is one click', async () => {
		persist(SESSION);
		renderForm();

		await waitFor(() => expect(nameField()).toHaveValue('Ada'));
		expect(phoneField()).toHaveValue('+1 555 123 4567');
	});

	it('warns that editing the pre-filled name renames the account everywhere', async () => {
		persist(SESSION);
		renderForm();
		await waitFor(() => expect(nameField()).toHaveValue('Ada'));

		expect(screen.queryByText(/update your name everywhere/i)).not.toBeInTheDocument();

		await userEvent.type(nameField(), ' Lovelace');

		expect(await screen.findByText(/This will update your name everywhere, including in conversations you are already in\./i)).toBeInTheDocument();
	});

	it('does not warn about a rename when the number belongs to a different account', async () => {
		persist(SESSION);
		renderForm();
		await waitFor(() => expect(nameField()).toHaveValue('Ada'));

		await userEvent.clear(phoneField());
		await userEvent.type(phoneField(), '+442079460958');
		await userEvent.type(nameField(), ' Lovelace');

		expect(screen.queryByText(/update your name everywhere/i)).not.toBeInTheDocument();
	});
});
