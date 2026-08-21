'use client';

import IconButton from '@/components/ui/icon-button';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { memo, useCallback } from 'react';

type ThemeToggleProps = {
	className?: string;
};

/**
 * Light/dark switch.
 *
 * Deliberately free of a `mounted` flag. The usual next-themes dance —
 * render nothing until an effect confirms the client — costs a layout shift and
 * an effect this project does not allow in components. Instead the markup is
 * identical on server and client, both icons always render, and the `.dark`
 * class decides which is visible. Nothing can mismatch because nothing depends
 * on client-only state at render time.
 *
 * The handler reads the class from the document rather than `resolvedTheme`,
 * which is `undefined` on the first render — the DOM is the source of truth
 * next-themes is writing to, so it is correct from the very first click.
 */
const ThemeToggle = memo(({ className }: ThemeToggleProps) => {
	const { setTheme } = useTheme();

	const toggle = useCallback(() => {
		const isDark = document.documentElement.classList.contains('dark');
		setTheme(isDark ? 'light' : 'dark');
	}, [setTheme]);

	return (
		<IconButton
			label='Toggle dark mode'
			onClick={toggle}
			className={className}
			icon={
				<>
					<IconSun aria-hidden='true' className='size-5 dark:hidden' />
					<IconMoon aria-hidden='true' className='hidden size-5 dark:block' />
				</>
			}
		/>
	);
});

ThemeToggle.displayName = 'ThemeToggle';

export default ThemeToggle;
