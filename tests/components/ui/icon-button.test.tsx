import IconButton from '@/components/ui/icon-button';
import { IconSend } from '@tabler/icons-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

/**
 * An icon-only control with no accessible name is invisible to a screen reader.
 * `label` is required by the type so it cannot be omitted; these tests pin the
 * runtime half of that contract.
 */
describe('IconButton', () => {
	it('exposes its label as the accessible name', () => {
		render(<IconButton label='Send message' icon={<IconSend />} />);
		expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
	});

	it('hides the icon from assistive tech, so the name is not read twice', () => {
		const { container } = render(<IconButton label='Send message' icon={<IconSend />} />);
		expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
	});

	it('fires on click and stays silent while disabled', async () => {
		const onClick = vi.fn();
		const { rerender } = render(<IconButton label='Send message' icon={<IconSend />} onClick={onClick} />);
		await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
		expect(onClick).toHaveBeenCalledTimes(1);

		rerender(<IconButton label='Send message' icon={<IconSend />} onClick={onClick} disabled />);
		await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
