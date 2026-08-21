# Feature: Cold-Start Narration — Part 1 Bonus

Turn the demo server's 30–60 second wake-up from a screen that looks broken into
a screen that explains itself.

## Context

The brief awards extra credit only for something **genuinely original**:

> adding a thoughtful extra element that shows original, one-step-ahead thinking
> (a smart edge-case handled gracefully, a small interaction that improves the
> experience, a detail that isn't asked for but adds real value)
>
> This bonus only applies if the addition is genuinely original. A common or
> generic addition won't count toward it, even if it's well executed.

**The observation** ([quirk 20](../../../docs/api/quirks.md)): the API is hosted
on a free Render tier that sleeps after inactivity. The first request of a
session takes 30 to 60 seconds.

**Why this is the right bonus.** The reviewer will open the deployed link cold.
Their first interaction is a 45-second wait. Every submission that shows a generic
spinner will, at that exact moment, look broken — and that is the reviewer's first
impression of the whole project. Handling it is not a feature; it is the single
highest-leverage minute of the entire assignment, and it is only visible to
someone who actually deployed and used their own app against the live API.

It also satisfies "original" precisely: it is not a component anyone would think
to add from the spec. It comes from having run the thing.

## Adoption Brief

**Adopted:** `GET /health` at the **origin root** (not `/api/health` — quirk 6);
the socket's existing generous `timeout` / `reconnectionDelay` config; plan 02's
`socketStatus`; plan 01's primitives.

**NOT adopted:** a server-side warm-up cron — outside the assignment's scope and
it would hide the behaviour being demonstrated rather than handle it. A fake
progress bar with a fabricated percentage — the wake time is not knowable, and a
progress bar that lies is worse than an honest indeterminate wait. Blocking the
whole UI behind a splash — the app should stay usable and explain itself, not
gate itself.

## Skill Dependencies

- `workflow/no-use-effect.md` — the probe runs in a hook, the elapsed timer is
  `useSyncExternalStore`-friendly interval state in a hook
- `architecture/state.md` — wake status is app-wide, so it goes in `chat-slice`
- `design-system/colors.md`

## Architecture Strategy

**Detection, not guessing.** A `wakeStatus` in `chat-slice`:

| Status | Meaning |
|---|---|
| `unknown` | No request has completed yet |
| `waking` | A request has been outstanding for **> 2.5s** |
| `awake` | Any request has completed successfully |
| `unreachable` | A probe failed after the full retry budget |

The 2.5s threshold matters: a warm server responds in ~300ms, and narrating a
cold start that is not happening would be noise on every normal load. The message
appears **only** when the wait is genuinely abnormal.

**The probe.** On app boot, `useApiWake` fires `GET {origin}/health` — the
cheapest possible request, and the endpoint documented to exist for this purpose.
The probe races an elapsed-time counter:

```
0.0s        → nothing rendered
2.5s        → wakeStatus = 'waking', narration appears
2.5s–60s    → elapsed counter shown, copy escalates
on success  → 'awake', narration dismisses with a brief acknowledgement
on timeout  → 'unreachable', actionable error with a retry
```

Because `/health` is at the origin root and the socket connects to the same
origin, warming it warms the socket path too — the probe is not merely
diagnostic, it actively shortens the first real interaction.

**The copy escalates with the wait**, which is what makes it feel like a system
that knows what is happening rather than a static string:

| Elapsed | Copy |
|---|---|
| 2.5s | *"Waking the demo server…"* |
| 8s | *"Waking the demo server — this takes about 30 seconds on a cold start."* |
| 25s | *"Still waking up. The API is on a free tier that sleeps after inactivity."* |
| 45s | *"Almost there — free-tier cold starts can take up to a minute."* |
| 60s+ | `unreachable`: *"The demo server isn't responding."* + Retry |

Naming the cause is the point. *"Loading…"* for 45 seconds reads as a bug;
*"the free tier sleeps after inactivity"* reads as a developer who knows their
infrastructure.

**Where it appears.** One component, three placements, all reading the same state:

1. **`/login`** — inline under the submit button. The most likely first contact,
   and the login request is the one most likely to be slow
2. **`/chat`** — as the conversation-list loading state, replacing a bare skeleton
3. **`/`** (landing) — feeds the hero's signal-ring intensity, per
   [`10-landing-page`](../10-landing-page/prd.md). Rings at full strength when
   awake, dimmed while waking. The landing page quietly pre-explains the wait
   before the user reaches it

**Interaction with the socket.** During a cold start, `socketStatus` is
`connecting` for the same 30–60s. Plan 07 maps `connecting` here rather than
showing an indefinite spinner, and plan 06's composer says *"Waking the server…"*
instead of the generic *"Reconnecting…"*. One state, consistently explained
everywhere, is what separates this from a one-off loading string.

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/layout/common/wake-notice.tsx` | Client | reads status + elapsed |
| `src/components/layout/common/wake-boot.tsx` | Client | fires the probe once, app-wide |
| `src/hooks/use-api-wake.ts` | Client hook | `useMountEffect` probe + timer |
| `src/lib/api/health.ts` | pure module | the probe request |

`WakeBoot` mounts in `providers/index.tsx` next to `SessionBoot` (plan 03), so the
probe runs once for the whole app regardless of entry route.

## Data & Types

`src/types/chat.ts`:

```ts
export type WakeStatus = 'unknown' | 'waking' | 'awake' | 'unreachable';
```

`src/lib/api/health.ts` — `probeHealth(signal)` hits
`${NEXT_PUBLIC_SOCKET_URL}/health` (the **origin**, deliberately not the `/api`
base — quirk 6) and returns a boolean. It is the one API function that
intentionally does not go through `request()`, because `request()` prefixes
`/api`.

## Design System

- Narration panel — `bg-surface-raised dark:bg-surface-raised-dark`,
  `rounded-panel`, `text-sm`, never `text-danger`; a cold start is expected
  behaviour, not an error, and colouring it red would misinform
- A slow `pulse-500` breathing dot, on the existing `animate-pulse-ring` keyframe
  — signalling *working*, not *stuck*
- Elapsed counter in `font-mono` — it is data
- Transition to `awake` fades out over 400ms with a brief *"Server's awake."*
  The acknowledgement matters: it closes the loop rather than leaving the user
  wondering whether anything changed
- `unreachable` switches to `text-danger` with a retry button — that *is* an error

## State

`wakeStatus` in `chat-slice` (app-wide, read by three surfaces). Elapsed seconds
is local to `use-api-wake` — a value that changes every second does not belong in
a global store.

## Accessibility

- The narration is `role="status"` `aria-live="polite"` — informative, never
  interrupting
- The elapsed counter is `aria-hidden`; a ticking number read aloud every second
  is hostile. The escalating copy carries the information instead, and each
  escalation is a single polite announcement
- `unreachable` escalates to `role="alert"` with a focusable retry
- The dot animation is decorative and `aria-hidden`; `prefers-reduced-motion` is
  handled globally

## Testing Strategy

`tests/hooks/use-api-wake.test.ts` (fake timers):
- [⬜] a probe resolving in 300ms → status goes `unknown` → `awake`, and
      **`waking` is never entered** (no narration on a warm server)
- [⬜] a probe outstanding at 2.5s → `waking`
- [⬜] copy escalates at the 8s / 25s / 45s boundaries
- [⬜] resolution at 40s → `awake`, narration dismisses
- [⬜] no resolution by the budget → `unreachable` with a working retry

`tests/components/common/wake-notice.test.tsx`:
- [⬜] renders nothing at `unknown` and at `awake`
- [⬜] `waking` renders `role="status"`, not `role="alert"`
- [⬜] `unreachable` renders `role="alert"` and a retry control

`e2e/cold-start.spec.ts`: route-intercept `/health` with a 5s delay → the
narration appears; intercept with an immediate 200 → it never appears. The second
assertion is the important one — a narration that shows on every load is noise,
not a feature.

## Performance

`/health` is the cheapest endpoint available. One probe per session, aborted on
unmount. The timer is a single interval, cleared on resolution. Nothing here
blocks paint — the app renders immediately and the narration appears only if the
wait becomes abnormal.

## Affected Files

- `src/providers/index.tsx` — mount `WakeBoot`
- `src/store/slices/chat-slice.ts` — `wakeStatus` + `wakeStatusChanged`
- `src/types/chat.ts` — `WakeStatus`
- `src/components/layout/auth/login-form.tsx` — render `WakeNotice` under submit
- `src/components/layout/chat/sidebar/conversation-list.tsx` — use it as the
  loading state
- `src/components/layout/chat/panel/composer-status.tsx` — `connecting` during a
  cold start says "Waking the server", not "Reconnecting"
- `README.md` — the write-up section on this bonus

## New Files

- `src/lib/api/health.ts`
- `src/hooks/use-api-wake.ts`
- `src/components/layout/common/{wake-notice,wake-boot}.tsx`
- `tests/hooks/use-api-wake.test.ts`
- `tests/components/common/wake-notice.test.tsx`
- `e2e/cold-start.spec.ts`

## Implementation Steps

- [⬜] **1 — `probeHealth`.** `src/lib/api/health.ts` against the **origin root**.
  Confirm by hand that `/api/health` 404s and `/health` returns `{"status":"ok"}`
  — the whole feature rests on hitting the right one.
- [⬜] **2 — `WakeStatus` + slice field.**
- [⬜] **3 — `use-api-wake`.** Probe + elapsed timer + the 2.5s threshold + the
  escalation boundaries. Unit-test with fake timers **before** any UI.
- [⬜] **4 — `WakeNotice`.** Escalating copy, breathing dot, elapsed counter,
  `awake` acknowledgement, `unreachable` + retry.
- [⬜] **5 — `WakeBoot`** in `providers/index.tsx`, beside `SessionBoot`.
- [⬜] **6 — Three placements.** Login, conversation-list loading, composer status.
- [⬜] **7 — Landing hookup.** Expose `wakeStatus` for plan 10's hero rings.
- [⬜] **8 — Tests + e2e.**
- [⬜] **9 — Write-up.** A short, specific section in `README.md` Part 3: what was
  observed, why it matters, what was built. The bonus is only credited if the
  reviewer understands it was deliberate.
- [⬜] **10 — Gate.** `pnpm run check:all`, `pnpm run test`, e2e on chromium-desktop.

## Verification

- [⬜] Warm server → the narration **never appears** (the load-bearing check)
- [⬜] Genuinely cold server → narration appears at ~2.5s and escalates
- [⬜] On wake → acknowledgement, then dismissal
- [⬜] Unreachable → an error with a retry that actually re-probes
- [⬜] The same explanation appears on login, chat, and landing — one state, one story
- [⬜] Screen reader: announced politely; the counter is not read aloud
- [⬜] `grep -rn "api/health" src` returns nothing — the probe must hit the origin root

## Risks & Open Questions

- **Hard to demo on a warm server.** By the time the reviewer opens it, someone
  else may have woken it. Mitigation: the write-up explains it, and
  `e2e/cold-start.spec.ts` proves it with an intercepted delay — a test is
  evidence the reviewer can read without waiting.
- **The 2.5s threshold is tuned, not derived.** Named constant. Too low and it
  fires on a slow phone connection; too high and the reviewer stares at a spinner
  before it appears.
- **Escalating copy risks feeling chatty.** Keep it to one short line at a time,
  never stacked, never animated between states beyond a crossfade.
- **`/health` has no CORS guarantee** — the probe must handle a network-level
  rejection as `unreachable` rather than throwing uncaught. Verify against the
  live server early; if CORS blocks it, fall back to timing the first real
  request instead, which changes the mechanism but not the feature.
