'use client';

import { cn } from '@/lib/utils';
import { memo, type TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
	invalid?: boolean;
};

/**
 * A styled textarea. Auto-growing is deliberately **not** built in — height is a
 * DOM measurement, and it belongs in the `useAutoGrowTextarea` callback-ref hook
 * that the composer owns, not in a presentational primitive.
 */
const Textarea = memo(({ invalid = false, className, rows = 1, ...rest }: TextareaProps) => (
	<textarea
		rows={rows}
		aria-invalid={invalid || undefined}
		className={cn(
			'bg-surface text-ink placeholder:text-ink-muted dark:bg-surface-dark dark:text-ink-dark dark:placeholder:text-ink-muted-dark rounded-panel w-full resize-none border px-3.5 py-2.5 text-sm leading-relaxed transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
			invalid ? 'border-danger' : 'border-border-subtle dark:border-border-subtle-dark',
			className
		)}
		{...rest}
	/>
));

Textarea.displayName = 'Textarea';

export default Textarea;
