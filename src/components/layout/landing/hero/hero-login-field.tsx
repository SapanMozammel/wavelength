'use client';

import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Label from '@/components/ui/label';
import { useLoginForm } from '@/hooks/use-login-form';
import { cn } from '@/lib/utils';
import { memo } from 'react';

type HeroLoginFieldProps = {
	className?: string;
};

const PHONE_ERROR_ID = 'hero-phone-error';
const NAME_ERROR_ID = 'hero-name-error';

/**
 * The page's central claim, made falsifiable: the primary call to action *is*
 * the product's entire onboarding. A phone number, a name, and you are in
 * `/chat`. There is no intermediate sign-up page because the API has no concept
 * of one.
 *
 * It runs on `useLoginForm` — the same hook `/login` uses, deliberately reused
 * rather than reimplemented. That hook owns phone validation, E.164
 * normalization, the in-flight lock, the rename warning, and the mapping of
 * server field errors back onto fields. A second copy of any of that would let
 * the two screens drift, and the moment they drift this page is advertising a
 * flow the product does not actually have.
 *
 * The only thing that differs from `/login` is presentation: errors collect
 * beneath the bar instead of sitting under each field, because the hero is one
 * horizontal row and inline messages would reflow it as the user types.
 */
const HeroLoginField = memo(({ className }: HeroLoginFieldProps) => {
	const { phone, name, errors, formError, isSubmitting, isRenaming, onPhoneChange, onNameChange, onBlur, onSubmit } = useLoginForm();

	return (
		<div className={cn('w-full', className)}>
			<form
				onSubmit={onSubmit}
				aria-labelledby='hero-field-legend'
				className='rounded-panel border-border-subtle bg-surface/80 dark:border-border-subtle-dark dark:bg-surface-dark/70 grid gap-2 border p-2 shadow-lg shadow-black/5 backdrop-blur-md sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-0 dark:shadow-black/40'
			>
				<p id='hero-field-legend' className='sr-only'>
					Log in or create your account with a phone number and a display name
				</p>

				<div className='px-3 py-1.5'>
					<Label htmlFor='hero-phone'>Phone number</Label>
					<Input
						id='hero-phone'
						name='phone'
						type='tel'
						inputMode='tel'
						autoComplete='tel'
						placeholder='+1 555 123 0134'
						value={phone}
						onChange={(event) => onPhoneChange(event.target.value)}
						onBlur={() => onBlur('phone')}
						invalid={errors.phone !== null}
						{...(errors.phone === null ? {} : { 'aria-describedby': PHONE_ERROR_ID })}
						className='mt-0.5 rounded-none border-0 bg-transparent px-0 font-mono text-sm dark:bg-transparent'
					/>
				</div>

				<div className='border-border-subtle dark:border-border-subtle-dark px-3 py-1.5 sm:border-l'>
					<Label htmlFor='hero-name'>Display name</Label>
					<Input
						id='hero-name'
						name='name'
						autoComplete='name'
						placeholder='Priya'
						value={name}
						onChange={(event) => onNameChange(event.target.value)}
						onBlur={() => onBlur('name')}
						invalid={errors.name !== null}
						{...(errors.name === null ? {} : { 'aria-describedby': NAME_ERROR_ID })}
						className='mt-0.5 rounded-none border-0 bg-transparent px-0 text-sm dark:bg-transparent'
					/>
				</div>

				<Button type='submit' size='lg' disabled={isSubmitting} aria-busy={isSubmitting} className='w-full sm:w-auto'>
					{isSubmitting ? 'Tuning in…' : 'Go on the air'}
				</Button>
			</form>

			{/* Mounted empty rather than conditionally rendered, so the announcement
			    lands when the text arrives instead of when the node does. */}
			<div role='alert' aria-live='polite' className='mt-3 flex flex-col gap-1 text-sm empty:hidden'>
				{errors.phone !== null && (
					<p id={PHONE_ERROR_ID} className='text-danger-ink dark:text-danger-ink-dark'>
						{errors.phone}
					</p>
				)}
				{errors.name !== null && (
					<p id={NAME_ERROR_ID} className='text-danger-ink dark:text-danger-ink-dark'>
						{errors.name}
					</p>
				)}
				{formError !== null && <p className='text-danger-ink dark:text-danger-ink-dark'>{formError}</p>}
			</div>

			{isRenaming && (
				<p role='status' className='text-ink-muted dark:text-ink-muted-dark mt-3 text-sm text-pretty'>
					This updates your name everywhere, including in conversations you are already in.
				</p>
			)}

			<p className='text-ink-muted dark:text-ink-muted-dark mt-4 max-w-md text-sm text-pretty'>Your number and a name. That's the whole sign-up — there is no second step, and no email will arrive.</p>
		</div>
	);
});

HeroLoginField.displayName = 'HeroLoginField';

export default HeroLoginField;
