import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chat' };

/** Part 1 — the chat screen. Built in `.claude/plans/chat-experience/prd.md`. */
const ChatPage = () => (
	<main id='main' className='mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-4 px-6'>
		<h1 className='font-display text-3xl font-semibold'>Chat</h1>
		<p className='text-ink-muted dark:text-ink-muted-dark'>Conversation list, message panel, and composer land here.</p>
	</main>
);

export default ChatPage;
