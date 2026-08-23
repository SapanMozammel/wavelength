import Claims from '@/components/layout/landing/claims';
import SiteFooter from '@/components/layout/landing/footer';
import Hero from '@/components/layout/landing/hero';
import IdentityModel from '@/components/layout/landing/identity-model';
import JsonLd from '@/components/layout/landing/json-ld';
import Replay from '@/components/layout/landing/replay';
import SiteHeader from '@/components/layout/landing/site-header';
import type { Metadata } from 'next';

const TITLE = "Wavelength — a number, a name, and you're on the air";
const DESCRIPTION = 'A real-time chat built on phone-number identity. No password, no verification email, and no sign-up form — the request that logs you in is the one that creates you.';

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: '/' },
	openGraph: {
		type: 'website',
		siteName: 'Wavelength',
		url: '/',
		title: TITLE,
		description: DESCRIPTION,
	},
	twitter: {
		card: 'summary_large_image',
		title: TITLE,
		description: DESCRIPTION,
	},
};

/**
 * Part 2 — the landing page.
 *
 * A Server Component, and it stays one. The only client island on the page is
 * the hero's login field; every section below it is text and layout, so the
 * largest contentful paint is the headline rather than a hydrated widget.
 */
const LandingPage = () => (
	<>
		<SiteHeader />
		<main id='main'>
			<Hero />
			<Replay />
			<Claims />
			<IdentityModel />
		</main>
		<SiteFooter />
		<JsonLd />
	</>
);

export default LandingPage;
