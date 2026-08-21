# Feature: Composer & Sending ★

The input, the empty-message guard, optimistic send, and failure that stays
recoverable.

> Part of the graded core alongside [`05-message-list`](../05-message-list/prd.md)
> and [`07-realtime-and-autoscroll`](../07-realtime-and-autoscroll/prd.md).

## Context

Brief requirement:

> **Sending messages** — users can send a new message; empty messages should not
> be sendable.

Two API facts make this harder than it looks, both documented:

- **[Quirk 10] The server accepts `""` and `"   "` with a `200`.** There is no
  server-side text validation at all — over REST *or* socket. The entire
  "empty messages should not be sendable" requirement is the client's job.
  It is already enforced twice (`sendMessage()` throws pre-request); the composer
  is the third and most visible guard.
- **[Quirk 15] The sender receives no `message:new` echo**, and the
  `message:send` ack is a bare `{ ok: true }` carrying no message body — so it
  does not even return the server-assigned id. **Local echo is mandatory, not an
  optimisation.** A client that waits for socket confirmation of its own send
  displays a message that never arrives.

That second fact is why this plan sends over **REST**, not the socket: `POST
/messages` returns the full message with its server `id` and `createdAt`, which
is exactly what the optimistic entry needs to be replaced by. The socket ack
returns nothing usable. Same delivery to other participants either way.

## Adoption Brief

**Adopted:** `sendChatMessage` thunk and the `appendOptimistic` /
`confirmOptimistic` / `failOptimistic` merge functions from plan 02;
`sendMessage()` from `src/lib/api`; Textarea and IconButton from plan 01;
`sonner` for a failure toast.

**NOT adopted:** socket `message:send` (above). Draft persistence across reloads
— not asked for, and it competes for time with the graded core. Emoji picker,
attachments, mentions — the API supports none of them; inventing client-only
versions is worse than their absence.

## Skill Dependencies

- `workflow/no-use-effect.md` — sending is the canonical event-handler case; auto-grow
  is a callback-ref DOM concern
- `architecture/state.md` — draft text is local, never Redux
- `external/testing/playwright-best-practices/testing-patterns/forms-validation.md`

## Architecture Strategy

**Draft state is local.** `useState` inside the composer. Putting draft text in
Redux would dispatch an action per keystroke and re-render the message list on
every character.

**The empty guard, three layers deep:**

1. `disabled={draft.trim() === ''}` on the send control — the user cannot reach it
2. The submit handler returns early on a trimmed-empty value — covers Enter,
   which bypasses a disabled button
3. `sendMessage()` in `src/lib/api` throws before issuing the request — already
   built, already tested

Layer 2 is the one most often forgotten: a disabled button does not stop the
Enter key.

**Keyboard.** Enter sends. Shift+Enter inserts a newline. On touch viewports
Enter inserts a newline and sending is the button only — a soft keyboard's return
key sending prematurely is a real and irritating failure. Detect via
`matchMedia('(pointer: coarse)')` through `useSyncExternalStore`, not a user-agent
sniff.

**Auto-grow.** The textarea grows from 1 row to a `max-h-32` cap, then scrolls.
Implemented in a callback ref that resets `style.height = 'auto'` and sets it to
`scrollHeight` on input — a DOM measurement, so it belongs in
`use-auto-grow-textarea.ts`, not in a component.

**The optimistic lifecycle.**

```
submit → clientId = crypto.randomUUID()
       → dispatch appendOptimistic({ ...message, status: 'sending' })   [synchronous]
       → clear draft, keep focus                                        [synchronous]
       → await POST /messages
         ├─ ok    → confirmOptimistic(clientId, serverMessage)   status: 'sent'
         └─ error → failOptimistic(clientId)                     status: 'failed'
```

The draft clears and focus stays **before** the await, not after. Waiting on the
network to clear the input makes a fast typist lose their next sentence.

**Failure never removes the message.** A failed bubble stays in place, dimmed,
with a retry control and an `sr-only` "Failed to send". A message that vanishes on
failure reads as *sent* — the single worst outcome in a chat client. Retry
re-dispatches with the same `clientId`, so it replaces rather than duplicates.

**Socket-down handling.** The send control is disabled while
`socketStatus === 'disconnected'` **with a visible reason** — *"Reconnecting…"* —
rather than accepting messages into an invisible queue. Note the nuance: REST
sends would in fact still work with the socket down, but the *other* participants'
delivery relies on the server's socket fan-out, and a message that appears sent
while nobody receives it is a lie. Disabling with a stated reason is the honest
option. (During `connecting` — the cold-start case — see plan 09.)

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/layout/chat/panel/composer.tsx` | Client | form state, submit, focus |
| `src/components/layout/chat/panel/send-button.tsx` | Client | `memo`, disabled reason |
| `src/components/layout/chat/panel/failed-message-actions.tsx` | Client | retry / dismiss |
| `src/components/layout/chat/panel/composer-status.tsx` | Client | socket-state line |
| `src/hooks/use-composer.ts` | Client hook | draft, submit, keyboard rules |
| `src/hooks/use-auto-grow-textarea.ts` | Client hook | callback-ref height sync |
| `src/hooks/use-coarse-pointer.ts` | Client hook | `useSyncExternalStore` |

## Data & Types

No new domain types. `MessageStatus` (`'sending' | 'sent' | 'failed'`) and the
optional `clientId` already exist in `src/types/chat.ts` — they were designed for
exactly this.

## Design System

- Composer bar `bg-surface dark:bg-surface-dark`, top hairline
  `border-border-subtle`, `p-3 sm:p-4`, sticky to the panel bottom
- Textarea transparent inside a `rounded-panel` well, `min-h-11` (44px touch
  target), `max-h-32`
- Send button `bg-signal-600 dark:bg-signal-500`, `rounded-full`, `size-9`;
  disabled `opacity-50 cursor-not-allowed`
- `status: 'sending'` → bubble at `opacity-70` with a small clock glyph
- `status: 'failed'` → `border border-danger` **plus** an alert glyph **plus** the
  text "Not sent" — three signals, never colour alone
- `status: 'sent'` → no indicator at all. A checkmark implies delivery
  confirmation this API does not provide; drawing one would be a lie in UI form

That last decision is worth stating in the write-up: the absence of a read receipt
is a correctness choice, not an omission.

## State

| State | Home |
|---|---|
| Draft text | local `useState` in `use-composer` |
| Textarea height | DOM, via callback ref |
| Optimistic message + status | `chat-slice` (plan 02) |
| Pointer coarseness | `useSyncExternalStore` over `matchMedia` |

## Accessibility

- The textarea has a real `<label>`, visually hidden: *"Message"*
- Send button `aria-label="Send message"`; when disabled,
  `aria-describedby` points at the reason node, so a screen reader hears *why*
- The keyboard hint (*"Enter to send, Shift+Enter for a new line"*) is rendered
  once, `sr-only` plus a subtle visible form on `sm+`
- A failed message announces once via `role="alert"`, and its retry button is
  reachable in the tab order
- Focus returns to the textarea after send **and** after retry
- 44×44px minimum for send and retry controls
- Not `aria-live` on the composer itself — the message list already announces
  additions, and doubling it makes screen readers read every sent message twice

## Testing Strategy

`tests/components/chat/composer.test.tsx`:

- [⬜] empty draft → send disabled
- [⬜] whitespace-only draft (`"   "`) → send disabled **and** Enter does nothing
- [⬜] valid text + Enter → dispatches with the **trimmed** value
- [⬜] Shift+Enter → newline, no dispatch
- [⬜] draft clears and focus is retained immediately, before the request resolves
- [⬜] send failure → the bubble remains, marked failed, with a retry control
- [⬜] retry re-dispatches with the **same** `clientId` — no duplicate
- [⬜] socket disconnected → send disabled with a stated reason
- [⬜] coarse pointer → Enter inserts a newline instead of sending

`e2e/sending.spec.ts`: type → send → the bubble appears immediately (before the
network settles) → resolves to sent. Route-intercept a 500 → the bubble is marked
failed and retry recovers it.

## Performance

- Draft state local, so keystrokes do not touch the store or the list
- `SendButton` `memo`'d on `disabled` + `reason`
- Height sync in a callback ref — no per-keystroke React state for layout
- Optimistic dispatch is synchronous and pre-await, so the bubble paints in the
  same frame as the keypress

## Affected Files

- `src/components/layout/chat/panel/index.tsx` — mount the composer
- `src/components/layout/chat/panel/message-bubble.tsx` — render `sending` /
  `failed` affordances (the component exists from plan 05; this adds status)
- `src/store/slices/chat-slice.ts` — confirm `sendChatMessage` supports retry with
  an existing `clientId`

## New Files

- `src/components/layout/chat/panel/{composer,send-button,failed-message-actions,composer-status}.tsx`
- `src/hooks/{use-composer,use-auto-grow-textarea,use-coarse-pointer}.ts`
- `tests/components/chat/composer.test.tsx`
- `e2e/sending.spec.ts`

## Implementation Steps

- [⬜] **1 — `use-coarse-pointer`.** `useSyncExternalStore` over
  `matchMedia('(pointer: coarse)')`, SSR-safe server snapshot.
- [⬜] **2 — `use-auto-grow-textarea`.** Callback ref, reset-then-measure, capped.
- [⬜] **3 — `use-composer`.** Draft state, the three-layer empty guard, Enter /
  Shift+Enter rules branching on pointer coarseness, submit handler that clears
  and refocuses **before** awaiting.
- [⬜] **4 — `Composer` + `SendButton`.** Compose plan-01 primitives; disabled
  state always carries a reason.
- [⬜] **5 — Status affordances in the bubble.** `sending` dim + clock, `failed`
  border + glyph + "Not sent", `sent` deliberately unmarked.
- [⬜] **6 — `FailedMessageActions`.** Retry with the same `clientId`; dismiss
  removes locally. Never auto-remove.
- [⬜] **7 — `ComposerStatus`.** Socket-state line; disable send on `disconnected`
  with the reason wired to `aria-describedby`.
- [⬜] **8 — Tests + e2e.**
- [⬜] **9 — Gate.** `pnpm run check:all`, `pnpm run test`, e2e on chromium-desktop.

## Verification

- [⬜] `"   "` cannot be sent by button **or** by Enter
- [⬜] A sent bubble appears before the network round trip completes
- [⬜] Killing the network mid-send leaves a retryable bubble — nothing vanishes
- [⬜] Retrying does not produce two messages
- [⬜] Focus never leaves the composer during a normal send
- [⬜] Textarea grows to the cap then scrolls; the list is not pushed off-screen
- [⬜] Axe clean; send button has an accessible name and a disabled reason
- [⬜] Mobile 375px: Enter newlines, the button sends, no layout jump on focus

## Risks & Open Questions

- **iOS Safari viewport on keyboard open.** The composer must stay visible when
  the soft keyboard appears. Use `100dvh` (already the convention in this project)
  and verify on a real device or the WebKit Playwright project — `100vh` is the
  classic failure here.
- **Disabling send while the socket is down is a judgement call.** REST would
  still deliver, but fan-out to other participants depends on the server's socket
  layer. Erring toward honesty over apparent capability; stated in the write-up.
- **`dismiss` on a failed message deletes local-only state** with no undo. Acceptable
  — the message never reached the server — but the control must read "Dismiss",
  never "Delete", which would imply a server-side deletion this API does not offer.
