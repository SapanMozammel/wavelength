import Link from 'next/link';

const NotFound = () => (
	<main id='main' className='mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center'>
		<p className='text-signal-600 dark:text-signal-300 font-mono text-xs tracking-[0.3em] uppercase'>404</p>
		<h1 className='font-display text-3xl font-semibold'>Signal lost</h1>
		<p className='text-ink-muted dark:text-ink-muted-dark'>That page is not on this frequency.</p>
		<Link href='/' className='text-signal-600 dark:text-signal-300 text-sm font-medium underline underline-offset-4'>
			Back to the landing page
		</Link>
	</main>
);

export default NotFound;
