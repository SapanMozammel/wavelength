import { env } from '@/lib/env';

/**
 * `SoftwareApplication` structured data for the landing page.
 *
 * Kept deliberately small and true — name, category, platform, description,
 * URL. No fabricated ratings and no offer block: this is a take-home build, and
 * structured data that overstates what a thing is gets ignored at best.
 */
const JsonLd = () => {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'Wavelength',
		applicationCategory: 'CommunicationApplication',
		operatingSystem: 'Web',
		url: env.NEXT_PUBLIC_SITE_URL,
		description: 'A real-time chat built on phone-number identity. One number, one name, and you are on the air — no password, no verification email, and no sign-up form.',
	};

	return <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
};

export default JsonLd;
