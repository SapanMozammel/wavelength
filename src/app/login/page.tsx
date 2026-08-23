import AuthGate from '@/components/layout/auth/auth-gate';
import LoginPanel from '@/components/layout/auth/login-panel';
import type { Metadata } from 'next';

/**
 * `robots: { index: false }` — a login screen has nothing to offer a search
 * result, and indexing one only splits ranking away from the landing page.
 * The title suffix comes from the root layout's template.
 */
export const metadata: Metadata = {
	title: 'Log in',
	description: 'Sign in to Wavelength with your phone number and a display name. No password, no separate sign-up.',
	robots: { index: false, follow: false },
};

/**
 * A Server Component start to finish. `AuthGate` and the form are the only
 * client islands, and both are leaves — the page itself, its copy, and its
 * metadata never reach the browser as JavaScript.
 *
 * `mode='guest'` sends an already-signed-in visitor to `/chat` rather than
 * offering them a form that would only re-establish the session they have.
 */
const LoginPage = () => (
	<main id='main' className='flex min-h-dvh flex-col items-center justify-center px-6 py-16'>
		<AuthGate mode='guest'>
			<LoginPanel />
		</AuthGate>
	</main>
);

export default LoginPage;
