import SkipLink from '@/components/layout/common/skip-link';
import { env } from '@/lib/env';
import Providers from '@/providers';
import '@/styles/global.scss';
import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata: Metadata = {
	metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
	title: {
		default: 'Wavelength — messaging that keeps up',
		template: '%s · Wavelength',
	},
	description: 'A real-time chat built on phone-number identity. One number, one name, and you are on the air.',
	openGraph: {
		type: 'website',
		siteName: 'Wavelength',
		title: 'Wavelength — messaging that keeps up',
		description: 'A real-time chat built on phone-number identity.',
	},
	robots: { index: true, follow: true },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#fbfbfe' },
		{ media: '(prefers-color-scheme: dark)', color: '#0f0f15' },
	],
	width: 'device-width',
	initialScale: 1,
};

type RootLayoutProps = {
	children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => (
	// `suppressHydrationWarning` on both elements, for two different reasons.
	// On <html>, next-themes' inline script sets `class` and `style` before React
	// hydrates, so the client tree legitimately differs from the server's. On
	// <body>, browser extensions do the same thing uninvited — Grammarly injects
	// `data-gr-ext-installed`, password managers add their own — and React cannot
	// tell that apart from a real mismatch. Both are scoped to the element's own
	// attributes and do not reach any child, so a genuine mismatch inside the app
	// still reports.
	<html lang='en' suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
		<body suppressHydrationWarning className='min-h-dvh'>
			<Providers>
				<SkipLink />
				{children}
			</Providers>
		</body>
	</html>
);

export default RootLayout;
