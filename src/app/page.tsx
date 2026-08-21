import Link from 'next/link';

/**
 * Part 2 — the landing page. Scaffolded here so routing and the design tokens
 * are wired end to end; the full creative build is tracked in
 * `.claude/plans/landing-page/prd.md`.
 */
const LandingPage = () => (
	<main className='mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center'>
		<p className='text-signal-600 dark:text-signal-300 font-mono text-xs tracking-[0.3em] uppercase'>Wavelength</p>
		<h1 className='font-display text-4xl leading-tight font-semibold text-balance sm:text-6xl'>A number, a name, and you are on the air.</h1>
		<p className='text-ink-muted dark:text-ink-muted-dark max-w-xl text-pretty'>
			Real-time messaging with no passwords and no sign-up form. Scaffold in place — the landing page build is planned in <code className='font-mono text-sm'>.claude/plans/landing-page</code>.
		</p>
		<Link href='/chat' className='bg-signal-600 hover:bg-signal-700 rounded-full px-6 py-3 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'>
			Open the app
		</Link>
	</main>
);

export default LandingPage;
