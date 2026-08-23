import { cn } from '@/lib/utils';

type LogoProps = {
	/** Hide the wordmark and show the mark alone — for narrow sidebars. */
	markOnly?: boolean;
	className?: string;
};

/**
 * The wordmark. The mark is a waveform that resolves into a steady line: two
 * signals arriving at the same frequency, which is what the product name means.
 * Drawn in `currentColor` so it inherits whatever surface it sits on.
 */
const Logo = ({ markOnly = false, className }: LogoProps) => (
	<span className={cn('text-ink dark:text-ink-dark inline-flex items-center gap-2', className)}>
		<svg viewBox='0 0 28 20' fill='none' aria-hidden='true' className='text-signal-600 dark:text-signal-400 h-5 w-7 shrink-0'>
			<path d='M1 10c2.2 0 2.2-7 4.4-7s2.2 14 4.4 14 2.2-9.5 4.4-9.5 2.2 5 4.4 5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
			<path d='M18.6 12.5H27' stroke='currentColor' strokeWidth='2' strokeLinecap='round' className='text-pulse-500' />
		</svg>
		{!markOnly && <span className='font-display text-base font-semibold tracking-tight'>Wavelength</span>}
		{markOnly && <span className='sr-only'>Wavelength</span>}
	</span>
);

export default Logo;
