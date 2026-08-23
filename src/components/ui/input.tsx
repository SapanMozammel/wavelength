'use client';

import { cn } from '@/lib/utils';
import { memo, type InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
	/** Paints the error border and sets `aria-invalid` together, so they cannot drift apart. */
	invalid?: boolean;
};

const Input = memo(({ invalid = false, className, ...rest }: InputProps) => (
	<input
		aria-invalid={invalid || undefined}
		className={cn(
			'bg-surface text-ink placeholder:text-ink-muted dark:bg-surface-dark dark:text-ink-dark dark:placeholder:text-ink-muted-dark rounded-panel h-11 w-full border px-3.5 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
			invalid ? 'border-danger' : 'border-border-subtle dark:border-border-subtle-dark',
			className
		)}
		{...rest}
	/>
));

Input.displayName = 'Input';

export default Input;
