'use client';

import { cn } from '@/lib/utils';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { memo, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type ScrollAreaProps = ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
	children: ReactNode;
	viewportClassName?: string;
};

/**
 * Scroll container for the sidebar and other list panels.
 *
 * Deliberately **not** used by the message list. Radix wraps the scrollable node
 * in its own viewport element, so `scrollTop` / `scrollHeight` are only
 * reachable through an extra ref indirection — and the message list does
 * scroll-height-delta anchoring on every prepended page. That code wants the
 * element it is measuring to be the element it is scrolling, so it uses a native
 * `overflow-y-auto` container instead.
 */
const ScrollArea = memo(({ children, className, viewportClassName, ...rest }: ScrollAreaProps) => (
	<ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...rest}>
		<ScrollAreaPrimitive.Viewport className={cn('size-full rounded-[inherit]', viewportClassName)}>{children}</ScrollAreaPrimitive.Viewport>
		<ScrollAreaPrimitive.Scrollbar orientation='vertical' className='flex w-2 touch-none p-0.5 transition-opacity select-none'>
			<ScrollAreaPrimitive.Thumb className='bg-border-subtle dark:bg-border-subtle-dark relative flex-1 rounded-full' />
		</ScrollAreaPrimitive.Scrollbar>
		<ScrollAreaPrimitive.Corner />
	</ScrollAreaPrimitive.Root>
));

ScrollArea.displayName = 'ScrollArea';

export default ScrollArea;
