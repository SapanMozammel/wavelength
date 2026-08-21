import LoginForm from '@/components/layout/auth/login-form';
import Logo from '@/components/layout/common/logo';

/**
 * The framing around the login form: everything on `/login` that is words
 * rather than interaction, so the only client JavaScript this route ships is
 * the form itself.
 *
 * The copy answers the question the screen provokes. A phone field and a name
 * field with no password looks like a half-finished sign-up form until someone
 * says out loud that there is no sign-up form — so the subheading says it, and
 * the footnote names the one consequence a user can actually be surprised by.
 */
const LoginPanel = () => (
	<div className='relative w-full max-w-md'>
		{/* The landing hero's signal-ring motif, faintly, so `/` and `/login`
		    read as one product. Decorative and inert. */}
		<div aria-hidden='true' className='pointer-events-none absolute -top-24 left-1/2 -z-10 size-56 -translate-x-1/2'>
			<span className='border-signal-400/40 dark:border-signal-300/30 animate-pulse-ring absolute inset-0 rounded-full border' />
			<span className='bg-signal-500/10 dark:bg-signal-400/10 absolute inset-8 rounded-full blur-2xl' />
		</div>

		<div className='flex flex-col items-center gap-3 text-center'>
			<Logo />
			<h1 className='font-display text-ink dark:text-ink-dark text-3xl font-semibold text-balance'>Tune in</h1>
			<p className='text-ink-muted dark:text-ink-muted-dark text-sm text-pretty'>Your phone number is your account. Enter it with a display name and you are in — there is no password and no separate sign-up.</p>
		</div>

		<div className='bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark rounded-panel mt-8 border p-6 shadow-lg shadow-black/5 sm:p-8 dark:shadow-black/30'>
			<LoginForm />
		</div>

		<p className='text-ink-muted dark:text-ink-muted-dark mt-6 text-center text-xs text-pretty'>
			A number the app has not seen before is registered on the spot. A number it has seen signs you back into that account.
		</p>
	</div>
);

export default LoginPanel;
