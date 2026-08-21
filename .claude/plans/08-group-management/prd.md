# Feature: Group Management

Add members, remove, leave, promote to admin, and rename — all admin-gated except
leaving.

> **This is the first plan on the cut line.** Group *creation* is a stated brief
> requirement and ships in [`04-conversation-directory`](../04-conversation-directory/prd.md).
> Group *administration* is not required by the brief. If the deadline squeezes,
> cut this before touching plans 05–07.

## Context

The API's group surface is, unusually, its most consistent:

- All five endpoints return the **full group object**, populated
- `POST /conversations/group` correctly answers `201`
- **Authorization actually works** — a non-admin rename gets a clean
  `403 FORBIDDEN` with a useful message
- Membership and admin checks hold up under probing

From [`quirks.md`](../../../docs/api/quirks.md) § *What was not wrong*. That
consistency shapes the design: because every mutation returns the complete group,
the client **replaces wholesale** rather than patching fields. No merge logic, no
partial-update reconciliation.

Rules: a group needs 3+ members. The creator starts as sole admin. Only admins
may add, remove, promote, or rename. **Any member may leave — by removing
themselves** (`DELETE /participants/{ownId}`), which is the one case where the
admin gate does not apply.

## Adoption Brief

**Adopted:** `addParticipants`, `removeParticipant`, `promoteToAdmin`,
`renameGroup` from [`src/lib/api/index.ts`](../../../src/lib/api/index.ts) — all
built and typed. Sheet, Dialog, DropdownMenu, Avatar, Checkbox from plan 01. The
search components from plan 04, reused for adding members.

**NOT adopted:** optimistic updates for membership changes — the endpoints are
fast, and an optimistic removal that 403s has to un-remove a person from a list
the user is looking at. Replacing on the response is simpler and never lies.
Demote-from-admin — **the API has no endpoint for it**; offering it would be a
dead control. Group avatars/images — no endpoint.

## Skill Dependencies

- `architecture/component-patterns.md`
- `architecture/state.md` — group mutations go through `chat-slice` thunks
- `design-system/colors.md`, `spacing.md`

## Architecture Strategy

**Hide, don't 403.** Admin-only controls are not rendered for non-admins, rather
than shown and failing after a round trip. `isAdmin = conversation.adminIds.includes(session.user.id)`
is computed once in the details panel and passed down. The API's 403 is still
handled — a user can be demoted while the panel is open — but it is the fallback,
not the mechanism.

**Wholesale replacement.** Every group thunk resolves to a full `Conversation`
and dispatches a single `conversationReplaced(conversation)` reducer. One reducer,
five callers.

**Leaving is a destructive confirm.** `DELETE /participants/{ownId}` cannot be
undone from the client — rejoining needs an admin. A confirmation dialog states
that explicitly. On success: close the panel, clear `activeConversationId`, and
**remove the conversation from the list**, because subsequent fetches will not
include it.

**Removing the last admin** is possible through this API. If the only admin leaves,
the group is left with no one who can add, remove, or rename. Warn before the
action — *"You're the only admin. If you leave, no one will be able to manage this
group."* — and suggest promoting someone first. The API will not stop it; the UI
should at least say so. This is the highest-value detail in the plan.

**Rename** is inline-editable in the details panel for admins: click the title,
edit, Enter to commit, Escape to cancel. Blank names are blocked client-side
(the API rejects them too, with a good message — but a disabled control beats a 400).

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/layout/chat/group/group-details-sheet.tsx` | Client | Sheet, mutations |
| `src/components/layout/chat/group/participant-list.tsx` | Client | selectors |
| `src/components/layout/chat/group/participant-row.tsx` | Client | `memo`, row menu |
| `src/components/layout/chat/group/add-members-dialog.tsx` | Client | search + multi-select |
| `src/components/layout/chat/group/rename-group-field.tsx` | Client | inline edit |
| `src/components/layout/chat/group/leave-group-dialog.tsx` | Client | confirm |
| `src/components/layout/chat/group/admin-badge.tsx` | **Server** | pure presentational |
| `src/hooks/use-group-actions.ts` | Client hook | the five mutations + pending state |

The details Sheet is the one place a Sheet is correct — it *is* an overlay over
the conversation, unlike the sidebar (plan 04), which is a destination.

## Data & Types

No new domain types. `GroupConversation` already carries `adminIds`,
`participants`, `createdById`.

Add one derived helper to `src/types/chat.ts`:

```ts
export const isGroupAdmin = (c: Conversation, userId: string): boolean =>
  c.type === 'group' && c.adminIds.includes(userId);
```

Union-safe by construction, so no call site branches on `type` first.

## Design System

- Sheet slides from the right on `sm+`, from the bottom on mobile,
  `bg-surface dark:bg-surface-dark`
- Admin badge — `signal-100/signal-800` pill, `font-mono text-[0.625rem] uppercase`
- Destructive actions (`Remove`, `Leave`) — `text-danger`, with a confirm step.
  Never a one-click destructive action in a row menu
- The only-admin warning — `bg-warning/10` panel with an icon, above the confirm
- Participant rows reuse the avatar + name + phone layout from plan 04's search
  results, so the two read as the same object in two places

## State

Mutations dispatch `chat-slice` thunks; results replace the conversation.
Per-action pending state (which row is being removed) is local to
`use-group-actions` — a store field for "removing user X" would be transient
state in a global place.

## Accessibility

- The Sheet has a title and Radix focus trapping; focus returns to the trigger
- Participant list is `role="list"`; row menus are Radix DropdownMenus (keyboard
  navigable by default)
- Each row action has an explicit accessible name including the person:
  *"Remove Grace Hopper from the group"* — never a bare "Remove"
- Confirmation dialogs are `role="alertdialog"` with focus on the **cancel**
  action by default
- The admin badge has an `sr-only` expansion: *"Administrator"*
- Rename field: labelled, Escape cancels, and the commit is announced via
  `role="status"`

## Testing Strategy

`tests/components/chat/group-details.test.tsx`:
- [⬜] a non-admin sees no add / remove / promote / rename controls
- [⬜] an admin sees all four
- [⬜] every member, admin or not, sees "Leave group"
- [⬜] the only admin leaving triggers the warning before the confirm
- [⬜] a blank rename is blocked client-side
- [⬜] a `403` from the API surfaces a readable message, not raw driver text
- [⬜] a successful mutation replaces the conversation wholesale

`e2e/groups.spec.ts`: create a group → open details → add a member → promote →
rename → leave, asserting the list updates at each step without a manual refresh
(`conversation:updated` fires, per plan 07).

## Performance

`ParticipantRow` is `memo`'d. Mutations are sequential per action with the
triggering control disabled while pending — no double-submit. The add-members
search reuses `use-user-search` from plan 04 rather than a second implementation.

## Affected Files

- `src/components/layout/chat/panel/panel-header.tsx` — group details trigger
- `src/store/slices/chat-slice.ts` — four mutation thunks +
  `conversationReplaced`
- `src/types/chat.ts` — `isGroupAdmin`

## New Files

- `src/components/layout/chat/group/*.tsx` — the seven components above
- `src/hooks/use-group-actions.ts`
- `tests/components/chat/group-details.test.tsx`
- `e2e/groups.spec.ts`

## Implementation Steps

- [⬜] **1 — Thunks + `conversationReplaced`.** Four mutations, one reducer.
- [⬜] **2 — `isGroupAdmin`** in `src/types/chat.ts`, union-safe.
- [⬜] **3 — `GroupDetailsSheet` shell.** Title, participant count, created-by,
  with `isAdmin` computed once at the top.
- [⬜] **4 — `ParticipantList` + `ParticipantRow` + `AdminBadge`.** Per-person
  accessible action names.
- [⬜] **5 — `AddMembersDialog`.** Reuse `use-user-search`; exclude existing
  members and the current user from results.
- [⬜] **6 — `RenameGroupField`.** Inline edit, blank blocked, Escape cancels.
- [⬜] **7 — Promote + remove.** Admin-gated, confirm on remove.
- [⬜] **8 — `LeaveGroupDialog`** with the only-admin warning path.
- [⬜] **9 — Tests + e2e.**
- [⬜] **10 — Gate.** `pnpm run check:all`, `pnpm run test`, e2e on chromium-desktop.

## Verification

- [⬜] A non-admin sees no admin control anywhere in the sheet
- [⬜] The only admin is warned before leaving
- [⬜] Leaving removes the conversation from the list and clears the panel
- [⬜] Every mutation updates the list without a manual refresh
- [⬜] No raw Mongoose or driver text ever reaches the screen
- [⬜] Axe clean; every row action names the person it applies to
- [⬜] Keyboard-only: open sheet → navigate rows → open menu → act → close

## Risks & Open Questions

- **The API has no demote endpoint.** Promotion is one-way. Stated in the UI
  (*"Admins can't be removed as admins"*) rather than shipping a dead control.
- **A group can be left with zero admins.** The warning is the mitigation; the
  API permits it regardless. Worth one line in the write-up as a design
  observation about the API.
- **Removing yourself vs being removed** hit the same endpoint. The UI must label
  them differently ("Leave group" vs "Remove"), or a user can accidentally leave
  from a row menu meant for someone else.
