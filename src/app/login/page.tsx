import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Log in' };

/** Part 1 — login. Built in `.claude/plans/chat-experience/prd.md`, step 2. */
const LoginPage = () => (
	<main id='main' className='mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6'>
		<h1 className='font-display text-3xl font-semibold'>Log in</h1>
		<p className='text-ink-muted dark:text-ink-muted-dark'>Phone number and display name. No password, no separate sign-up.</p>
	</main>
);

export default LoginPage;
