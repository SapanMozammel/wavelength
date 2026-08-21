'use client';

import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Label from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { memo, type FormEvent } from 'react';

type HeroLoginFieldProps = {
	className?: string;
};

/**
 * The page's central claim, made falsifiable: the primary call to action *is*
 * the product's entire onboarding. A phone number, a name, and you are in
 * `/chat`. There is no intermediate sign-up page because the API has no concept
 * of one.
 *
 * **Currently a presentational shell.** The markup, labels, autocomplete hints
 * and layout are final; the behaviour is not wired yet.
 *
 * TODO(blocked-on-03): wire to `useLoginForm` from `@/hooks/use-login-form`
 * (`.claude/plans/03-auth-session`, step 2). The hook must be reused verbatim,
 * not reimplemented — it owns phone validation, E.164 normalization, the
 * in-flight lock, the rename warning, and the mapping of server `fieldErrors`
 * back onto fields. If this form grows its own copy of any of that, the page
 * starts making a promise `/login` does not keep. Wiring it means:
 *   1. `const { values, errors, isSubmitting, onFieldChange, onFieldBlur, onSubmit } = useLoginForm()`
 *   2. replace `handleSubmit` below with the hook's `onSubmit`
 *   3. pass `value` / `onChange` / `onBlur` to both inputs, `invalid={...}` and
 *      `aria-describedby` to each, and `disabled` + `aria-busy` to the button
 *   4. render the hook's server error into the `role='alert'` region marked below
 */
const HeroLoginField = memo(({ className }: HeroLoginFieldProps) => {
	// TODO(blocked-on-03): replace with `onSubmit` from `useLoginForm`. Until the
	// hook exists this only stops the browser's default GET submit, which would
	// otherwise put the phone number in the address bar.
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
	};

	return (
		<div className={cn('w-full', className)}>
			<form
				onSubmit={handleSubmit}
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
						className='mt-0.5 rounded-none border-0 bg-transparent px-0 font-mono text-sm dark:bg-transparent'
					/>
				</div>

				<div className='border-border-subtle dark:border-border-subtle-dark px-3 py-1.5 sm:border-l'>
					<Label htmlFor='hero-name'>Display name</Label>
					<Input id='hero-name' name='name' autoComplete='name' placeholder='Priya' className='mt-0.5 rounded-none border-0 bg-transparent px-0 text-sm dark:bg-transparent' />
				</div>

				<Button type='submit' size='lg' className='w-full sm:w-auto'>
					Go on the air
				</Button>
			</form>

			{/* TODO(blocked-on-03): render `useLoginForm`'s server error here. The
			    region is mounted empty on purpose so the announcement lands the
			    moment it fills, rather than when the node first appears. */}
			<div role='alert' aria-live='polite' className='text-danger mt-3 text-sm empty:hidden' />

			<p className='text-ink-muted dark:text-ink-muted-dark mt-4 max-w-md text-sm text-pretty'>Your number and a name. That's the whole sign-up — there is no second step, and no email will arrive.</p>
		</div>
	);
});

HeroLoginField.displayName = 'HeroLoginField';

export default HeroLoginField;
