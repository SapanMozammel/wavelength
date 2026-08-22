'use client';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VariantProps } from 'class-variance-authority';
import { memo, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	Pick<VariantProps<typeof buttonVariants>, 'variant'> & {
		/**
		 * The accessible name. **Required, deliberately** — an icon-only control
		 * with no name is invisible to a screen reader, and making this optional
		 * is how that gets forgotten. The type is the enforcement.
		 */
		label: string;
		icon: ReactNode;
		size?: 'sm' | 'md';
		/** Declared explicitly: `ButtonHTMLAttributes` carries no `ref`. */
		ref?: Ref<HTMLButtonElement>;
	};

/**
 * A square, icon-only control. Sized to a 44px touch target at `md` even though
 * the icon inside is 20px, per the project's touch-target rule.
 */
const IconButton = memo(({ label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest }: IconButtonProps) => (
	<button type={type} aria-label={label} className={cn(buttonVariants({ variant }), 'rounded-full p-0', size === 'sm' ? 'size-9' : 'size-11', className)} {...rest}>
		<span aria-hidden='true' className='inline-flex items-center justify-center'>
			{icon}
		</span>
	</button>
));

IconButton.displayName = 'IconButton';

export default IconButton;
