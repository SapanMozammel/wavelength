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
	<html lang='en' suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
		<body className='min-h-dvh'>
			<Providers>
				<SkipLink />
				{children}
			</Providers>
		</body>
	</html>
);

export default RootLayout;
