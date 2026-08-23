import AuthGate from '@/components/layout/auth/auth-gate';
import ChatShell from '@/components/layout/chat/chat-shell';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chat' };

/**
 * Part 1 — the chat screen.
 *
 * `<main id='main'>` sits outside `AuthGate` on purpose: the skip link targets
 * it, and a landmark that disappears while the session is being checked would
 * leave the keyboard bypass pointing at nothing during the exact wait it is
 * most useful in.
 *
 * `h-dvh` rather than `min-h-dvh` — this screen does not scroll as a page. The
 * sidebar list and (from plan 05) the message list are the only scrolling
 * regions, which is what keeps the composer pinned above the home indicator on
 * iOS instead of sliding off the bottom.
 */
const ChatPage = () => (
	<main id='main' className='h-dvh overflow-hidden'>
		<AuthGate>
			<ChatShell />
		</AuthGate>
	</main>
);

export default ChatPage;
