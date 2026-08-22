'use client';

import SearchResultRow from '@/components/layout/chat/sidebar/search-result-row';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import Input from '@/components/ui/input';
import ScrollArea from '@/components/ui/scroll-area';
import Spinner from '@/components/ui/spinner';
import { useUserSearch } from '@/hooks/use-user-search';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { startDirect } from '@/store/slices/chat-slice';
import { IconSearch, IconUserQuestion } from '@tabler/icons-react';
import { memo, useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';

type UserSearchProps = {
	/**
	 * What fills the sidebar while the query is blank — the conversation list.
	 * Results *replace* the list rather than pushing it down, so the sidebar
	 * only ever has one scrolling region and one meaning at a time.
	 */
	fallback?: ReactNode;
	className?: string;
};

/** The new-chat control in the header focuses this field rather than opening a second surface. */
export const SEARCH_INPUT_ID = 'user-search';

const RESULT_SELECTOR = '[data-search-result]';

/** "1 person found" / "3 people found" — a bare number is not an announcement. */
const foundLabel = (count: number): string => `${String(count)} ${count === 1 ? 'person' : 'people'} found`;

/**
 * Search, and the one-tap start that follows it.
 *
 * The self-match note is the piece worth pointing at. The signed-in user is
 * filtered out of every result set — starting a conversation with your own id
 * returns a stranger's thread with a cheerful 200 (quirk 9) — but silently
 * returning nothing for your own phone number reads as a broken search rather
 * than a guard. So the hook remembers that you were in the raw results, and
 * this panel says so.
 */
const UserSearch = memo(({ fallback, className }: UserSearchProps) => {
	const dispatch = useAppDispatch();
	const { query, isBlank, results, status, error, isSelfMatch, onQueryChange, clear, retry } = useUserSearch();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [startError, setStartError] = useState<string | null>(null);
	const listRef = useRef<HTMLUListElement>(null);

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setStartError(null);
			onQueryChange(event.target.value);
		},
		[onQueryChange]
	);

	const handleStart = useCallback(
		(id: string) => {
			const peer = results.find((user) => user.id === id);
			if (peer === undefined || pendingId !== null) {
				return;
			}

			setPendingId(id);
			setStartError(null);

			void (async () => {
				const outcome = await dispatch(startDirect(peer));
				setPendingId(null);
				if (startDirect.fulfilled.match(outcome)) {
					// The thunk inserts (or replaces) the row and opens it; clearing
					// the query is what puts the list back on screen. No refetch.
					clear();
					return;
				}
				setStartError(outcome.payload?.message ?? 'Could not start that conversation.');
			})();
		},
		[dispatch, results, clear, pendingId]
	);

	/** Arrow keys walk the results; Enter on a row starts the chat. */
	const focusResult = useCallback((index: number) => {
		const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(RESULT_SELECTOR);
		if (rows === undefined || rows.length === 0) {
			return;
		}
		rows[((index % rows.length) + rows.length) % rows.length]?.focus();
	}, []);

	const handleInputKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				focusResult(0);
			}
		},
		[focusResult]
	);

	const handleListKeyDown = useCallback(
		(event: KeyboardEvent<HTMLUListElement>) => {
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
				return;
			}
			const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>(RESULT_SELECTOR) ?? [])];
			const current = rows.indexOf(document.activeElement as HTMLButtonElement);
			if (current === -1) {
				return;
			}
			event.preventDefault();
			focusResult(current + (event.key === 'ArrowDown' ? 1 : -1));
		},
		[focusResult]
	);

	const announcement = status === 'loading' ? 'Searching' : status === 'ready' ? (isSelfMatch && results.length === 0 ? 'That is your own number' : foundLabel(results.length)) : '';

	return (
		<div className={cn('flex min-h-0 flex-1 flex-col', className)}>
			<div className='shrink-0 px-3 pb-3'>
				<label htmlFor={SEARCH_INPUT_ID} className='sr-only'>
					Search people by name or phone number
				</label>
				<div className='relative'>
					<IconSearch aria-hidden='true' className='text-ink-muted dark:text-ink-muted-dark pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
					<Input id={SEARCH_INPUT_ID} type='search' autoComplete='off' placeholder='Search by name or number' value={query} onChange={handleChange} onKeyDown={handleInputKeyDown} className='pl-9' />
				</div>
			</div>

			{/* The list stays mounted behind the results rather than being swapped
			    out. Unmounting it would re-run its mount fetch on every search,
			    and `GET /conversations` replaces the list wholesale — which would
			    quietly drop a conversation created seconds earlier, before the
			    server has it indexed. */}
			<div className={cn('flex min-h-0 flex-1 flex-col', !isBlank && 'hidden')}>{fallback}</div>

			{!isBlank && (
				<div className='flex min-h-0 flex-1 flex-col'>
					<p role='status' aria-live='polite' className='sr-only'>
						{announcement}
					</p>

					{status === 'loading' && (
						<p className='text-ink-muted dark:text-ink-muted-dark flex items-center gap-2 px-3 py-4 text-sm'>
							<Spinner />
							Searching
						</p>
					)}

					{status === 'error' && <ErrorState title='Search failed' {...(error === null ? {} : { description: error })} onRetry={retry} />}

					{status === 'ready' && results.length === 0 && isSelfMatch && (
						<EmptyState
							icon={<IconUserQuestion aria-hidden='true' className='size-7' />}
							title="That's you."
							description='You cannot start a conversation with yourself. Search for the person you want to reach.'
						/>
					)}

					{status === 'ready' && results.length === 0 && !isSelfMatch && (
						<EmptyState
							icon={<IconUserQuestion aria-hidden='true' className='size-7' />}
							title='No one found'
							description='Nobody matches that name or number. Numbers are stored in full international form, so include the country code.'
						/>
					)}

					{status === 'ready' && results.length > 0 && (
						<ScrollArea className='min-h-0 flex-1'>
							{startError !== null && (
								<p role='alert' className='text-danger-ink dark:text-danger-ink-dark px-3 py-2 text-xs text-pretty'>
									{startError}
								</p>
							)}
							<ul ref={listRef} role='list' onKeyDown={handleListKeyDown} className='flex flex-col pb-1'>
								{results.map((user) => (
									<SearchResultRow
										key={user.id}
										id={user.id}
										name={user.name}
										phone={user.phone}
										isPending={pendingId === user.id}
										disabled={pendingId !== null && pendingId !== user.id}
										onSelect={handleStart}
									/>
								))}
							</ul>
						</ScrollArea>
					)}
				</div>
			)}
		</div>
	);
});

UserSearch.displayName = 'UserSearch';

export default UserSearch;
