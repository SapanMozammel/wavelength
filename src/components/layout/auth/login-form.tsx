'use client';

import WakeNotice from '@/components/layout/common/wake-notice';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Label from '@/components/ui/label';
import Spinner from '@/components/ui/spinner';
import { useLoginForm } from '@/hooks/use-login-form';
import { NAME_MAX_LENGTH } from '@/lib/auth/schema';
import { cn } from '@/lib/utils';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { memo, type ChangeEvent } from 'react';

/**
 * The only interactive island on `/login`.
 *
 * Accessibility notes that are load-bearing rather than decorative:
 *
 * - Every message is text with an icon beside it, never colour alone. A
 *   red-only error is invisible in greyscale and to a large share of users.
 * - `aria-describedby` points at whichever of hint / error / rename note is
 *   actually rendered, so a screen reader reads the field and its current
 *   problem as one unit instead of announcing a stale id.
 * - The submit button is `disabled` **and** `aria-busy` in flight: `disabled`
 *   stops the second click, `aria-busy` explains why nothing happened.
 * - No `focus-visible:` styles here — the ring is declared once, globally.
 */

/** Builds an `aria-describedby` value, or `undefined` when nothing describes the field. */
const describedBy = (...ids: (string | false)[]): string | undefined => {
	const present = ids.filter((id): id is string => id !== false);
	return present.length === 0 ? undefined : present.join(' ');
};

type FieldMessageProps = {
	id: string;
	tone: 'error' | 'note';
	children: string;
};

const FieldMessage = ({ id, tone, children }: FieldMessageProps) => (
	<p id={id} className={cn('flex items-start gap-1.5 text-xs', tone === 'error' ? 'text-danger-ink dark:text-danger-ink-dark' : 'text-ink-muted dark:text-ink-muted-dark')}>
		{tone === 'error' ? <IconAlertCircle aria-hidden='true' className='mt-px size-3.5 shrink-0' /> : <IconInfoCircle aria-hidden='true' className='mt-px size-3.5 shrink-0' />}
		<span className='text-pretty'>{children}</span>
	</p>
);

const LoginForm = memo(() => {
	const form = useLoginForm();

	const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => form.onPhoneChange(event.target.value);
	const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => form.onNameChange(event.target.value);

	const phoneError = form.errors.phone;
	const nameError = form.errors.name;

	return (
		<form noValidate onSubmit={form.onSubmit} className='flex flex-col gap-5'>
			<div className='flex flex-col gap-2'>
				<Label htmlFor='login-phone'>Phone number</Label>
				<Input
					id='login-phone'
					name='phone'
					type='tel'
					inputMode='tel'
					autoComplete='tel'
					autoCapitalize='off'
					autoCorrect='off'
					spellCheck={false}
					// Mono because this is data, not prose: even digit widths make a
					// mistyped number visible at a glance.
					className='font-mono tracking-wide'
					value={form.phone}
					onChange={handlePhoneChange}
					onBlur={() => form.onBlur('phone')}
					invalid={phoneError !== null}
					aria-describedby={describedBy('login-phone-hint', phoneError !== null && 'login-phone-error')}
				/>
				<FieldMessage id='login-phone-hint' tone='note'>
					Start with your country code, like +1 or +44. It is how people find you.
				</FieldMessage>
				{phoneError !== null && (
					<FieldMessage id='login-phone-error' tone='error'>
						{phoneError}
					</FieldMessage>
				)}
			</div>

			<div className='flex flex-col gap-2'>
				<Label htmlFor='login-name'>Display name</Label>
				<Input
					id='login-name'
					name='name'
					type='text'
					autoComplete='name'
					maxLength={NAME_MAX_LENGTH}
					value={form.name}
					onChange={handleNameChange}
					onBlur={() => form.onBlur('name')}
					invalid={nameError !== null}
					aria-describedby={describedBy(nameError !== null && 'login-name-error', form.isRenaming && 'login-name-rename')}
				/>
				{nameError !== null && (
					<FieldMessage id='login-name-error' tone='error'>
						{nameError}
					</FieldMessage>
				)}
				{/* Quirk 14: there is no profile endpoint, so logging in *is* the
				    rename. Stated plainly — this is the API working as intended. */}
				{form.isRenaming && (
					<FieldMessage id='login-name-rename' tone='note'>
						This will update your name everywhere, including in conversations you are already in.
					</FieldMessage>
				)}
			</div>

			{form.formError !== null && (
				<p role='alert' className='text-danger-ink dark:text-danger-ink-dark bg-danger/10 rounded-panel flex items-start gap-2 px-3.5 py-3 text-sm'>
					<IconAlertCircle aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
					<span className='text-pretty'>{form.formError}</span>
				</p>
			)}

			<Button type='submit' size='lg' className='w-full' disabled={form.isSubmitting} aria-busy={form.isSubmitting}>
				{form.isSubmitting ? (
					<>
						<Spinner />
						Signing you in
					</>
				) : (
					'Continue'
				)}
			</Button>

			{/* Under the button rather than above it: `/login` is the most likely
			    first contact with the API, and the login POST is the request most
			    likely to eat the free tier's 30-60s cold start (quirk 20). On a
			    warm server this renders nothing at all — see `WakeNotice`. */}
			<WakeNotice />
		</form>
	);
});

LoginForm.displayName = 'LoginForm';

export default LoginForm;
