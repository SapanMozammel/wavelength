'use client';

import { cn } from '@/lib/utils';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { memo, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type DropdownMenuProps = {
	trigger: ReactNode;
	children: ReactNode;
	align?: 'start' | 'center' | 'end';
	className?: string;
};

/** Keyboard navigation, typeahead, and focus return all come from Radix. */
const DropdownMenu = memo(({ trigger, children, align = 'end', className }: DropdownMenuProps) => (
	<DropdownMenuPrimitive.Root>
		<DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				align={align}
				sideOffset={6}
				className={cn('bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark rounded-panel z-50 min-w-44 border p-1 shadow-lg shadow-black/10 dark:shadow-black/40', className)}
			>
				{children}
			</DropdownMenuPrimitive.Content>
		</DropdownMenuPrimitive.Portal>
	</DropdownMenuPrimitive.Root>
));

DropdownMenu.displayName = 'DropdownMenu';

type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
	/** Destructive items read in `danger` and should always confirm before acting. */
	tone?: 'default' | 'danger';
};

export const DropdownMenuItem = memo(({ tone = 'default', className, ...rest }: DropdownMenuItemProps) => (
	<DropdownMenuPrimitive.Item
		className={cn(
			'flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
			tone === 'danger' ? 'text-danger data-[highlighted]:bg-danger/10' : 'text-ink dark:text-ink-dark data-[highlighted]:bg-surface-raised dark:data-[highlighted]:bg-surface-raised-dark',
			className
		)}
		{...rest}
	/>
));

DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuSeparator = memo(({ className, ...rest }: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) => (
	<DropdownMenuPrimitive.Separator className={cn('bg-border-subtle dark:bg-border-subtle-dark my-1 h-px', className)} {...rest} />
));

DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export default DropdownMenu;
