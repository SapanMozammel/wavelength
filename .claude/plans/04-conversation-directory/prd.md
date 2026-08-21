# Feature: Conversation Directory

The sidebar: conversation list, user search, starting a direct chat, and creating
a group.

## Context

Two brief requirements land here:

> **Starting a conversation** — to start a new conversation, the user searches by
> a number or name, then starts the conversation.
>
> **Group conversations** — support creating a group conversation with multiple
> participants, in addition to one-to-one conversations.

Four API faults sit directly on this path:

- **[Quirk 3] Searching by phone number crashes the endpoint.** `q` is
  interpolated into a Mongo `$regex` unescaped; a leading `+` is an invalid
  quantifier → `500`. `sanitizeSearchTerm()` already strips metacharacters.
- **[Quirk 4] Omitting `q` dumps every user in the database** — names and phone
  numbers of every other candidate testing against this server. `searchUsers`
  already short-circuits a blank term.
- **[Quirks 18 + 9] You appear in your own search results, and tapping yourself
  opens a stranger's conversation.** `POST /conversations` with your own id
  returns an unrelated existing conversation, `200`, no error.
- **[Quirk 8] `POST /conversations` returns a stub** — no `type`, no `updatedAt`,
  `participants` as id strings. `normalizeCreatedDirectConversation(wire, peer)`
  folds in the peer already in hand, so the new row renders with no refetch.

All four are handled in `src/lib/api/`. **Do not re-solve them here.**

## Adoption Brief

**Adopted:** `chat-slice` thunks from plan 02, plan 01 primitives (ScrollArea,
Avatar, Checkbox, Dialog, Input, EmptyState, ErrorState, Skeleton, Badge),
`AbortController` for search cancellation.

**NOT adopted:** a debounce library — a `use-debounced-value` hook is eight lines
and one fewer dependency. Virtualized conversation list — demo-scale volumes.
Optimistic conversation creation — `POST /conversations` is idempotent and fast;
an optimistic row that resolves to an *existing* conversation would duplicate.

## Skill Dependencies

- `architecture/component-patterns.md` — Server/Client split, `memo` + `displayName`
- `architecture/state.md` — search state stays local, conversations live in Redux
- `design-system/colors.md`, `spacing.md`
- `workflow/no-use-effect.md` — search is event-driven; only the abort is a cleanup

## Architecture Strategy

**Layout.** Two-pane on `lg+`: sidebar (`w-80`, fixed) + panel (fills). Below
`lg`, the sidebar is the page and selecting a conversation navigates to the panel
— a Sheet is *not* used for the primary list, because on mobile the list is a
destination, not an overlay. The Sheet is reserved for group details in plan 08.

**Conversation list.** `GET /conversations` via `useConversations()`, sorted by
`updatedAt` desc (the API returns it that way; the selector does not re-sort).
Each row renders through the `type` discriminant — **never read `participants` on
a direct row**; it is `undefined` and it will crash.

`lastMessage` is `Message | null` post-normalization. `null` renders *"No messages
yet"*, not an empty line. An empty row looks broken; a new conversation is not.

**Search.** Local state, 250ms debounce, `AbortController` aborted on the next
keystroke and on unmount. Blank query renders nothing and issues no request.
Results filter out `session.user.id` before render.

**The self-chat guard, surfaced.** The current user is filtered from results —
but if the user searches their *own* number, the panel says so explicitly:
*"That's you."* Silently returning zero results for your own phone number looks
like a broken search. This is a small, cheap piece of the one-step-ahead thinking
the brief rewards, and it costs one conditional.

**Starting a direct conversation.** `startDirect(peer)` → thunk → `startDirectConversation(peer, currentUserId, token)`
→ `normalizeCreatedDirectConversation` → inserted into `conversations.byId` and
opened. No refetch. If the conversation already existed, the reducer replaces by
id rather than inserting a duplicate.

**Group creation.** A Dialog with a name field and a multi-select search.
Validation is **client-side and strict**, mirroring the server: name required
after trim, and **at least two others selected** (the API needs 3 total and counts
you). A disabled button with a reason beats a round-trip 400. Selected
participants render as removable chips so the count is never ambiguous.

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/layout/chat/chat-shell.tsx` | Client | responsive pane state |
| `src/components/layout/chat/sidebar/index.tsx` | Client | composes client children |
| `src/components/layout/chat/sidebar/conversation-list.tsx` | Client | selectors, click |
| `src/components/layout/chat/sidebar/conversation-row.tsx` | Client | `memo`, selected state |
| `src/components/layout/chat/sidebar/sidebar-header.tsx` | Client | current user, theme toggle |
| `src/components/layout/chat/sidebar/user-search.tsx` | Client | input, debounce, abort |
| `src/components/layout/chat/sidebar/search-result-row.tsx` | Client | `memo`, click |
| `src/components/layout/chat/sidebar/new-group-dialog.tsx` | Client | Dialog, multi-select |
| `src/components/layout/chat/sidebar/participant-chip.tsx` | Client | remove handler |
| `src/components/layout/chat/sidebar/conversation-list-skeleton.tsx` | **Server** | presentational |
| `src/hooks/use-user-search.ts` | Client hook | debounce + abort |
| `src/hooks/use-debounced-value.ts` | Client hook | generic |

`ConversationRow` is `memo`'d and takes primitives plus a stable `onSelect` — a
socket arrival must re-render one row, not eighty.

## Data & Types

No new domain types. `conversationTitle()` and `conversationSubtitle()` already
exist in `src/types/chat.ts` and handle the union — use them rather than
branching on `type` in JSX.

## Design System

- Sidebar `bg-surface dark:bg-surface-dark`, panel `bg-canvas dark:bg-canvas-dark`
  — the panel is the deeper surface so the message list reads as the content well
- Selected row: `bg-signal-50 dark:bg-signal-900/40` **plus** a
  `border-l-2 border-signal-500` rail. Selection is never colour alone
- Unread badge in `pulse-500` — the reserved "live" accent, used nowhere decorative
- Avatar fallback: initials on a hue derived deterministically from the user id,
  drawn from the `signal-*` ramp only, so it never leaves the palette
- Timestamps `font-mono text-xs text-ink-muted`
- Row hover `bg-surface-raised dark:bg-surface-raised-dark`, 150ms CSS transition

## State

| State | Home |
|---|---|
| Conversations, active id, unread | `chat-slice` (plan 02) |
| Search query, results, in-flight | local `useState` in `use-user-search` |
| Group dialog open + selection | local `useState` in `new-group-dialog` |

## Accessibility

- The list is `role="list"`; rows are `<button>` elements inside `role="listitem"`
  — clickable `<div>`s are not acceptable here
- The selected row carries `aria-current="true"`
- Search input is labelled, `type="search"`, `role="searchbox"` implicit
- Results announce count via `aria-live="polite"` — *"3 people found"*
- Unread badge has an `sr-only` expansion: *"3 unread messages"*, not a bare number
- Group dialog: focus trapped by Radix, focus returns to the trigger on close, and
  the disabled submit explains itself via `aria-describedby` rather than a tooltip
- Full keyboard path: search → arrow through results → Enter to start

## Testing Strategy

`tests/components/chat/user-search.test.tsx`:
- [⬜] blank query issues **no** request
- [⬜] the current user is filtered from results
- [⬜] searching your own number shows *"That's you."*
- [⬜] a keystroke aborts the previous request
- [⬜] zero results renders the empty state, not a blank panel

`tests/components/chat/conversation-list.test.tsx`:
- [⬜] a direct row renders the peer's name; a group row renders the group name
- [⬜] a `null` `lastMessage` renders "No messages yet"
- [⬜] loading → skeleton; error → retry that does not clear loaded rows

`tests/components/chat/new-group-dialog.test.tsx`:
- [⬜] submit disabled with a blank name
- [⬜] submit disabled with fewer than two others selected, with the reason shown
- [⬜] valid submit dispatches `createGroupConversation`

`e2e/conversations.spec.ts`: search → start a direct chat → it appears in the
list; create a group with two others → it appears with the right member count.

## Performance

- `memo` on both row components; `useCallback` on `onSelect`
- Debounce 250ms + abort — at most one in-flight search
- Radix `ScrollArea` for the sidebar (not the message list, per plan 01)
- Avatar initials computed in a `useMemo` keyed on user id

## Affected Files

- `src/app/chat/page.tsx` — render `ChatShell` inside `AuthGate`

## New Files

- `src/components/layout/chat/chat-shell.tsx`
- `src/components/layout/chat/sidebar/*.tsx` — the nine components above
- `src/hooks/{use-user-search,use-debounced-value}.ts`
- `tests/components/chat/{user-search,conversation-list,new-group-dialog}.test.tsx`
- `e2e/conversations.spec.ts`

## Implementation Steps

- [⬜] **1 — `use-debounced-value`.** Generic, tested.
- [⬜] **2 — `ChatShell`.** Two-pane responsive layout; empty panel state
  (*"Pick a conversation, or start one"*) when nothing is selected.
- [⬜] **3 — `ConversationRow` + skeleton.** Union-safe via `conversationTitle` /
  `conversationSubtitle`. Loading, empty, and error states before real data.
- [⬜] **4 — `ConversationList`.** Wire `useConversations()`; all four states.
- [⬜] **5 — `SidebarHeader`.** Current user, theme toggle, new-chat and new-group
  triggers.
- [⬜] **6 — `use-user-search` + `UserSearch`.** Debounce, abort, self-filter,
  *"That's you."*, empty and error states.
- [⬜] **7 — Start direct.** Wire `startDirect`; verify no refetch and no duplicate
  row when the conversation already existed.
- [⬜] **8 — `NewGroupDialog`.** Multi-select, chips, both client-side rules,
  disabled-with-reason submit.
- [⬜] **9 — Tests + e2e.**
- [⬜] **10 — Gate.** `pnpm run check:all`, `pnpm run test`, the e2e spec on
  chromium-desktop.

## Verification

- [⬜] `grep -rn "\.participants" src/components` — every hit is inside a
      `type === 'group'` branch
- [⬜] Searching `+15551234567` returns results and does **not** 500
- [⬜] Your own name never appears as a startable result
- [⬜] Group submit is impossible with one participant selected
- [⬜] Loading / empty / error render for both the list and search
- [⬜] Axe clean; keyboard-only path works end to end
- [⬜] 375px: sidebar is the page; selecting navigates to the panel

## Risks & Open Questions

- **`sanitizeSearchTerm` strips `+`, so `+1555…` searches as `1555…`.** That still
  substring-matches the stored number, which is why it works — but a user who
  types *only* `+` gets a blank term and no results. Show the "type to search"
  hint rather than an empty-results state in that case.
- **Shared demo server.** Search will surface other candidates' test accounts.
  Not fixable client-side, and worth one line in the write-up.
- **No group-leave affordance yet** — that is plan 08. If 08 is cut, a member who
  joins a group cannot leave it. Note it in the write-up rather than half-building it.
