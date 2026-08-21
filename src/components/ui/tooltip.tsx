'use client';

import { cn } from '@/lib/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { memo, type ReactNode } from 'react';

type TooltipProps = {
	/**
	 * Supplementary only. A tooltip is unreachable by touch and unreliable for
	 * assistive tech, so it must never be the sole carrier of a control's name —
	 * that is `aria-label`'s job.
	 */
	content: string;
	children: ReactNode;
	side?: 'top' | 'right' | 'bottom' | 'left';
	className?: string;
};

const Tooltip = memo(({ content, children, side = 'top', className }: TooltipProps) => (
	<TooltipPrimitive.Root>
		<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content side={side} sideOffset={6} className={cn('bg-ink text-canvas dark:bg-ink-dark dark:text-canvas-dark z-50 rounded-md px-2 py-1 text-xs font-medium shadow-md', className)}>
				{content}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	</TooltipPrimitive.Root>
));

Tooltip.displayName = 'Tooltip';

/** Mount once, high in the tree. Radix requires a provider above every tooltip. */
export const TooltipProvider = TooltipPrimitive.Provider;

export default Tooltip;
