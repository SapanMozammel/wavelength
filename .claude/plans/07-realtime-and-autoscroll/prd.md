# Feature: Real-time & Auto-scroll ★

Socket lifecycle, live message arrival, unread state, and the scroll discipline
the brief calls out by name.

> The last of the three graded-core plans, with
> [`05-message-list`](../05-message-list/prd.md) and
> [`06-composer-and-sending`](../06-composer-and-sending/prd.md).

## Context

Two brief requirements:

> **Real-time updates** — new incoming messages should appear automatically,
> without the user needing to refresh.
>
> **Auto-scroll** — the view should auto-scroll to the latest message by default,
> but should not force-scroll the user down if they've scrolled up to read
> earlier messages.

The second is unusually specific, which means it is being tested deliberately.
Most implementations scroll to bottom on every array change and fail it.

API facts, already handled in `src/lib/`:

- **The socket lives at the origin ROOT, not `/api`.** `NEXT_PUBLIC_SOCKET_URL`
  exists separately for this reason; pointing it at the REST base fails silently.
- **[Quirk 2] `message:new` sends `id` + epoch-ms `createdAt`**, unlike REST's
  `_id` + ISO. `normalizeSocketMessage` already unifies them.
- **[Quirk 15] The sender gets no echo.** Never wait on the socket for your own
  message — plan 06 handles it with local echo.
- **[Quirk 20] Cold starts of 30–60 seconds.** The socket is already configured
  with a long timeout and a generous reconnection schedule. Narrating it is
  [plan 09](../09-cold-start-narration/prd.md).

## Adoption Brief

**Adopted:** `createChatSocket` and `isAuthError` from
[`src/lib/socket/client.ts`](../../../src/lib/socket/client.ts) (built),
`normalizeSocketMessage`, `receiveLive` from plan 02's merge module,
`socketStatusChanged` / `liveMessageReceived` reducers.

**NOT adopted:** a socket singleton — `createChatSocket` deliberately returns a
fresh instance so a token change yields a clean connection rather than a
half-authenticated old one. `scrollIntoView({ behavior: 'smooth' })` for new
arrivals — it is interruptible and races with a user actively scrolling; explicit
`scrollTop` assignment is deterministic. Typing indicators / presence / read
receipts — the API supports none, and inventing client-only versions is worse
than their absence.

## Skill Dependencies

- `workflow/no-use-effect.md` — the socket is the textbook `useMountEffect` case:
  true external-system setup with a cleanup. It lives in a hook, never a component
- `architecture/state.md` — socket status in Redux; scroll position in refs
- `external/testing/playwright-best-practices/advanced/multi-context.md` — two
  browser contexts to prove real-time

## Architecture Strategy

### Socket lifecycle

`src/hooks/use-chat-socket.ts`, mounted **once** in `ChatShell`:

```
useMountEffect(() => {
  const socket = createChatSocket(token);
  socket.on('connect',        → socketStatusChanged('connected'))
  socket.on('disconnect',     → socketStatusChanged('disconnected'))
  socket.io.on('reconnect_attempt', → socketStatusChanged('reconnecting'))
  socket.on('connect_error',  → isAuthError(e) ? 'unauthorized' : 'reconnecting')
  socket.on('message:new',    → normalize → dispatch(liveMessageReceived))
  socket.on('conversation:updated', → dispatch(fetchConversations()))
  return () => socket.close();
})
```

The connection is keyed on the token: `<ChatShell key={session.token} />`, so a
token change remounts and reconnects cleanly (`no-use-effect` Rule 5) instead of
a dependency array trying to tear down and rebuild in place.

`connect_error` with an auth message → `socketStatusChanged('unauthorized')` →
the existing listener middleware clears the session. The socket does not each
independently decide to log the user out.

### Live arrival

`liveMessageReceived` routes by `conversationId`:

- **Thread exists in the store** → `receiveLive` (no-op if the `id` is already
  present — which it will be if the user just loaded that page)
- **Thread not loaded** → do **not** create a thread. Bump `unread` and update
  the conversation row's `lastMessage` preview only. Fabricating a partial thread
  from one socket message means the eventual history fetch merges against a
  thread with a hole in it
- **Conversation not in the list at all** (someone added you to a new group) →
  `fetchConversations()`, debounced so a burst of arrivals is one refetch

Unread increments only when the conversation is **not** the active one. Opening
a conversation clears it.

### Auto-scroll — the part being tested

Three questions, three separate answers. Conflating them is the bug.

| Trigger | Behaviour |
|---|---|
| Initial load | Jump to bottom, no animation, before paint |
| **Own** message sent | Always scroll to bottom, regardless of position — sending is an explicit intent to see the result |
| **Incoming** message, user near bottom | Scroll to bottom |
| **Incoming** message, user scrolled up | **Do not move.** Show a "N new messages" pill |
| Older page prepended | Preserve position via `use-scroll-anchor` (plan 05) |

"Near bottom" is `scrollHeight - scrollTop - clientHeight < 80`. A **threshold,
not equality** — a trackpad leaves fractional `scrollTop` values, and exact
comparison classifies a user who is visibly pinned to the bottom as scrolled-away.
That single detail is the difference between passing and failing the requirement.

`isNearBottom` lives in a **ref**, updated by a passive scroll listener, and is
mirrored to `useState` only when it crosses the threshold — so scrolling does not
re-render the list at 60fps, but the pill's visibility still reacts.

The pill counts arrivals since the user scrolled away, jumps to bottom on click,
and clears. It is a real affordance, not decoration: without it, a message that
arrives while reading history is invisible.

### Reconnect recovery

On reconnect after a disconnect longer than a few seconds, messages may have been
missed. On `connect` **when the previous status was `disconnected` or
`reconnecting`**, refetch the active thread's latest page and merge — `receiveLive`
dedupes by id, so re-fetched messages already present are no-ops. Silent gaps in
history are worse than one redundant request.

### Connection status, surfaced honestly

| Status | UI |
|---|---|
| `connecting` (first) | Plan 09's cold-start narration |
| `connected` | A `pulse-500` dot in the panel header. No banner — a working connection needs no announcement |
| `reconnecting` | Amber strip: *"Reconnecting…"* |
| `disconnected` | Strip: *"Not connected — messages won't send"* + composer disabled (plan 06) |
| `unauthorized` | Session cleared, redirect to `/login` |

Plus `navigator.onLine` via `useSyncExternalStore` — a device-level offline is
reported as *"You're offline"*, which is actionable, rather than *"Reconnecting"*,
which is not.

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/layout/chat/panel/new-messages-pill.tsx` | Client | `memo`, click |
| `src/components/layout/chat/connection-status.tsx` | Client | reads socket status |
| `src/components/layout/chat/panel/live-indicator.tsx` | Client | `memo`, pulse dot |
| `src/hooks/use-chat-socket.ts` | Client hook | `useMountEffect` + cleanup |
| `src/hooks/use-auto-scroll.ts` | Client hook | refs, passive listener, layout effect |
| `src/hooks/use-online-status.ts` | Client hook | `useSyncExternalStore` |

## Data & Types

No new domain types. `SocketStatus` already exists in
[`src/lib/socket/client.ts`](../../../src/lib/socket/client.ts) and is re-exported
through the slice.

`src/lib/socket/client.ts` gains one export: a `SOCKET_EVENTS` constant so event
names are not stringly-typed at three call sites.

## Design System

- Live dot — `bg-pulse-500` with the existing `animate-pulse-ring` keyframe.
  This is the one place cyan appears in the chat UI; reserving it for "live" makes
  it mean something
- Reconnecting strip — `bg-warning/10 text-warning`, full-width above the composer
- Offline strip — `bg-danger/10 text-danger`
- New-messages pill — floating, `bottom-20`, centred, `bg-signal-600 text-white`,
  `rounded-full shadow-lg`, entering with Framer Motion (a one-off entrance, which
  is what Framer is for; the continuous pulse stays a CSS keyframe)
- Status strips are never colour-only: each carries an icon and text

## State

| State | Home |
|---|---|
| `socketStatus`, `unread` | `chat-slice` |
| `isNearBottom` | **ref** in `use-auto-scroll`, mirrored to state only on threshold cross |
| New-message count since scroll-away | local state in `use-auto-scroll` |
| `navigator.onLine` | `useSyncExternalStore`, not Redux |

## Accessibility

- The message list is already `role="log"` + `aria-live="polite"` (plan 05) —
  **polite, not assertive**, so an arrival never interrupts a screen-reader user
  mid-sentence. Restated because this is the plan that makes arrivals happen
- The new-messages pill is a real `<button>` with the count in its accessible
  name: *"3 new messages, jump to latest"*
- Status strips are `role="status"` (polite), except `unauthorized` which is
  `role="alert"` — being logged out is worth interrupting for
- Auto-scroll must not steal focus. Scrolling is `scrollTop` assignment, never
  `element.focus()`
- `prefers-reduced-motion` is global; the pill's entrance is covered by it

## Testing Strategy

`tests/hooks/use-auto-scroll.test.ts` (jsdom, with mocked scroll metrics):
- [⬜] near bottom (delta < 80) + arrival → scrolls
- [⬜] scrolled up (delta > 80) + arrival → does **not** scroll, count increments
- [⬜] own message while scrolled up → **scrolls anyway**
- [⬜] fractional `scrollTop` (e.g. 0.5 from the bottom) still counts as near-bottom
- [⬜] pill click → scrolls to bottom and resets the count

`tests/store/chat-slice.test.ts` (extended):
- [⬜] arrival for the active conversation → no unread increment
- [⬜] arrival for an inactive conversation → unread +1, preview updated, **no
      thread fabricated**
- [⬜] duplicate arrival by `id` → no-op

`e2e/realtime.spec.ts` — **two browser contexts**, the definitive proof:
- [⬜] A and B in the same conversation; B sends; A sees it with no reload
- [⬜] A scrolls up; B sends; A's viewport **does not move** and the pill appears
- [⬜] A clicks the pill → jumps to bottom, pill clears
- [⬜] A sends while scrolled up → A's own view scrolls to bottom

## Performance

- Passive scroll listener (`{ passive: true }`), ref-backed, no per-frame render
- `receiveLive` is O(1) dedupe against `byId`
- `conversation:updated` refetch debounced 300ms
- One socket for the whole app, mounted at `ChatShell`, closed on unmount
- `transports: ['websocket']` already set — skips the polling handshake

## Affected Files

- `src/components/layout/chat/chat-shell.tsx` — mount `use-chat-socket`, key on token
- `src/components/layout/chat/panel/message-list.tsx` — wire `use-auto-scroll`,
  render the pill
- `src/store/slices/chat-slice.ts` — `liveMessageReceived` routing, unread rules,
  reconnect-refetch trigger
- `src/lib/socket/client.ts` — add `SOCKET_EVENTS`

## New Files

- `src/components/layout/chat/panel/{new-messages-pill,live-indicator}.tsx`
- `src/components/layout/chat/connection-status.tsx`
- `src/hooks/{use-chat-socket,use-auto-scroll,use-online-status}.ts`
- `tests/hooks/use-auto-scroll.test.ts`
- `e2e/realtime.spec.ts`

## Implementation Steps

- [⬜] **1 — `use-online-status`.** `useSyncExternalStore` over the online/offline
  events, SSR-safe.
- [⬜] **2 — `use-chat-socket`.** `useMountEffect`, all six handlers, clean
  `socket.close()` teardown. Key `ChatShell` on the token.
- [⬜] **3 — `liveMessageReceived` routing.** Active vs inactive vs unknown
  conversation, per the three rules above. Extend the slice tests first.
- [⬜] **4 — `ConnectionStatus` + `LiveIndicator`.** Every status maps to a
  distinct, honest, non-colour-only presentation.
- [⬜] **5 — `use-auto-scroll`.** Ref-backed `isNearBottom` with the 80px
  threshold, passive listener, `useLayoutEffect` for the bottom jump, arrival
  counter. Unit-test before wiring.
- [⬜] **6 — `NewMessagesPill`.** Count in the accessible name; click jumps and clears.
- [⬜] **7 — Wire into `MessageList`.** Initial jump, own-send jump, incoming
  conditional jump — three distinct triggers, not one shared effect.
- [⬜] **8 — Reconnect recovery.** Refetch the active thread on `connect` when the
  prior status was `disconnected` / `reconnecting`.
- [⬜] **9 — Two-context e2e.** The full spec above.
- [⬜] **10 — Gate.** `pnpm run check:all`, `pnpm run test`, `pnpm run test:e2e`.

## Verification

- [⬜] Two browsers, same conversation: a message appears without a refresh
- [⬜] Scrolled up + incoming message → **the viewport does not move**, pill appears
- [⬜] Own send while scrolled up → scrolls to bottom
- [⬜] A message for a closed conversation → unread badge, no thread fabricated
- [⬜] Kill the network → "Not connected", composer disabled; restore → reconnects
      and backfills without duplicates
- [⬜] No duplicate bubbles when a socket arrival races the history fetch
- [⬜] Scrolling does not re-render the message list (React DevTools profiler)
- [⬜] Axe clean; the log region is `polite`, never `assertive`

## Risks & Open Questions

- **The 80px threshold is a judgement call.** Named constant, tunable in one place.
  Too small and trackpad momentum classifies a pinned user as scrolled-away; too
  large and a user reading two lines up gets yanked down.
- **Reconnect backfill could miss a long gap.** It refetches one page. A
  disconnect longer than one page of traffic still leaves a hole. Acceptable for
  this scope; named in the write-up rather than silently wrong.
- **Two-context Playwright needs two real accounts** on a shared demo server.
  Generate unique phone numbers per run (timestamp-suffixed) so parallel CI runs
  do not collide, and never hardcode a fixture number.
- **`conversation:updated` payload is `{ _id }` only** — a refetch is the reliable
  response, which is why the debounce matters if several fire at once.
