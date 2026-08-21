import { REPLAY_MESSAGES, REPLAY_PEER, REPLAY_RENDERED_AT, REPLAY_SELF, replaySenderName } from '@/components/layout/landing/replay/replay-script';
import SectionHeading from '@/components/layout/landing/section-heading';
import { cn } from '@/lib/utils';
import { formatPhoneForDisplay } from '@/lib/utils/phone';
import { formatDaySeparator, formatMessageTime, isDifferentDay, toIsoString } from '@/lib/utils/time';

/**
 * The scripted replay — a real conversation in the product's own message
 * geometry: run grouping, a day separator, per-run timestamps, and a message
 * still in flight.
 *
 * **Currently the static rendering.** This is not a placeholder screenshot: it
 * is the full transcript, laid out exactly as the animated version will leave
 * it, and it is also the `prefers-reduced-motion` rendering the PRD requires —
 * the content is never gated behind motion.
 *
 * TODO(blocked-on-05): swap the static transcript below for the real
 * `MessageListView` + `useScriptedReplay`. `.claude/plans/05-message-list` owns
 * `src/components/layout/chat/panel/`, which does not exist yet. When it does,
 * this section must render the product's own components rather than a copy of
 * them — a copy drifts the first time a bubble radius changes, and the point of
 * the section is that it cannot drift. Per plan 05's noted risk, that likely
 * means extracting a presentational `MessageListView` that takes rows as a prop
 * so the landing page does not pull chat state into its bundle. The animated
 * path is `useScriptedReplay`: an `IntersectionObserver` gate so the timer does
 * not run off-screen, and a reduced-motion branch that renders exactly what is
 * below.
 */
const Replay = () => {
	const now = REPLAY_RENDERED_AT;
	const messages = REPLAY_MESSAGES;

	const rows = messages.map((message, index) => {
		const previous = index === 0 ? null : messages[index - 1];
		const next = index === messages.length - 1 ? null : messages[index + 1];
		const startsDay = previous === null || isDifferentDay(previous.createdAt, message.createdAt);

		return {
			message,
			startsDay,
			startsRun: previous === null || startsDay || previous.senderId !== message.senderId,
			endsRun: next === null || isDifferentDay(message.createdAt, next.createdAt) || next.senderId !== message.senderId,
			isSelf: message.senderId === REPLAY_SELF.id,
		};
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

						<div className='scrollbar-subtle max-h-[26rem] space-y-1 overflow-y-auto px-4 py-5 sm:max-h-none'>
							{rows.map(({ message, startsDay, startsRun, endsRun, isSelf }) => (
								<div key={message.id}>
									{startsDay && (
										<div className='flex items-center gap-3 py-4 first:pt-0'>
											<span className='bg-border-subtle dark:bg-border-subtle-dark h-px flex-1' />
											<span className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.625rem] tracking-[0.24em] uppercase'>{formatDaySeparator(message.createdAt, now)}</span>
											<span className='bg-border-subtle dark:bg-border-subtle-dark h-px flex-1' />
										</div>
									)}
									<div className={cn('flex flex-col', startsRun ? 'mt-4 first:mt-0' : 'mt-1', isSelf ? 'items-end' : 'items-start')}>
										<p
											className={cn(
												'rounded-bubble max-w-[min(78%,26rem)] px-3.5 py-2 text-[0.9375rem] leading-snug text-pretty',
												isSelf
													? 'bg-signal-600 dark:bg-signal-500 dark:text-canvas-dark rounded-br-sm text-white'
													: 'bg-surface-raised text-ink dark:bg-surface-raised-dark dark:text-ink-dark rounded-bl-sm',
												!startsRun && (isSelf ? 'rounded-tr-sm' : 'rounded-tl-sm')
											)}
										>
											{message.text}
										</p>
										{endsRun && (
											<p className='text-ink-muted dark:text-ink-muted-dark mt-1 flex items-center gap-1.5 px-1 font-mono text-[0.625rem]'>
												<time dateTime={toIsoString(message.createdAt)}>{formatMessageTime(message.createdAt)}</time>
												{message.status === 'sending' && <span>· sending</span>}
											</p>
										)}
									</div>
								</div>
							))}
						</div>

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
						{rows.map(({ message }) => `${replaySenderName(message.senderId)} said: ${message.text}`).join(' ')} The last message is still sending.
					</p>
				</div>
			</div>
		</section>
	);
};

export default Replay;
