import { cn } from '@/lib/utils';

type SpinnerProps = {
	className?: string;
};

/**
 * An indeterminate progress indicator, for waits too short to narrate.
 *
 * Decorative by design: a spinner conveys "busy" and nothing more, so it is
 * `aria-hidden` and the calling surface supplies the accessible status text.
 * For waits long enough that a spinner reads as broken — the API's 30-60s cold
 * start — narrate the wait instead of spinning at the user.
 */
const Spinner = ({ className }: SpinnerProps) => (
	<svg aria-hidden='true' viewBox='0 0 24 24' fill='none' className={cn('size-4 animate-spin', className)}>
		<circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='3' className='opacity-20' />
		<path d='M22 12a10 10 0 0 0-10-10' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
	</svg>
);

export default Spinner;
