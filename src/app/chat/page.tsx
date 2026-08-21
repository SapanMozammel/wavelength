import AuthGate from '@/components/layout/auth/auth-gate';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chat' };

/**
 * Part 1 — the chat screen. The conversation list, message panel, and composer
 * are built in `.claude/plans/chat-experience/prd.md`; what is settled here is
 * the guard around them.
 *
 * `<main id='main'>` sits outside `AuthGate` on purpose: the skip link targets
 * it, and a landmark that disappears while the session is being checked would
 * leave the keyboard bypass pointing at nothing during the exact wait it is
 * most useful in.
 */
const ChatPage = () => (
	<main id='main' className='min-h-dvh'>
		<AuthGate>
			<div className='mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-4 px-6'>
				<h1 className='font-display text-3xl font-semibold'>Chat</h1>
				<p className='text-ink-muted dark:text-ink-muted-dark'>Conversation list, message panel, and composer land here.</p>
			</div>
		</AuthGate>
	</main>
);

export default ChatPage;
