'use client';

import ConversationList from '@/components/layout/chat/sidebar/conversation-list';
import SidebarHeader from '@/components/layout/chat/sidebar/sidebar-header';
import UserSearch from '@/components/layout/chat/sidebar/user-search';
import { cn } from '@/lib/utils';
import { memo } from 'react';

type SidebarProps = {
	className?: string;
};

/**
 * The conversation directory.
 *
 * `UserSearch` owns the body below the field: while a query is active its
 * results *replace* the conversation list rather than pushing it down the
 * page. One scrolling region, one meaning at a time — and no lifted "is the
 * user searching" flag that two components could disagree about.
 */
const Sidebar = memo(({ className }: SidebarProps) => (
	<aside aria-label='Conversations' className={cn('bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark min-h-0 flex-col border-r', className)}>
		<SidebarHeader />
		<UserSearch fallback={<ConversationList />} />
	</aside>
));

Sidebar.displayName = 'Sidebar';

export default Sidebar;
