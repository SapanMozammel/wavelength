import ErrorState from '@/components/ui/error-state';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('ErrorState', () => {
	it('announces itself as an alert', () => {
		render(<ErrorState title="Couldn't load messages" />);
		expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load messages");
	});

	it('offers no retry control when the caller supplies no way forward', () => {
		render(<ErrorState title="Couldn't load messages" />);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('calls onRetry so the user can recover without reloading', async () => {
		const onRetry = vi.fn();
		render(<ErrorState title="Couldn't load messages" onRetry={onRetry} />);
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('lets the caller name the recovery action', () => {
		render(<ErrorState title='Not connected' onRetry={vi.fn()} retryLabel='Reconnect' />);
		expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
	});
});
