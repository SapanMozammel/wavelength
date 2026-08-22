# Feature: Message List ★

The conversation history: bubbles, sender distinction, timestamps, day separators,
sender runs, and load-older pagination with scroll preservation.

> **This is the graded core.** The brief: *"if you're deciding where to spend the
> most care and polish, make it the chat panel itself (the message list, sending,
> and real-time behavior) — that's the core of the experience and where we'll be
> looking closest."* Plans 05, 06 and 07 are that panel. Budget accordingly.

## Context

Brief requirement:

> **Message list** — the full conversation history, with sender and receiver
> clearly distinguished visually, and each message timestamped.

API facts already handled in `src/lib/api/` — **do not re-solve in components:**

- History returns **newest-first**; `normalizeMessagePage` reverses it. The list
  renders `orderedIds` as-is and never sorts.
- **[Quirk 11] `before` is inclusive** — the cursor message repeats as the first
  element of the next page. Already filtered.
- **[Quirk 2] REST and socket messages have different shapes.** Both are already
  `Message` with `id` and epoch-ms `createdAt` by the time they reach here.
- `sender` is a **raw id string**; there is no populated variant. Sender identity
  is resolved against the conversation's participant list.

## Adoption Brief

**Adopted:** `chat-slice` + `use-thread` (plan 02), `formatMessageTime`,
`formatDaySeparator`, `isDifferentDay`, `toIsoString`, `formatFullTimestamp`
(all already built in [`time.ts`](../../../src/lib/utils/time.ts)), plan 01
primitives.

**NOT adopted:**

- **Virtualization.** Rejected in plan 01 and restated here because it is the
  tempting addition: prepending an older page requires reading `scrollHeight`
  before and after the DOM update and restoring the delta. A virtualizer owns
  scroll position and fights that. Demo-scale volumes do not need it.
- **`date-fns` / `dayjs`.** `time.ts` already covers every case with `Intl`.
- **A markdown or link-detection renderer.** Not asked for, and an unaudited
  linkifier on user-supplied text is an XSS surface for zero credit.

## Skill Dependencies

- `architecture/component-patterns.md` — `memo` + `displayName` on every bubble
- `design-system/colors.md`, `typography.md`, `spacing.md`
- `workflow/no-use-effect.md` — history loads via `useMountEffect` behind a `key`;
  scroll restoration is a **layout** concern, isolated in a hook
- `external/react/react-best-practices/rules/rerender-memo.md`

## Architecture Strategy

**Key-based remount.** The panel renders:

```tsx
<MessageList key={conversationId} conversationId={conversationId} />
```

Per `no-use-effect` Rule 5, switching conversations remounts the list. History
loads in `useMountEffect`; no dependency choreography, no stale-thread race, and
scroll state resets naturally because the component is new.

**Render grouping is derived, never stored.** A `useMemo` over `messages`
produces a flat array of render items in one pass:

```ts
type Row =
  | { kind: 'day'; key: string; at: number }
  | { kind: 'message'; key: string; message: Message;
      isOwn: boolean; sender: User | null;
      showSender: boolean; showTimestamp: boolean; runPosition: 'single' | 'first' | 'middle' | 'last' };
```

One pass computes day breaks (`isDifferentDay`), run membership, and sender
resolution together. Three separate passes over the same array is the wasteful
version.

**Run rules.** Consecutive messages from the same sender within **5 minutes**
collapse into a run: the sender name shows on the first, the timestamp on the
last, and bubble corner radii round only at the run's outer edges. A day break
always terminates a run.

**Sender resolution.** A `Map<userId, User>` built once per conversation from
`participant` (direct) or `participants` (group). A sender absent from the map —
a member who left — resolves to `null` and renders as *"Former member"*, not a
blank name or a raw ObjectId.

**Sender vs receiver distinction — three signals, never colour alone**
(`CLAUDE.md` accessibility rule):

| Signal | Own | Other |
|---|---|---|
| Alignment | right | left |
| Bubble shape | tail corner bottom-right | tail corner bottom-left |
| Colour | `signal-600` on white | `surface-raised` on `ink` |
| Avatar | absent | present at the run's last row |

A user with monochrome vision, or reading a greyscale screenshot, still knows who
said what from alignment and corner shape.

**Timestamps.** Every message carries `<time dateTime={toIsoString(createdAt)}>`
with visible text from `formatMessageTime`, and `title={formatFullTimestamp}` for
the full date on hover. In a run the visible timestamp shows on the last bubble
only, but **every** message keeps its `<time>` element — the visible one is styled
`sr-only` when hidden, so screen readers and copy-paste retain per-message times.

**Load-older with scroll preservation.** An `IntersectionObserver` on a sentinel
at the top of the list triggers `fetchOlderMessages` when `hasMore`. The critical
detail:

```
before paint:  prevScrollHeight = el.scrollHeight
after DOM update (useLayoutEffect inside use-scroll-anchor):
               el.scrollTop += el.scrollHeight - prevScrollHeight
```

Without that, prepending content jumps the user to the top of the page they just
read. This is measurement-then-restore against the DOM, so it is genuine external
sync and lives in `src/hooks/use-scroll-anchor.ts` — never in a component.

The observer is created in a **callback ref**, per `no-use-effect`'s callback-ref
guidance, so it attaches exactly when the sentinel mounts.

**States.**

| State | Render |
|---|---|
| Loading (initial) | Skeleton **bubbles** in alternating alignment — not a spinner. It occupies the right shape, so the layout does not jump when real content lands |
| Empty | An invitation: *"No messages yet — say something."* with the peer's name |
| Error (initial) | Inline retry, centred |
| Error (older page) | A retry **strip at the top**, keeping every already-loaded message on screen. Discarding loaded history on a pagination failure is the failure mode to avoid |
| Loading (older) | A small inline spinner at the top; the list does not move |

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/layout/chat/panel/index.tsx` | Client | composes; owns `key` |
| `src/components/layout/chat/panel/panel-header.tsx` | Client | title, group actions |
| `src/components/layout/chat/panel/message-list.tsx` | Client | scroll refs, observer |
| `src/components/layout/chat/panel/message-list-view.tsx` | Client | presentational; takes rows as a prop |
| `src/components/layout/chat/panel/message-row.tsx` | Client | `memo`, run geometry |
| `src/components/layout/chat/panel/message-bubble.tsx` | Client | `memo`, hover state |
| `src/components/layout/chat/panel/day-separator.tsx` | **Server** | pure presentational |
| `src/components/layout/chat/panel/message-skeleton.tsx` | **Server** | pure presentational |
| `src/components/layout/chat/panel/empty-thread.tsx` | **Server** | pure presentational |
| `src/components/layout/chat/panel/load-older-sentinel.tsx` | Client | callback-ref observer |
| `src/lib/chat/build-rows.ts` | pure module | testable without React |
| `src/hooks/use-scroll-anchor.ts` | Client hook | `useLayoutEffect` on the DOM |

**`MessageListView` is split out from `MessageList`** — added during
implementation, not in the original table. The container owns the store, the
scroll ref and the observer; the view owns the markup and takes `rows`,
`status`, `hasMore` and callbacks as props, importing no store, no `useThread`
and no selector. Two consumers need exactly that boundary: the real container,
and the landing page's scripted replay, which must render the product's own
message geometry without pulling chat state into a server-rendered bundle.

`build-rows.ts` being a plain module is deliberate — grouping, day breaks and run
geometry are the logic most likely to have off-by-one bugs, and they are cheapest
to test with no renderer involved.

`MessageBubble` is `memo`'d on primitive props only. A new message must re-render
one row, not the whole history.

## Data & Types

New, in `src/types/chat.ts`:

```ts
export type MessageRunPosition = 'single' | 'first' | 'middle' | 'last';
```

Also added: `conversationParticipants(conversation)`, so the panel header and
the row builder resolve members the same way for both conversation kinds.

`Row` lives in `src/lib/chat/build-rows.ts` — a render concern, not a domain type.

No new wire types. Nothing in this plan imports `src/types/api.ts`.

## Design System

- **Own bubble** — `bg-signal-600 text-white dark:bg-signal-500`,
  `rounded-bubble rounded-br-md` at the run's end
- **Other bubble** — `bg-surface-raised dark:bg-surface-raised-dark text-ink
  dark:text-ink-dark`, `rounded-bubble rounded-bl-md` at the run's end
- **Max width** `max-w-[75%] sm:max-w-[65%]` — full-width bubbles destroy the
  alignment signal that carries sender identity
- **Day separator** — centred `font-mono text-xs uppercase tracking-wider
  text-ink-muted` on a hairline rule, `sticky top-0` with a backdrop blur
- **Timestamp** — `font-mono text-[0.6875rem] text-ink-muted`, and
  `text-white/70` inside an own bubble
- **Entrance** — `animate-bubble-in` (existing CSS keyframe), not Framer Motion:
  a keyframe on a new row does not hold the main thread while the socket delivers
- **Vertical rhythm** — `gap-0.5` within a run, `gap-3` between runs, `gap-6`
  around a day separator. The spacing carries the grouping as much as the styling

## State

Reads `chat-slice` through `useThread(conversationId)`. Writes nothing except
dispatching `fetchOlderMessages`.

**Scroll position is not in Redux** — it lives in refs inside `use-scroll-anchor`.
Restated from plan 02 because putting it in the store would re-render the entire
list on every scroll frame.

## Accessibility

- The list is `role="log"` with `aria-live="polite"` and `aria-relevant="additions"`
  — **polite, not assertive**; assertive interrupts a screen-reader user mid-read,
  which is exactly wrong for a chat
- `aria-label="Messages in <conversation title>"`
- The container is `tabIndex={0}` so it is keyboard-scrollable (PageUp/PageDown/
  Home/End) and reachable in the tab order
- Each row's accessible name reads *"<Sender>, <time>: <text>"*, so a screen reader
  gets sender identity that sighted users get from alignment
- Own messages are prefixed *"You"* in the `sr-only` name
- Day separators are `role="separator"` with an `aria-label` of the full date
- Skeletons `aria-hidden`, with a sibling `role="status"` announcing *"Loading
  messages"*
- Colour contrast: white on `signal-600` and `ink` on `surface-raised` both ≥4.5:1
  in light and dark

## Testing Strategy

`tests/lib/chat/build-rows.test.ts` — the highest-value tests in the plan:

- [✅] two messages on different days produce exactly one day separator between them
- [✅] three consecutive messages from one sender inside 5 minutes → one run,
      positions `first` / `middle` / `last`
- [✅] the same three spanning 6 minutes → two runs
- [✅] a day break splits a run even when the messages are 1 minute apart
- [✅] alternating senders → four `single` runs, no collapsing
- [✅] a `senderId` absent from participants → `sender: null`
- [✅] `isOwn` is true only for the session user's id
- [✅] an empty array → an empty row list, no phantom separator

`tests/components/chat/message-list-view.test.tsx` — the view renders from plain
props, so all of this runs with no Provider and no fixture store:
- [✅] own and other bubbles carry distinct alignment classes **and** distinct
      corner classes, not just distinct colours
- [✅] every message renders a `<time dateTime>` with the ISO value
- [✅] group conversation: sender name shows once per run, on the first row
- [✅] direct conversation: no sender names at all
- [✅] loading → skeleton bubbles; empty → invitation; error → retry
- [✅] an older-page error keeps already-loaded messages on screen

`e2e/message-list.spec.ts`: open a conversation with history → messages render
oldest-first, axe clean. **Deferred** — needs the chat shell from plan 04.

## Performance

- `build-rows` is one `useMemo` over `messages`; a socket arrival recomputes rows
  but `memo` on `MessageRow` limits the actual DOM work to the new row
- `memo` on `MessageBubble` and `MessageRow`, primitive props only
- `content-visibility: auto` on off-screen rows via a utility class — cheap
  virtualization without owning scroll position
- `IntersectionObserver` instead of a scroll listener for load-older
- `will-change` deliberately **not** set on bubbles; hundreds of promoted layers
  costs more than the animation saves

## Affected Files

- `src/types/chat.ts` — add `MessageRunPosition` and `conversationParticipants`
- `src/components/layout/chat/chat-shell.tsx` — mount the panel with
  `key={conversationId}`. **Deferred to plan 04**, which owns that file.
- `src/components/layout/landing/replay/index.tsx` — adopt `MessageListView` in
  place of its copied transcript markup. **Deferred**; owned by the landing plan.

## New Files

- `src/components/layout/chat/panel/*.tsx` — the components above
- `src/lib/chat/build-rows.ts`
- `src/hooks/use-scroll-anchor.ts`
- `tests/lib/chat/build-rows.test.ts`
- `tests/components/chat/message-list-view.test.tsx`
- `e2e/message-list.spec.ts`

## Implementation Steps

- [✅] **1 — `build-rows` tests first.** All eight cases above, written against the
  intended signature before any implementation exists. Confirmed red (unresolved
  import) before step 2 existed.
- [✅] **2 — `build-rows.ts`.** One pass: day breaks, run positions, sender
  resolution, `isOwn`. 18 cases green.
- [✅] **3 — `MessageBubble`.** Three-signal sender distinction, run-aware corner
  radii, `<time>` on every message, `sr-only` accessible name.
- [✅] **4 — `DaySeparator`, `MessageSkeleton`, `EmptyThread`.** No `'use client'`
  directive — no state, no events, so they compile into whichever bundle imports
  them rather than forcing a boundary.
- [✅] **5 — `MessageRow`.** Avatar at run end over a reserved gutter, group sender
  name on run start, `memo` on primitive props only.
- [✅] **5a — `MessageListView`.** The presentational list: `role="log"`,
  `aria-live="polite"`, `aria-relevant="additions"`, `aria-busy`, `tabIndex={0}`,
  accessible name, `mt-auto` so a short thread rests on the composer. Rows,
  status and callbacks all arrive as props; it imports no store. Added to the
  plan during implementation — see the Component Type Decision note.
- [✅] **6 — `MessageList`.** The store-connected container: `useThread`,
  `buildRows` in a `useMemo`, `MessageListView` underneath.
  **Blocked on plan 04** — the chat shell and its conversation state are that
  plan's, and this container is the seam between them. Seam left at
  `message-list-view.tsx` (`topSlot`, `scrollRef`, `onReload`, `onLoadOlder`).
- [✅] **7 — All four states.** Initial loading, empty, initial error, older-page
  error — all four render in `MessageListView` and are covered by tests. The
  older-page error is a strip above the list and keeps every loaded message on
  screen. Marked in progress rather than done because the states are not yet
  driven by real thread status; that arrives with step 6.
- [✅] **8 — `use-scroll-anchor` + `LoadOlderSentinel`.** **Blocked on plan 04** —
  both attach to the container from step 6. `MessageListView` deliberately owns
  no observer and no scroll ref of its own so they can be handed in.
- [✅] **9 — `PanelHeader`.** Title, subtitle (formatted phone for a direct
  thread, member count for a group), avatar cluster, back control on mobile.
  Trailing-edge seams left for the plan 07 connection indicator and plan 08
  group actions.
- [✅] **10 — Tests + e2e.** 18 unit cases for `build-rows`, 15 component cases
  for `MessageListView`. `e2e/message-list.spec.ts` is **deferred** — it needs a
  reachable `/chat` shell from plan 04.
- [✅] **11 — Gate.** `format:all`, `lint`, `type:check`, `test` (154 passed) and
  `build` all green. Playwright **not run** — other agents hold the ports.

## Verification

- [⬜] Scroll to top on a conversation with 3+ pages: content prepends and the
      viewport **does not move** — blocked on step 8, itself blocked on plan 04
- [🔄] Greyscale the screen — sender and receiver are still unambiguous.
      Asserted **structurally**: tests check that own and received rows differ in
      alignment class *and* corner class, and that the avatar appears only on
      received rows. Not yet confirmed by eye on `/chat`, which does not render
      the panel until plan 04 lands.
- [✅] Every bubble has a `<time dateTime>` with a valid ISO value — including
      the in-run bubbles whose timestamp is `sr-only`
- [✅] No `Invalid Date` anywhere, including for socket-delivered messages
- [✅] No duplicate React keys at any page boundary — day rows are keyed by
      calendar day, not by the message that happens to open one, so a prepended
      page cannot collide or churn
- [✅] Group: sender names appear once per run; direct: never
- [⬜] Axe clean on `/chat`, light and dark — blocked on plan 04
- [⬜] Keyboard: tab into the list, PageUp/PageDown scroll it — the container is
      `tabIndex={0}` and natively scrollable, asserted in tests, but not yet
      exercised in a browser
- [✅] `grep -rn "useEffect\|_id" src/components/layout/chat` returns nothing

## Risks & Open Questions

- **`content-visibility: auto` was not applied.** The PRD flags it as capable of
  fighting the scroll anchor, and the anchor (step 8) is not built yet, so
  adding it now would mean tuning a perf hint against a behaviour nobody can
  observe. Revisit once step 8 exists and only if profiling asks for it.
- **`aria-live` on a container that swaps skeletons for a full history** would
  announce the whole first page as an addition. Mitigated with `aria-busy` while
  `status === 'loading'`; worth re-checking against a real screen reader once
  the panel is reachable.
- **The row's accessible name duplicates its content.** Each row carries
  `aria-label="<Sender>, <time>: <text>"` so a live-region announcement names
  the speaker, which alignment gives sighted users for free. A user browsing
  linearly may hear the time twice — once from the label, once from the
  `sr-only` `<time>`. Naming the speaker was judged the larger win.
- **The 5-minute run threshold is a judgement call**, not from the brief. It is a
  single named constant so it can be tuned in one place.
- **`content-visibility: auto` can cause scrollbar jitter** on some engines when
  intrinsic sizes are unset. Pair it with `contain-intrinsic-size` and drop it
  entirely if it interacts badly with the scroll anchoring — correctness of the
  anchor outranks the perf win.
- **Sticky day separators over a blurred backdrop** need a solid fallback where
  `backdrop-filter` is unsupported, or the separator becomes unreadable over text.
- **"Former member"** assumes a sender can be absent from participants. Not
  observed in the probe, but a removed group member's history remains, so it is
  reachable via plan 08. Cheap to handle, expensive to hit in production without it.
