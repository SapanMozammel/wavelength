'use client';

import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { IconX } from '@tabler/icons-react';
import { memo, type ReactNode, type RefObject } from 'react';

const SIDES = {
	right: 'inset-y-0 right-0 h-dvh w-[min(24rem,100%)] border-l',
	bottom: 'inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-panel border-t',
} as const;

type SheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	hideTitle?: boolean;
	/** `right` on wide viewports, `bottom` on narrow — the caller picks. */
	side?: keyof typeof SIDES;
	/**
	 * The control that opened this sheet.
	 *
	 * Radix restores focus to its own `Dialog.Trigger`, and this sheet is
	 * controlled — it renders no trigger — so without an explicit target the
	 * closing sheet drops focus onto the body and a keyboard user is returned to
	 * the top of the document. Passing the opener keeps them where they were.
	 */
	returnFocusRef?: RefObject<HTMLElement | null>;
	children: ReactNode;
	className?: string;
};

/**
 * Edge-anchored overlay panel, built on Radix Dialog so it inherits the same
 * focus trap and Escape handling.
 *
 * Use it for something that overlays the current context — group details over a
 * conversation. Not for the conversation list on mobile: that is a destination
 * the user navigates to, not an overlay, and modelling it as a sheet traps it
 * behind a dismissal.
 */
const Sheet = memo(({ open, onOpenChange, title, hideTitle = false, side = 'right', returnFocusRef, children, className }: SheetProps) => (
	<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className='fixed inset-0 z-40 bg-black/50 backdrop-blur-sm' />
			<DialogPrimitive.Content
				onCloseAutoFocus={(event) => {
					const target = returnFocusRef?.current;
					if (target !== null && target !== undefined) {
						event.preventDefault();
						target.focus();
					}
				}}
				className={cn(
					'bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark fixed z-50 flex flex-col gap-4 p-5 shadow-lg shadow-black/10 dark:shadow-black/40',
					SIDES[side],
					className
				)}
			>
				<div className='flex shrink-0 items-start justify-between gap-4'>
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
				<div className='min-h-0 flex-1 overflow-y-auto'>{children}</div>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	</DialogPrimitive.Root>
));

Sheet.displayName = 'Sheet';

export default Sheet;
