'use client';

import { cn } from '@/lib/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { memo, type ReactNode } from 'react';

type PopoverProps = {
	trigger: ReactNode;
	children: ReactNode;
	align?: 'start' | 'center' | 'end';
	side?: 'top' | 'right' | 'bottom' | 'left';
	className?: string;
};

const Popover = memo(({ trigger, children, align = 'center', side = 'bottom', className }: PopoverProps) => (
	<PopoverPrimitive.Root>
		<PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				align={align}
				side={side}
				sideOffset={6}
				className={cn('bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark rounded-panel z-50 border p-3 shadow-lg shadow-black/10 dark:shadow-black/40', className)}
			>
				{children}
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	</PopoverPrimitive.Root>
));

Popover.displayName = 'Popover';

export default Popover;
