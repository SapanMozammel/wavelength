'use client';

import NewGroupDialog from '@/components/layout/chat/sidebar/new-group-dialog';
import { SEARCH_INPUT_ID } from '@/components/layout/chat/sidebar/user-search';
import Logo from '@/components/layout/common/logo';
import ThemeToggle from '@/components/layout/common/theme-toggle';
import Avatar from '@/components/ui/avatar';
import IconButton from '@/components/ui/icon-button';
import { formatPhoneForDisplay } from '@/lib/utils/phone';
import { useAppSelector } from '@/store/hooks';
import { IconPencilPlus, IconUsersPlus } from '@tabler/icons-react';
import { memo, useCallback, useState } from 'react';

/**
 * Who you are, and the two ways to start something.
 *
 * The identity block is not decoration: this API has no passwords and no
 * profile screen, so the only place a user can confirm *which* account they are
 * signed into is here. Login is also rename (quirk 14), which makes seeing your
 * own number worth the two lines it costs.
 *
 * "New chat" focuses the search field rather than opening a second surface —
 * the field is always on screen, and a modal that contains one input the user
 * can already see is ceremony.
 */
const SidebarHeader = memo(() => {
	const user = useAppSelector((state) => state.session.user);
	const [isGroupOpen, setIsGroupOpen] = useState(false);

	const openGroup = useCallback(() => {
		setIsGroupOpen(true);
	}, []);

	const focusSearch = useCallback(() => {
		document.getElementById(SEARCH_INPUT_ID)?.focus();
	}, []);

	return (
		<header className='border-border-subtle dark:border-border-subtle-dark flex shrink-0 flex-col gap-3 border-b px-3 py-3'>
			<div className='flex items-center justify-between gap-2'>
				<Logo />
				<div className='flex items-center gap-0.5'>
					<IconButton label='New chat' icon={<IconPencilPlus aria-hidden='true' className='size-5' />} onClick={focusSearch} />
					<IconButton label='New group' icon={<IconUsersPlus aria-hidden='true' className='size-5' />} onClick={openGroup} />
					<ThemeToggle />
				</div>
			</div>

			{user !== null && (
				<div className='flex items-center gap-2.5'>
					<Avatar name={user.name} seed={user.id} size='sm' />
					<div className='min-w-0'>
						<p className='text-ink dark:text-ink-dark truncate text-sm font-medium'>{user.name}</p>
						<p className='text-ink-muted dark:text-ink-muted-dark truncate font-mono text-xs'>{formatPhoneForDisplay(user.phone)}</p>
					</div>
				</div>
			)}

			{/* Mounted only while open, so an abandoned draft resets on close. */}
			{isGroupOpen && <NewGroupDialog open onOpenChange={setIsGroupOpen} />}
		</header>
	);
});

SidebarHeader.displayName = 'SidebarHeader';

export default SidebarHeader;
