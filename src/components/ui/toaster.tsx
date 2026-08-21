'use client';

import { memo } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

/**
 * Mount point for transient notifications. Mounted once, in `providers`.
 *
 * `richColors` is off deliberately: it would introduce Sonner's own red/green
 * palette alongside the project's `danger` / `success` tokens, giving the app
 * two colour systems for the same meaning. Every surface is styled from project
 * tokens through `classNames` instead, and Sonner's stylesheet is never imported.
 *
 * Toasts carry transient, non-blocking news — a send retried, a member added.
 * Anything the user must act on belongs inline, in the surface it concerns.
 */
const Toaster = memo(() => (
	<SonnerToaster
		position='bottom-center'
		richColors={false}
		closeButton={false}
		toastOptions={{
			unstyled: true,
			classNames: {
				toast: 'flex w-full items-center gap-3 rounded-panel border border-border-subtle bg-surface px-4 py-3 text-sm shadow-lg shadow-black/10 dark:border-border-subtle-dark dark:bg-surface-dark dark:shadow-black/40',
				title: 'font-medium text-ink dark:text-ink-dark',
				description: 'text-ink-muted dark:text-ink-muted-dark text-xs',
				actionButton: 'ml-auto shrink-0 rounded-full bg-signal-600 px-3 py-1 text-xs font-medium text-white dark:bg-signal-500 dark:text-canvas-dark',
				error: 'border-danger/40',
				success: 'border-success/40',
			},
		}}
	/>
));

Toaster.displayName = 'Toaster';

export default Toaster;
