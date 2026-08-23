import Logo from '@/components/layout/common/logo';
import ThemeToggle from '@/components/layout/common/theme-toggle';
import Link from 'next/link';

/**
 * Deliberately almost empty. The page's only real call to action lives in the
 * hero — a nav bar full of anchors would imply there is somewhere else to go,
 * and there isn't. A wordmark, one escape hatch, and the theme switch.
 */
const SiteHeader = () => (
	<header className='border-border-subtle/70 bg-canvas/70 dark:border-border-subtle-dark/70 dark:bg-canvas-dark/70 sticky top-0 z-20 h-16 border-b backdrop-blur-md'>
		<div className='mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-8'>
			<Link href='/' aria-label='Wavelength — home' className='rounded-full'>
				<Logo />
			</Link>
			<div className='flex items-center gap-1 sm:gap-2'>
				<Link
					href='/login'
					className='text-ink-muted hover:text-ink dark:text-ink-muted-dark dark:hover:text-ink-dark rounded-full px-3 py-2 font-mono text-xs tracking-[0.18em] uppercase transition-colors duration-150'
				>
					Log in
				</Link>
				<ThemeToggle />
			</div>
		</div>
	</header>
);

export default SiteHeader;
