import Logo from '@/components/layout/common/logo';
import SpectrumRule from '@/components/layout/landing/spectrum-rule';
import Link from 'next/link';

const REPO_URL = 'https://github.com/SapanMozammel/wavelength';

type FooterLink = {
	label: string;
	href: string;
	/** Off-site links open in a new tab and are marked as such. */
	external?: boolean;
};

const LINK_GROUPS: { title: string; links: FooterLink[] }[] = [
	{
		title: 'The app',
		links: [
			{ label: 'Open the app', href: '/chat' },
			{ label: 'Log in', href: '/login' },
		],
	},
	{
		title: 'The work',
		links: [
			{ label: 'API documentation', href: `${REPO_URL}/tree/main/docs/api`, external: true },
			{ label: 'The API’s 20 quirks', href: `${REPO_URL}/blob/main/docs/api/quirks.md`, external: true },
			{ label: 'Source on GitHub', href: REPO_URL, external: true },
		],
	},
];

/**
 * No newsletter capture, no cookie banner, no social row. The footer's job here
 * is to hand over the two things a reader might actually want next: the app,
 * and the working notes behind it.
 */
const SiteFooter = () => (
	<footer className='border-border-subtle dark:border-border-subtle-dark border-t'>
		<div className='mx-auto w-full max-w-6xl px-6 pt-16 pb-12 sm:px-8'>
			<div className='flex flex-col gap-12 sm:flex-row sm:justify-between sm:gap-16'>
				<div>
					<Logo />
					<p className='text-ink-muted dark:text-ink-muted-dark mt-5 max-w-xs text-sm leading-relaxed text-pretty'>
						A real-time chat client built against a provided Chat API, and the page that introduces it. Built as a take-home assignment.
					</p>
				</div>

				<nav aria-label='Footer' className='grid grid-cols-2 gap-x-10 gap-y-10 sm:gap-x-16'>
					{LINK_GROUPS.map((group) => (
						<div key={group.title}>
							<p className='text-ink-muted dark:text-ink-muted-dark font-mono text-[0.6875rem] tracking-[0.28em] uppercase'>{group.title}</p>
							<ul className='mt-4 space-y-3'>
								{group.links.map((link) => (
									<li key={link.href}>
										<Link
											href={link.href}
											{...(link.external === true ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
											className='text-ink hover:text-signal-700 dark:text-ink-dark dark:hover:text-signal-300 rounded-sm text-sm transition-colors duration-150'
										>
											{link.label}
											{link.external === true && <span className='sr-only'> (opens in a new tab)</span>}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>
			</div>

			<SpectrumRule className='mt-16' />

			<p className='text-ink-muted dark:text-ink-muted-dark mt-8 font-mono text-[0.6875rem] tracking-[0.16em] uppercase'>Wavelength · no cookies, no tracking, no newsletter</p>
		</div>
	</footer>
);

export default SiteFooter;
