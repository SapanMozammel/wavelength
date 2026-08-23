import SectionHeading from '@/components/layout/landing/section-heading';
import { Fragment } from 'react';

/** The whole handshake, in three boxes. There is no fourth step. */
const HANDSHAKE = [
	{ line: '+1 555 123 0134 · “Priya”', caption: 'what you type' },
	{ line: 'POST /auth/login', caption: 'one request, no second step' },
	{ line: '{ token, user }', caption: 'you are in' },
];

/**
 * The section that states the product's own security model plainly.
 *
 * This is the unusual one, and it is the point of the page: the identity model
 * has a real weakness, it is inherent to the API rather than to this client,
 * and saying so is more convincing than any claim of being secure would be.
 * The tone is matter-of-fact on purpose — it is a demo API, not an incident.
 */
const IdentityModel = () => (
	<section id='identity' className='border-border-subtle dark:border-border-subtle-dark relative isolate overflow-hidden border-t'>
		<div aria-hidden='true' className='signal-grid absolute inset-0 -z-10 opacity-40 dark:opacity-30' />

		<div className='mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28'>
			<SectionHeading index='04' tag='Identity' title='There is no password. Here is exactly what that means.'>
				<p>A page that explains its own security model is rarer than one that claims to have a good one. This is the model, in full, including the part that is not flattering.</p>
			</SectionHeading>

			<div aria-hidden='true' className='mt-12 flex flex-col gap-3 sm:mt-14 sm:flex-row sm:items-stretch'>
				{HANDSHAKE.map((step, index) => (
					<Fragment key={step.line}>
						{index > 0 && (
							<span className='text-signal-600 dark:text-signal-400 flex shrink-0 items-center justify-center font-mono text-lg sm:px-1'>
								<span className='sm:hidden'>↓</span>
								<span className='hidden sm:inline'>→</span>
							</span>
						)}
						<span className='rounded-panel border-border-subtle bg-surface dark:border-border-subtle-dark dark:bg-surface-dark flex flex-1 flex-col justify-center border px-5 py-4'>
							<span className='text-ink dark:text-ink-dark font-mono text-sm wrap-break-word'>{step.line}</span>
							<span className='text-ink-muted dark:text-ink-muted-dark mt-2 font-mono text-[0.6875rem] tracking-[0.16em] uppercase'>{step.caption}</span>
						</span>
					</Fragment>
				))}
			</div>

			<div className='mt-14 grid gap-x-16 gap-y-8 lg:grid-cols-2'>
				<div className='text-ink-muted dark:text-ink-muted-dark space-y-5 leading-relaxed text-pretty'>
					<p>
						Logging in is one request. You send a phone number and a display name; the API returns a JWT and the user it belongs to. If it has never seen that number it creates the account in the same breath.
						There is no verification step because there is nothing to verify against — no email, no second device, no shared secret.
					</p>
					<p>
						Sending the same number again with a different name does not create a second account. It renames the first one everywhere, including inside other people's conversation lists. Login is also the
						rename endpoint; there is no profile screen because there is no profile route.
					</p>
					<p>
						The token lives in <code className='text-ink dark:text-ink-dark font-mono text-[0.875em]'>localStorage</code>, because the browser talks to the API directly and there is no server session to keep
						it in. Middleware cannot see it, so the route guard is client-side. That is the accurate architecture rather than a shortcut around one.
					</p>
				</div>

				<div className='border-signal-600 bg-surface/70 dark:border-signal-400 dark:bg-surface-dark/70 rounded-panel h-fit border-l-2 p-6 backdrop-blur-sm sm:p-8'>
					<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>The trade-off, stated plainly</p>
					<p className='text-ink dark:text-ink-dark mt-4 leading-relaxed text-pretty'>Anyone who knows your phone number can log in as you.</p>
					<p className='text-ink-muted dark:text-ink-muted-dark mt-4 leading-relaxed text-pretty'>
						There is no second factor, no confirmation, and no way for the server to tell the two of you apart — it was never given anything that would let it. That is a property of this demo API rather than
						a defect in the client, and it is why Wavelength is a demonstration of a chat client and not a place to keep anything private. The honest thing a client can do with a model like this one is name
						it.
					</p>
				</div>
			</div>
		</div>
	</section>
);

export default IdentityModel;
