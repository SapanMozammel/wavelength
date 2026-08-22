'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addGroupMembers, leaveGroupConversation, promoteGroupAdmin, removeGroupMember, renameGroupConversation } from '@/store/slices/chat-slice';
import { isGroupAdmin, type Conversation } from '@/types/chat';
import { useCallback, useState } from 'react';

/** Which single action is in flight, so only the control that started it disables. */
export type PendingGroupAction = { kind: 'add' | 'remove' | 'promote' | 'rename' | 'leave'; userId?: string } | null;

export type GroupActions = {
	isAdmin: boolean;
	pending: PendingGroupAction;
	error: string | null;
	addMembers: (userIds: string[]) => Promise<boolean>;
	removeMember: (userId: string) => Promise<boolean>;
	promote: (userId: string) => Promise<boolean>;
	rename: (name: string) => Promise<boolean>;
	leave: () => Promise<boolean>;
};

/**
 * The five group mutations, with just enough local state to disable the control
 * that started one.
 *
 * Pending state is local rather than in the store on purpose: "which row is
 * being removed right now" is transient interaction state belonging to one open
 * sheet, and putting it in a global store would outlive the sheet and re-render
 * every other subscriber for nothing.
 *
 * Every action resolves to a boolean rather than throwing, so callers can close
 * a dialog on success and keep it open on failure without a try/catch each.
 */
export const useGroupActions = (conversation: Conversation): GroupActions => {
	const dispatch = useAppDispatch();
	const currentUserId = useAppSelector((state) => state.session.user?.id ?? null);
	const [pending, setPending] = useState<PendingGroupAction>(null);
	const [error, setError] = useState<string | null>(null);

	const isAdmin = currentUserId !== null && isGroupAdmin(conversation, currentUserId);

	const run = useCallback(async (next: NonNullable<PendingGroupAction>, action: unknown): Promise<boolean> => {
		setPending(next);
		setError(null);
		// `unwrap` turns a rejected thunk into a throw carrying the ChatError
		// the API layer already classified — never a raw driver message.
		try {
			await (action as { unwrap: () => Promise<unknown> }).unwrap();
			return true;
		} catch (thrown) {
			setError(thrown instanceof Error ? thrown.message : ((thrown as { message?: string }).message ?? 'That did not work. Please try again.'));
			return false;
		} finally {
			setPending(null);
		}
	}, []);

	const addMembers = useCallback((userIds: string[]) => run({ kind: 'add' }, dispatch(addGroupMembers({ conversationId: conversation.id, userIds }))), [run, dispatch, conversation.id]);

	const removeMember = useCallback((userId: string) => run({ kind: 'remove', userId }, dispatch(removeGroupMember({ conversationId: conversation.id, userId }))), [run, dispatch, conversation.id]);

	const promote = useCallback((userId: string) => run({ kind: 'promote', userId }, dispatch(promoteGroupAdmin({ conversationId: conversation.id, userId }))), [run, dispatch, conversation.id]);

	const rename = useCallback((name: string) => run({ kind: 'rename' }, dispatch(renameGroupConversation({ conversationId: conversation.id, name }))), [run, dispatch, conversation.id]);

	const leave = useCallback(() => run({ kind: 'leave' }, dispatch(leaveGroupConversation(conversation.id))), [run, dispatch, conversation.id]);

	return { isAdmin, pending, error, addMembers, removeMember, promote, rename, leave };
};
