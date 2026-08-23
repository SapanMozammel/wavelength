import { cn } from '@/lib/utils';

/** Marks a group administrator. */
const AdminBadge = ({ className }: { className?: string }) => (
	<span className={cn('bg-signal-100 text-signal-800 dark:bg-signal-900 dark:text-signal-100 rounded-full px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider uppercase', className)}>Admin</span>
);

export default AdminBadge;
