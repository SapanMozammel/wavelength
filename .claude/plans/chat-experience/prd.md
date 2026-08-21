# PRD — Chat Experience (Part 1)

**Status:** `[⬜]` Not started
**Scope:** Login, conversation discovery, direct + group conversations, message
panel, real-time delivery.
**Assignment weighting:** the brief names the chat panel — message list,
sending, real-time — as where the most care should go. Steps 5–7 are the ones
that get polished last and hardest.

---

## Context you need before writing code

Read [`docs/api/quirks.md`](../../../docs/api/quirks.md) first. The API's
published spec documents no response bodies and no status codes; all shapes were
derived by probing the live server. Three findings drive this design:

- **A message has two shapes.** REST: `_id` + ISO-8601. Socket: `id` + epoch ms.
  The message list merges both streams.
- **No socket echo to the sender.** Local echo is mandatory.
- **`before` is an inclusive cursor.** Naive pagination duplicates a message per
  page.

All three are already absorbed by [`src/lib/api/normalize.ts`](../../../src/lib/api/normalize.ts),
which is built and tested. **Do not re-solve them in components.**

Already built and passing tests:

- `src/types/api.ts` (wire) and `src/types/chat.ts` (domain)
- `src/lib/api/` — `http.ts`, `index.ts`, `normalize.ts`, `errors.ts`
- `src/lib/socket/client.ts`
- `src/store/` — `sessionSlice` with localStorage persistence
- `src/lib/utils/time.ts` — message, relative, and day-separator formatting

---

## Steps

### `[⬜]` 1 — Chat state container

**Decide where conversations and messages live before building any UI.** The
constraint: optimistic sends, socket arrivals, and paginated history all mutate
the same ordered message list, so one reducer must own merge order. Three
sources writing to a `useState` array from different effects is how this feature
goes wrong.

Recommended: an RTK slice `chat-slice.ts` keyed by conversation id, with
messages held as `{ byId, orderedIds }` so that:

- an optimistic message appends by `clientId`
- the REST response replaces it by server `id` (not by appending)
- a socket arrival is a no-op if its `id` is already present
- an older page prepends without disturbing the tail

Write the merge function first, and unit-test it against all four cases above
before any component imports it.

**Gate:** `pnpm test` green with merge-order tests covering optimistic replace,
duplicate socket arrival, and page prepend.

---

### `[⬜]` 2 — Login (`/login`)

Phone number + display name. No password, no separate registration — a new
number registers automatically.

- Validate the phone client-side before submit; the API accepts almost anything,
  so a malformed number becomes an un-findable account rather than an error
- Disable submit while in flight; surface `ApiError.fieldErrors` inline
- On success dispatch `sessionEstablished`, then redirect to `/chat`
- **Pre-fill the name from the persisted session.** Login overwrites the stored
  name (quirk 14), so a returning user who retypes it slightly differently
  silently renames themselves in everyone else's conversation list
- Redirect to `/chat` if already authenticated

**Gate:** RTL test — empty submit blocked, error surfaced, success dispatches.

---

### `[⬜]` 3 — Session restore

On boot, read the persisted session and validate it with `GET /auth/me` before
trusting it. A 7-day JWT expires while a tab sits open.

- `status: 'unknown'` renders a skeleton, not a redirect — do not flash the
  login page at an authenticated user
- `unauthorized` from any request clears the session and redirects once, not per
  in-flight request

**Gate:** expired-token path lands on `/login` with no flash of `/chat`.

---

### `[⬜]` 4 — Conversation list + starting a conversation

- List from `GET /conversations`; render the `direct`/`group` union via the
  `type` discriminant — never read `participants` on a direct row
- `lastMessage` is `null` for a new conversation (normalizer already handles the
  `{}` case) — render "No messages yet", not an empty row
- Search by name or number, debounced ~250ms, request aborted on keystroke
- **Filter the current user out of results** (quirk 18) — otherwise tapping your
  own name opens an unrelated conversation (quirk 9)
- Starting a direct chat uses the peer object already in hand; no refetch
  (`normalizeCreatedDirectConversation`)
- Group creation: multi-select, **minimum 2 others** (the API needs 3 total and
  counts you), name required. Enforce both client-side — the API's messages are
  good but a disabled button is better than a 400

**Gate:** empty, loading, error, and no-results states all render. RTL test for
the self-filter.

---

### `[⬜]` 5 — Message list ★

The core of the assignment. Spend the time here.

- Full history, oldest-first (the normalizer reverses the API's order)
- Sent vs received distinguished by **alignment, bubble shape, and colour** —
  never colour alone
- Timestamp on every message; `<time dateTime>` with the ISO value, visible text
  from `formatMessageTime`
- Day separators via `isDifferentDay` / `formatDaySeparator`
- Group conversations show the sender name on received messages; consecutive
  messages from one sender collapse into a run with a single name and one
  timestamp
- Resolve sender identity from the conversation's participant list — messages
  carry only a `sender` id, never a populated user
- Load-older on scroll-to-top using `nextCursor`, **preserving scroll position**
  as content prepends (anchor on `scrollHeight` delta before/after)
- Loading: skeleton bubbles, not a spinner. Empty: an invitation to say
  something. Error: inline retry that does not discard what already loaded

**Gate:** RTL tests for grouping, day separators, and sender resolution. Axe
clean.

---

### `[⬜]` 6 — Composer + sending ★

- **Empty messages unsendable** — trimmed-empty disables the control. The API
  accepts `""` and `"   "` with a 200 (quirk 10), so this is entirely ours.
  `sendMessage()` also throws before the request as a second guard
- Enter sends, Shift+Enter newlines, auto-growing textarea with a max height
- Optimistic append with `status: 'sending'` → replaced by the server message on
  success → `status: 'failed'` with retry on error. **Never remove a failed
  message**; a message that vanishes reads as "sent"
- Keep focus in the composer after send
- Disable send while the socket is down, with a reason — do not let messages
  queue invisibly

**Gate:** RTL — empty blocked, whitespace blocked, optimistic append, failure
leaves a retryable bubble.

---

### `[⬜]` 7 — Real-time ★

- Connect on mount with the JWT; tear down cleanly on token change or unmount
- `message:new` → normalize → merge (no-op if the id is already present)
- **The sender gets no echo** (quirk 15) — never wait on the socket to confirm
  your own send
- `conversation:updated` → refetch the conversation list
- Surface connection state honestly: `connecting` / `connected` / `reconnecting`
  / `disconnected`. The demo API cold-starts for 30–60s (quirk 20), so the first
  connect should say "waking the server" rather than showing an indefinite
  spinner
- A message arriving for a conversation that is not open updates that row's
  preview and unread marker

**Gate:** two browser contexts in Playwright — B sends, A sees it without a
refresh.

---

### `[⬜]` 8 — Auto-scroll

The behaviour the brief calls out explicitly.

- Pinned to bottom by default; new messages scroll into view
- **If the user has scrolled up, do not yank them down.** Track "is near bottom"
  with a threshold (~80px), not exact equality — a fractional `scrollTop` from a
  trackpad must not count as scrolled-away
- When a message arrives while scrolled up, show a "N new messages" affordance
  that jumps to the bottom on click
- Your *own* sent message always scrolls to bottom regardless — sending is an
  explicit intent to see the result
- Restore scroll position when prepending older pages

**Gate:** Playwright — scroll up, receive a message, assert the viewport did not
move and the affordance appeared.

---

### `[⬜]` 9 — Group management

Add members, remove, leave, promote to admin, rename. All admin-gated (`403`
otherwise) except leaving.

- Hide admin-only controls from non-admins rather than showing a 403 after the
  fact
- Optimistic where the API is consistent — every group endpoint returns the full
  updated group, so replace wholesale rather than patching fields

---

### `[⬜]` 10 — States and quality pass

- Every async surface has loading / empty / error, and every error offers the
  action that resolves it
- Offline detection — `navigator.onLine` plus socket state
- Full `pnpm check:all` and `pnpm test:e2e` green
- `/review` clean

---

## Bonus candidates

The brief awards credit only for something **genuinely original** — a generic
addition does not count even if well executed. Ranked by originality against the
API's actual behaviour:

1. **Surface the cold start as a first-class state.** The free-tier server sleeps
   and takes 30–60s to wake. Every other submission will show a spinner and look
   broken. Detecting the wake-up and narrating it ("the demo server is waking up
   — about 30 seconds") turns the assignment's worst moment into evidence the
   candidate actually ran the thing.
2. **Send-failure queue that survives reload.** Failed optimistic messages
   persist and retry on reconnect, rather than being lost with the tab.
3. **A self-chat guard with an explanation.** Quirk 9 means tapping your own
   search result opens a stranger's conversation. Blocking it is table stakes;
   saying *why* in the UI is the one-step-ahead move.

Pick **one** and build it properly. Two half-built bonuses read worse than none.

---

## Out of scope

Read receipts, presence, typing indicators, file upload, message edit/delete,
push notifications. The API supports none of them, and inventing client-only
versions is worse than their absence.
