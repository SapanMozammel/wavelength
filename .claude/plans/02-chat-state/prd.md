# Feature: Chat State Container

One reducer that owns message merge order, plus the thunks and selectors every
chat surface reads from.

## Context

`CLAUDE.md` defers this decision explicitly: *"Chat data is deliberately not in
Redux yet — decide its home in the PRD before implementing. The constraint that
matters: optimistic sends, socket arrivals, and paginated history all mutate the
same message list, so whatever holds it needs one reducer that owns merge order."*

This plan makes that decision and builds it. **It is written before any chat UI
exists on purpose** — three sources writing to a `useState` array from three
different effects is the specific way this feature goes wrong, and it is
unrecoverable once components depend on it.

Three API facts drive the design, all already absorbed by
[`normalize.ts`](../../../src/lib/api/normalize.ts) and **not to be re-solved here**:
REST and socket messages have different shapes; the sender gets no socket echo;
the `before` cursor is inclusive.

## Decision: Redux Toolkit slice, not RTK Query

RTK Query is already available and was considered. Rejected because its cache
entry is a value the server owns, and this list has three writers the server
knows nothing about — an optimistic message keyed by `clientId`, a socket arrival
that must be a no-op if already present, and an older page that prepends without
disturbing the tail. Expressing that as `updateQueryData` patches spread merge
logic across call sites, which is the exact failure `CLAUDE.md` warns about.

A hand-written slice puts all four merge cases in one pure function that can be
unit-tested before a single component imports it.

## Adoption Brief

**Adopted:** `@reduxjs/toolkit` `createSlice` + `createAsyncThunk` (present),
the existing `sessionSlice`, `src/lib/api/*` (built and tested).

**NOT adopted:** RTK Query (above). `redux-persist` — the existing listener
middleware already persists the session, and message history is refetched, not
restored. Normalizing users into a separate entity slice — participants arrive
embedded in every conversation payload and are stale-safe there.

## Skill Dependencies

- `architecture/state.md` — always `useAppDispatch` / `useAppSelector`, never raw
- `workflow/no-use-effect.md` — thunks dispatch from event handlers and from
  `useMountEffect` inside `src/hooks/`, never from a component effect
- `workflow/testing.md` — the merge function is tested before it is used

## Architecture Strategy

**Shape.** One slice, `src/store/slices/chat-slice.ts`:

```
conversations: { byId: Record<id, Conversation>, orderedIds: string[],
                 status: AsyncStatus, error: string | null }
threads:       Record<conversationId, Thread>
activeConversationId: string | null
unread:        Record<conversationId, number>
socketStatus:  SocketStatus
```

```
Thread = { byId: Record<id, Message>, orderedIds: string[],
           hasMore: boolean, nextCursor: string | null,
           status: AsyncStatus, olderStatus: AsyncStatus, error: string | null }
```

`orderedIds` is **oldest-first**, matching render order, so the list never sorts
during render.

**The merge function** lives in `src/store/slices/chat-merge.ts` as pure
functions over a `Thread`, exported independently of the slice so tests import
it with no store:

| Function | Rule |
|---|---|
| `appendOptimistic(thread, message)` | append; keyed by `clientId`, `status: 'sending'` |
| `confirmOptimistic(thread, clientId, server)` | replace **in place** by position — never delete-then-append, which reorders concurrent sends |
| `failOptimistic(thread, clientId)` | `status: 'failed'`; **never remove** — a vanishing message reads as "sent" |
| `receiveLive(thread, message)` | no-op if `id` present; else insert by `createdAt` (binary search, not push — sockets can deliver out of order) |
| `appendHistory(thread, page)` | initial load, replaces contents |
| `prependPage(thread, page)` | prepend, dedupe by `id` |

A message present by `clientId` and then confirmed keeps its array index. That
single rule is what stops two fast sends from swapping places.

**Selectors** are memoized with `createSelector` in
`src/store/slices/chat-selectors.ts`. `selectThreadMessages` maps `orderedIds`
through `byId` — the one place that array is materialised, so a socket arrival
in conversation B does not re-render conversation A's list.

**Thunks** (`createAsyncThunk`, token read from `getState().session.token`):
`fetchConversations`, `fetchMessages`, `fetchOlderMessages`, `sendChatMessage`,
`startDirect`, `createGroupConversation`. Group mutation thunks land in
[`08-group-management`](../08-group-management/prd.md).

`sendChatMessage` is the interesting one: it dispatches `appendOptimistic`
synchronously with a `crypto.randomUUID()` `clientId` *before* awaiting, then
confirms or fails. It never waits on the socket — the sender gets no echo.

**Error handling** — every thunk rejects with the `kind` from
`classify()` in [`errors.ts`](../../../src/lib/api/errors.ts), never a raw
message. `kind: 'unauthorized'` is handled once, by listener middleware that
clears the session; individual thunks do not each redirect.

## Component Type Decision

No components. Hooks created here are client-only by nature:

| File | Type | Reason |
|---|---|---|
| `src/hooks/use-conversations.ts` | Client hook | `useMountEffect` + selectors |
| `src/hooks/use-thread.ts` | Client hook | per-conversation selectors |

`use-thread.ts` is designed for **key-based remount** (`no-use-effect` Rule 5):
the panel renders `<MessageList key={conversationId} />`, so switching threads
remounts and `useMountEffect` loads history. No dependency choreography, no
stale-thread race.

## Data & Types

Extends `src/types/chat.ts` — additive only:

```ts
export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ChatErrorKind = 'network' | 'unauthorized' | 'not-found'
  | 'forbidden' | 'validation' | 'server' | 'unknown';
```

No wire types leak in. The slice stores `Conversation` and `Message` only.

## Design System

Not applicable — no UI.

## State

This *is* the state plan. Ownership boundaries, to prevent drift:

| State | Home |
|---|---|
| Conversations, messages, unread, socket status | `chat-slice` |
| JWT + current user | existing `session-slice` |
| Theme | `next-themes` — never Redux |
| Composer draft text | local `useState` in the composer |
| Scroll position / "is near bottom" | refs in `use-auto-scroll`, **never Redux** |
| Search query + results | local state in the search panel |

Scroll position in Redux would re-render the whole list on every scroll frame.
Named here because it is the tempting mistake.

## Accessibility

None directly. The slice exposes `unread` counts that plans 04 and 07 render
into an `aria-live` region.

## Testing Strategy

`tests/store/chat-merge.test.ts` is written **first**, and covers:

- [✅] optimistic append then confirm → one message, server `id`, same index
- [✅] two concurrent optimistic sends confirm out of order → original order held
- [✅] socket arrival with an `id` already present → no-op, no duplicate
- [✅] socket arrival out of chronological order → inserted by `createdAt`
- [✅] older page prepends without disturbing the tail
- [✅] failed send stays in the list with `status: 'failed'`
- [✅] a page whose first element repeats the cursor → deduped (belt-and-braces;
      `normalizeMessagePage` already strips it)

`tests/store/chat-slice.test.ts` covers thunk lifecycles against a mocked
`src/lib/api`, including the `unauthorized` path clearing the session once.

## Performance

- `createSelector` per conversation id, so an arrival in one thread does not
  re-render another
- `byId` + `orderedIds` gives O(1) dedupe instead of `Array.find` per socket event
- Binary-search insert instead of sort-on-every-arrival

## Affected Files

- `src/store/index.ts` — register `chat` reducer; add the unauthorized listener
- `src/types/chat.ts` — add `AsyncStatus`, `ChatErrorKind`
- `src/store/hooks/index.ts` — verify typed hooks cover the new state

## New Files

- `src/store/slices/chat-merge.ts` — the six pure merge functions
- `src/store/slices/chat-slice.ts` — slice, thunks, reducers
- `src/store/slices/chat-selectors.ts` — memoized selectors
- `src/hooks/use-conversations.ts` — list + mount fetch
- `src/hooks/use-thread.ts` — per-conversation messages + mount fetch
- `tests/store/chat-merge.test.ts`, `tests/store/chat-slice.test.ts`

## Implementation Steps

- [✅] **1 — Types.** Add `AsyncStatus` and `ChatErrorKind` to `src/types/chat.ts`.
- [✅] **2 — Merge tests, before merge code.** Write `chat-merge.test.ts` covering
  all seven cases above against the intended signatures. They fail; that is the point.
- [✅] **3 — Merge functions.** Implement `chat-merge.ts` until step 2 is green.
  Pure, no Redux import, no `immer` assumptions.
- [✅] **4 — Slice.** `chat-slice.ts` — initial state, sync reducers
  (`conversationOpened`, `socketStatusChanged`, `liveMessageReceived`,
  `unreadCleared`, `optimisticFailed`), delegating every list mutation to `chat-merge`.
- [✅] **5 — Thunks.** `fetchConversations`, `fetchMessages`, `fetchOlderMessages`,
  `sendChatMessage`, `startDirect`, `createGroupConversation`. Each maps rejection
  through `classify()`.
- [✅] **6 — Unauthorized listener.** One listener middleware entry: any rejected
  thunk with `kind: 'unauthorized'` dispatches `sessionCleared` **once**, not per
  in-flight request.
- [✅] **7 — Selectors.** `chat-selectors.ts` with `createSelector`.
- [✅] **8 — Hooks.** `use-conversations.ts` and `use-thread.ts`, each using
  `useMountEffect` from plan 01 — no direct `useEffect`.
- [✅] **9 — Gate.** `pnpm run test` green, `pnpm run check:all` green.

## Verification

- [✅] `chat-merge.ts` imports nothing from Redux or React
- [✅] All seven merge cases pass
- [✅] `grep -rn "useEffect" src/store src/hooks` finds it only inside
      `use-mount-effect.ts`
- [✅] No component imports `chat-merge` directly — components use selectors
- [✅] `grep -rn "types/api" src/store` returns nothing

## Risks & Open Questions

- **Out-of-order socket delivery is assumed, not proven.** The probe did not test
  it. Binary-search insert costs nothing and is correct either way, so this is
  defensive rather than speculative.
- **`crypto.randomUUID` needs a secure context.** True on `localhost` and HTTPS,
  which covers dev and Vercel. Falls back to a counter-based id if absent.
- **Unread counting has no server support.** It is derived client-side from
  arrivals while a conversation is not active, and resets on open. It does not
  survive reload — stated in the write-up rather than faked.
