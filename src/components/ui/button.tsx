'use client';

import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { memo, type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * No `focus-visible:` styling here on purpose — the focus ring is declared once
 * globally in `global.scss` (`:focus-visible`, 2px `signal-500`). A primitive
 * that redefines it fragments the one visual signal keyboard users rely on.
 */
const buttonVariants = cva(
	'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
	{
		variants: {
			variant: {
				primary: 'bg-signal-600 hover:bg-signal-700 dark:bg-signal-500 dark:hover:bg-signal-400 text-white dark:text-canvas-dark',
				secondary: 'bg-surface-raised text-ink hover:bg-border-subtle dark:bg-surface-raised-dark dark:text-ink-dark dark:hover:bg-border-subtle-dark',
				ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink dark:text-ink-muted-dark dark:hover:bg-surface-raised-dark dark:hover:text-ink-dark bg-transparent',
				danger: 'bg-danger text-white hover:opacity-90',
			},
			size: {
				// 44px is the minimum comfortable touch target; `sm` is for dense
				// desktop rows where a pointer is the only realistic input.
				sm: 'h-9 px-3 text-xs',
				md: 'h-11 px-5 text-sm',
				lg: 'h-12 px-6 text-base',
			},
		},
		defaultVariants: { variant: 'primary', size: 'md' },
	}
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants> & {
		/** Render the child element instead of a `<button>`, e.g. a `<Link>`. */
		asChild?: boolean;
		children: ReactNode;
	};

const Button = memo(({ variant, size, asChild = false, className, children, type = 'button', ...rest }: ButtonProps) => {
	const Component = asChild ? Slot : 'button';
	// `Slot` forwards to whatever it renders, which may not accept `type`.
	const typeProp = asChild ? {} : { type };

	return (
		<Component className={cn(buttonVariants({ variant, size }), className)} {...typeProp} {...rest}>
			{children}
		</Component>
	);
});

Button.displayName = 'Button';

export { buttonVariants };
export default Button;
