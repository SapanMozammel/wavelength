/** What `POST /auth/login` actually asks for. */
const REQUIRED = ['phone number', 'display name'];

/** What every other chat app asks for, and this one has no endpoint for. */
const NOT_REQUIRED = ['password', 'password confirmation', 'email address', 'email verification', 'captcha', 'OAuth handshake', 'password reset flow'];

/**
 * The credential ledger. Two lists, one struck through — the argument is the
 * length difference, so it is made with type and a rule rather than an icon.
 *
 * Strikethrough and the leading glyph both carry the distinction, so the figure
 * survives greyscale and colour blindness without leaning on the violet.
 */
const FigureCredentials = () => (
	<div className='rounded-panel border-border-subtle bg-surface dark:border-border-subtle-dark dark:bg-surface-dark border p-6 sm:p-8'>
		<p className='text-signal-700 dark:text-signal-300 font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>What it asks for</p>
		<ul className='mt-4 space-y-2.5 font-mono text-sm'>
			{REQUIRED.map((item) => (
				<li key={item} className='text-ink dark:text-ink-dark flex items-center gap-3'>
					<span aria-hidden='true' className='text-signal-600 dark:text-signal-300'>
						+
					</span>
					{item}
				</li>
			))}
		</ul>

		<div className='bg-border-subtle dark:bg-border-subtle-dark my-7 h-px w-full' />

		<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>What it has no endpoint for</p>
		<ul className='mt-4 space-y-2.5 font-mono text-sm'>
			{NOT_REQUIRED.map((item) => (
				<li key={item} className='text-ink-muted dark:text-ink-muted-dark flex items-center gap-3'>
					<span aria-hidden='true'>—</span>
					<span className='line-through decoration-1'>{item}</span>
				</li>
			))}
		</ul>
	</div>
);

export default FigureCredentials;
