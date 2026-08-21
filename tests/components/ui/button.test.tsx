import Button from '@/components/ui/button';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('Button', () => {
	it('defaults to type="button", so a button inside a form cannot submit it by accident', () => {
		render(<Button>Send</Button>);
		expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'button');
	});

	it('still accepts an explicit submit type', () => {
		render(<Button type='submit'>Log in</Button>);
		expect(screen.getByRole('button', { name: 'Log in' })).toHaveAttribute('type', 'submit');
	});

	it('renders the child element instead of a button when asChild is set', () => {
		render(
			<Button asChild>
				<a href='/chat'>Open the app</a>
			</Button>,
		);
		expect(screen.getByRole('link', { name: 'Open the app' })).toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('does not fire its handler while disabled', async () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Send
			</Button>,
		);
		await userEvent.click(screen.getByRole('button', { name: 'Send' }));
		expect(onClick).not.toHaveBeenCalled();
	});

	it('merges a caller className without dropping its own variant classes', () => {
		render(<Button className='w-full'>Send</Button>);
		const button = screen.getByRole('button', { name: 'Send' });
		expect(button).toHaveClass('w-full');
		expect(button.className).toContain('rounded-full');
	});
});
