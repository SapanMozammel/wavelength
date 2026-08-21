import HeroLoginField from '@/components/layout/landing/hero/hero-login-field';
import SignalRings from '@/components/layout/landing/hero/signal-rings';
import SpectrumRule from '@/components/layout/landing/spectrum-rule';
import Link from 'next/link';

/**
 * Three numbers, each of which is literally true of this API rather than a
 * rounded marketing figure. They sit below the fold on purpose — the call to
 * action gets the first screen to itself.
 */
const FACTS = [
	{ figure: '0', label: 'passwords anywhere in the system' },
	{ figure: '1', label: 'request between a stranger and a logged-in user' },
	{ figure: '2', label: 'fields, and one of them is just your name' },
];

/**
 * The hero. Server-rendered apart from the login field, so the largest
 * contentful paint is the headline rather than a hydrated widget.
 */
const Hero = () => (
	<section className='relative isolate overflow-hidden'>
		<div aria-hidden='true' className='signal-aura absolute inset-0 -z-10' />
		<SignalRings className='top-[36%] left-1/2 -z-10 -translate-1/2 opacity-50 sm:opacity-70 lg:top-1/2 lg:left-[76%] lg:opacity-100' />

		<div className='mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-center px-6 pt-10 pb-16 sm:px-8 sm:pt-16 sm:pb-24'>
			<p className='animate-rise text-signal-700 dark:text-signal-300 flex items-center gap-3 font-mono text-[0.6875rem] tracking-[0.32em] uppercase'>
				<span aria-hidden='true' className='relative flex size-2 items-center justify-center'>
					<span className='animate-pulse-ring bg-pulse-500/60 dark:bg-pulse-400/60 absolute inset-0 rounded-full' />
					<span className='bg-pulse-700 dark:bg-pulse-400 size-2 rounded-full' />
				</span>
				Real-time chat · no accounts
			</p>

			<h1 className='animate-rise-2 font-display mt-6 max-w-3xl text-[clamp(2rem,1.1rem+3.9vw,4.5rem)] leading-[1.03] font-semibold tracking-tight text-balance'>A number, a name, and you're on the air.</h1>

			<p className='animate-rise-3 text-ink-muted dark:text-ink-muted-dark mt-6 max-w-xl text-[clamp(0.9375rem,0.9rem+0.35vw,1.125rem)] leading-relaxed text-pretty'>
				No password, no verification email, no sign-up form. The request that logs you in is the same one that creates you — so there is nothing to sign up for.
			</p>

			<HeroLoginField className='animate-rise-4 mt-9 max-w-2xl' />

			<p className='animate-rise-5 text-ink-muted dark:text-ink-muted-dark mt-5 text-sm'>
				Rather not type into a landing page?{' '}
				<Link href='/login' className='text-signal-700 hover:text-signal-800 dark:text-signal-300 dark:hover:text-signal-200 rounded-sm font-medium underline underline-offset-4 transition-colors duration-150'>
					Use the login page
				</Link>
				.
			</p>
		</div>

		<div className='mx-auto w-full max-w-6xl px-6 sm:px-8'>
			<SpectrumRule />
			<dl className='grid gap-8 py-12 sm:grid-cols-3 sm:gap-6'>
				{FACTS.map((fact) => (
					<div key={fact.figure} className='flex items-baseline gap-4 sm:block'>
						<dt className='font-display text-signal-600 dark:text-signal-300 text-4xl leading-none font-semibold tabular-nums'>{fact.figure}</dt>
						<dd className='text-ink-muted dark:text-ink-muted-dark max-w-[22ch] text-sm text-pretty sm:mt-3'>{fact.label}</dd>
					</div>
				))}
			</dl>
		</div>
	</section>
);

export default Hero;
