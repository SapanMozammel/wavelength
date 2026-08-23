'use client';

import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { IconX } from '@tabler/icons-react';
import { memo, type ReactNode } from 'react';

type DialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/**
	 * Required. Radix warns without one, and a dialog with no accessible name
	 * leaves a screen-reader user with no idea what just took their focus. Pass
	 * `hideTitle` to keep it visually silent without dropping it.
	 */
	title: string;
	description?: string;
	hideTitle?: boolean;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
};

/** Centred modal. Focus trapping, scroll locking, and Escape come from Radix. */
const Dialog = memo(({ open, onOpenChange, title, description, hideTitle = false, children, footer, className }: DialogProps) => (
	<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className='fixed inset-0 z-40 bg-black/50 backdrop-blur-sm' />
			<DialogPrimitive.Content
				className={cn(
					'bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark rounded-panel fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-1/2 flex-col gap-4 border p-5 shadow-lg shadow-black/10 dark:shadow-black/40',
					className
				)}
			>
				<div className='flex items-start justify-between gap-4'>
					{hideTitle ? (
						<VisuallyHidden>
							<DialogPrimitive.Title>{title}</DialogPrimitive.Title>
						</VisuallyHidden>
					) : (
						<DialogPrimitive.Title className='font-display text-ink dark:text-ink-dark text-lg font-semibold text-balance'>{title}</DialogPrimitive.Title>
					)}
					<DialogPrimitive.Close
						aria-label='Close'
						className='text-ink-muted hover:bg-surface-raised hover:text-ink dark:text-ink-muted-dark dark:hover:bg-surface-raised-dark dark:hover:text-ink-dark -mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150'
					>
						<IconX aria-hidden='true' className='size-4' />
					</DialogPrimitive.Close>
				</div>
				{description !== undefined && <DialogPrimitive.Description className='text-ink-muted dark:text-ink-muted-dark -mt-2 text-sm text-pretty'>{description}</DialogPrimitive.Description>}
				<div className='min-h-0 flex-1 overflow-y-auto'>{children}</div>
				{footer !== undefined && <div className='flex shrink-0 justify-end gap-2'>{footer}</div>}
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	</DialogPrimitive.Root>
));

Dialog.displayName = 'Dialog';

export default Dialog;
