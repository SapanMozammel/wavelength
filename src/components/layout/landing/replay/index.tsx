import MessageListView from '@/components/layout/chat/panel/message-list-view';
import { REPLAY_MESSAGES, REPLAY_PEER, REPLAY_RENDERED_AT, REPLAY_SELF, replaySenderName } from '@/components/layout/landing/replay/replay-script';
import SectionHeading from '@/components/layout/landing/section-heading';
import { buildRows } from '@/lib/chat/build-rows';
import { formatPhoneForDisplay } from '@/lib/utils/phone';

/**
 * The scripted replay — a real conversation rendered through the product's own
 * message list.
 *
 * It imports `MessageListView` and `buildRows` from `components/layout/chat/`
 * rather than reproducing them, and that is the entire point of the section: a
 * copy drifts the first time a bubble radius or a run threshold changes, and
 * then the landing page is advertising a product that no longer exists. This
 * cannot drift, because it *is* the product's components — day separators, run
 * grouping, per-run timestamps and the in-flight message all come from the same
 * code path the real panel uses.
 *
 * `MessageListView` takes rows as a prop and imports no store, which is what
 * makes this possible without pulling chat state into the landing bundle.
 *
 * Static rather than animated, deliberately. This is also exactly what
 * `prefers-reduced-motion` would render, so the content is never gated behind
 * motion — and a transcript that arrives on a timer is a worse first impression
 * than one the reader can take in at their own pace.
 */
const Replay = () => {
	const rows = buildRows({
		messages: REPLAY_MESSAGES,
		participants: [REPLAY_PEER, REPLAY_SELF],
		currentUserId: REPLAY_SELF.id,
		// A direct thread never labels its runs — the only other name in the room
		// is already in the header above.
		showSenderNames: false,
	});

	return (
		<section id='replay' className='border-border-subtle dark:border-border-subtle-dark overflow-hidden border-t'>
			<div className='mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28'>
				<SectionHeading index='02' tag='Live' title='Messages arrive, they do not refresh.'>
					<p>
						Below is a conversation in the product's own message geometry — the same bubbles, the same run grouping, the same day separator, the same mono timestamps. Not a screenshot of the app: the layout
						it actually produces.
					</p>
				</SectionHeading>

				<div className='relative isolate mt-12 sm:mt-16'>
					{/* A blurred bloom rather than a gradient box — a radial gradient painted
					    into a rectangle shows its own edges the moment the rectangle is
					    narrower than the gradient. */}
					<div aria-hidden='true' className='bg-signal-500/10 dark:bg-signal-400/10 absolute top-10 left-1/2 -z-10 h-72 w-[min(100%,34rem)] -translate-x-1/2 rounded-full blur-3xl' />

					{/* Decorative: the transcript below is announced once, in prose, by the
					    summary that follows. A screen reader should not be walked through a
					    scripted demo message by message. */}
					<div
						aria-hidden='true'
						className='rounded-panel border-border-subtle bg-surface dark:border-border-subtle-dark dark:bg-surface-dark mx-auto max-w-2xl overflow-hidden border shadow-2xl shadow-black/10 dark:shadow-black/50'
					>
						<div className='border-border-subtle bg-surface-raised/60 dark:border-border-subtle-dark dark:bg-surface-raised-dark/60 flex items-center gap-3 border-b px-4 py-3'>
							<span className='bg-signal-600 dark:bg-signal-500 dark:text-canvas-dark font-display flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white'>PR</span>
							<span className='min-w-0 flex-1'>
								<span className='text-ink dark:text-ink-dark block truncate text-sm font-medium'>{REPLAY_PEER.name}</span>
								<span className='text-ink-muted dark:text-ink-muted-dark block truncate font-mono text-xs'>{formatPhoneForDisplay(REPLAY_PEER.phone)}</span>
							</span>
							<span className='text-pulse-700 dark:text-pulse-400 flex shrink-0 items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.18em] uppercase'>
								<span className='bg-pulse-700 dark:bg-pulse-400 size-1.5 rounded-full' />
								On the air
							</span>
						</div>

						<MessageListView
							rows={rows}
							conversationName={REPLAY_PEER.name}
							peerName={REPLAY_PEER.name}
							status='ready'
							olderStatus='idle'
							hasMore={false}
							error={null}
							now={REPLAY_RENDERED_AT}
							className='scrollbar-subtle max-h-[26rem] flex-none px-4 py-5 sm:max-h-none'
						/>

						<div className='border-border-subtle dark:border-border-subtle-dark flex items-center gap-3 border-t px-4 py-3'>
							<span className='rounded-panel border-border-subtle text-ink-muted dark:border-border-subtle-dark dark:text-ink-muted-dark flex-1 border px-3.5 py-2 text-sm'>Message Priya…</span>
							<span className='bg-signal-600 dark:bg-signal-500 flex size-10 shrink-0 items-center justify-center rounded-full'>
								<svg viewBox='0 0 20 20' fill='none' className='dark:text-canvas-dark size-4 text-white'>
									<path d='M3 10 17 3l-4 14-3-6-7-1Z' stroke='currentColor' strokeWidth='1.6' strokeLinejoin='round' />
								</svg>
							</span>
						</div>
					</div>

					{/* The same content, once, as prose — so nothing in the transcript is
					    available only to people who can see it. */}
					<p className='sr-only'>
						A recorded conversation between {REPLAY_PEER.name} and you, shown to illustrate the message list.{' '}
						{REPLAY_MESSAGES.map((message) => `${replaySenderName(message.senderId)} said: ${message.text}`).join(' ')} The last message is still sending.
					</p>
				</div>
			</div>
		</section>
	);
};

export default Replay;
