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

`src/lib/api/health.ts` (**not** `src/types/chat.ts` — see the note below):

```ts
export type WakeStatus = 'unknown' | 'waking' | 'awake' | 'unreachable';
```

> **Deviation, taken deliberately.** The plan put `WakeStatus` in
> `src/types/chat.ts`. It ships from `src/lib/api/health.ts` instead. Two
> reasons: the probe is the only thing that can produce one of these values, so
> the type has no meaning apart from it; and `src/types/chat.ts` was being
> edited concurrently by plan 04, so adding a line there would have been a
> merge conflict for no gain. `chat-slice` imports the type from
> `@/lib/api/health`.

`chat-slice` carries four wake fields, not one. `wakeStatus` is the app-wide
fact; `wakeStartedAt` is what lets a surface mounted mid-wait count from the
real beginning rather than from its own mount; `wakeAttempt` is `WakeBoot`'s
remount key, which is how retry re-fires the probe without an effect dependency
array; and `wakeNarrated` is what gates the closing acknowledgement, so a warm
load stays silent end to end instead of flashing *"Server's awake."*

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

`tests/hooks/use-api-wake.test.ts` (fake timers) — 16 tests, all passing:
- [✅] a probe resolving in 300ms → status goes `unknown` → `awake`, and
      **`waking` is never entered** (no narration on a warm server). Asserted
      three ways: the recorded transition list, `wakeNarrated === false`, and a
      walk past 2.5s proving the threshold timer was *cleared*, not out-raced
- [✅] a probe outstanding at 2.5s → `waking` (and still `unknown` at 2.499s)
- [✅] copy escalates at the 8s / 25s / 45s boundaries — asserted against
      `wakeCopyFor`, a pure function, so the boundaries need no clock
- [✅] resolution at 40s → `awake`, `wakeNarrated` kept for the acknowledgement
- [✅] no resolution by the budget → `unreachable`, retrying stops, and
      `wakeRetryRequested` resets the state and bumps the remount key
- [✅] *added* — a fast failure re-probes rather than declaring `unreachable`.
      Render answers 502 while a service spins up, so a 50ms failure means
      "not yet", not "dead"
- [✅] *added* — unmount aborts the probe and fires nothing further

`tests/components/common/wake-notice.test.tsx` — 7 tests, all passing:
- [✅] renders nothing at `unknown` and at `awake` (the warm-server path:
      `awake` reached without passing through `waking` renders an empty DOM)
- [✅] `waking` renders `role="status"` with `aria-live="polite"`, and no
      `role="alert"`; the copy names the cause instead of saying "loading"
- [✅] the elapsed counter is `aria-hidden`
- [✅] `unreachable` renders `role="alert"` and a focusable retry that actually
      re-probes (bumps `wakeAttempt`) rather than just dismissing itself

`e2e/cold-start.spec.ts` — **written, not yet run.** Three tests: a 12s
intercepted `/health` (narration appears, escalates, acknowledges, leaves); a
refused connection (alert + a retry that succeeds once the route is cleared);
and an immediate 200 (nothing ever appears). The last is the important one — a
narration that shows on every load is noise, not a feature.

> Not executed in this pass: concurrent agents held ports 8000/8001. Run
> `pnpm exec playwright test e2e/cold-start.spec.ts --project=chromium-desktop`
> once the tree is merged.

## Performance

`/health` is the cheapest endpoint available. One probe per session, aborted on
unmount. The timer is a single interval, cleared on resolution. Nothing here
blocks paint — the app renders immediately and the narration appears only if the
wait becomes abnormal.

## Affected Files

- `src/providers/index.tsx` — mount `WakeBoot`
- `src/store/slices/chat-slice.ts` — `wakeStatus` + `wakeStatusChanged`
- ~~`src/types/chat.ts` — `WakeStatus`~~ → moved to `src/lib/api/health.ts`
- `src/components/layout/auth/login-form.tsx` — render `WakeNotice` under submit
- `src/components/layout/chat/sidebar/conversation-list.tsx` — use it as the
  loading state — **TODO(blocked-on-04)**, see step 6
- `src/components/layout/chat/panel/composer-status.tsx` — `connecting` during a
  cold start says "Waking the server", not "Reconnecting" —
  **TODO(blocked-on-06)**, see step 6
- `README.md` — the write-up section on this bonus

## New Files

- `src/lib/api/health.ts`
- `src/hooks/use-api-wake.ts`
- `src/components/layout/common/{wake-notice,wake-boot}.tsx`
- `tests/hooks/use-api-wake.test.ts`
- `tests/components/common/wake-notice.test.tsx`
- `e2e/cold-start.spec.ts`

## Implementation Steps

- [✅] **1 — `probeHealth`.** `src/lib/api/health.ts`, against the **origin
  root**. Confirmed by hand against the live deployment before a line of it was
  written:

  ```
  GET https://frontend-task-chatapp.onrender.com/health
      → 200  {"status":"ok"}   access-control-allow-origin: *
  GET https://frontend-task-chatapp.onrender.com/api/health
      → 404  {"error":{"message":"Route not found","code":"NOT_FOUND"}}
  ```

  The CORS risk flagged under *Risks* is **closed**: `/health` answers
  `access-control-allow-origin: *`, so the fallback mechanism is not needed.
- [✅] **2 — `WakeStatus` + slice fields.** Type in `src/lib/api/health.ts`;
  `wakeStatus` / `wakeStartedAt` / `wakeAttempt` / `wakeNarrated` plus
  `wakeProbeStarted` / `wakeStatusChanged` / `wakeAcknowledged` /
  `wakeRetryRequested` in `chat-slice`.
- [✅] **3 — `use-api-wake`.** Probe + retry loop + elapsed timer + the 2.5s
  threshold + the escalation boundaries. Unit-tested with fake timers **before**
  any UI was written, per the plan.
- [✅] **4 — `WakeNotice`.** Escalating copy, breathing dot on the existing
  `animate-pulse-ring`, `aria-hidden` elapsed counter, `awake` acknowledgement
  gated on `wakeNarrated`, `unreachable` + focusable retry.
- [✅] **5 — `WakeBoot`** in `providers/index.tsx`, beside `SessionBoot`,
  keyed on `wakeAttempt` so a retry remounts it rather than needing an effect
  dependency array.
- [🔄] **6 — Three placements.** One of three landed.
  - [✅] `/login` — `WakeNotice` under the submit button in `login-form.tsx`.
  - [⬜] `TODO(blocked-on-04)` — conversation-list loading state.
    `src/components/layout/chat/sidebar/conversation-list.tsx` is owned by plan
    04 and was being written concurrently. Drop-in: render `<WakeNotice />`
    above the skeleton in the `loading` branch. No new state is needed — the
    component reads `chat.wakeStatus` itself and returns `null` when the server
    is warm, so it is safe to place unconditionally.
  - [⬜] `TODO(blocked-on-06)` — composer status.
    `src/components/layout/chat/panel/composer-status.tsx` is owned by plan 06.
    Drop-in: when `socketStatus === 'connecting'` **and**
    `chat.wakeStatus === 'waking'`, say *"Waking the server…"* instead of
    *"Reconnecting…"*. One state, one story — that consistency is what
    separates this from a one-off loading string.
- [⬜] **7 — Landing hookup** — plan 10's file, not touched here. Nothing is
  blocking it: `wakeStatus` is already in the store and readable with
  `useAppSelector((state) => state.chat.wakeStatus)`. Rings at full strength on
  `awake`, dimmed on `waking`.
- [✅] **8 — Tests.** 23 new unit/component tests, all passing.
  `e2e/cold-start.spec.ts` is written but not executed — see *Testing Strategy*.
- [⬜] **9 — Write-up.** `README.md` Part 3 section. Not written in this pass;
  `README.md` is shared across plans and was left to the integrating pass.
- [🔄] **10 — Gate.** `format:all`, `lint`, `type:check`, `test` (144 passed),
  and `build` all green. Playwright deliberately not run — concurrent agents
  held the ports.

## Verification

- [✅] Warm server → the narration **never appears** (the load-bearing check).
  Proven at both levels: `use-api-wake.test.ts` asserts a 300ms probe never
  enters `waking`, and `wake-notice.test.tsx` asserts an `awake` reached without
  narration renders an empty DOM.
- [✅] Genuinely cold server → narration appears at ~2.5s and escalates —
  verified under fake timers at the 2.5s / 8s / 25s / 45s boundaries.
- [✅] On wake → acknowledgement, then dismissal (`useWakeDismissal`: 2.4s hold,
  400ms fade, then `wakeAcknowledged` clears it for every placement at once).
- [✅] Unreachable → `role="alert"` with a retry that bumps `wakeAttempt`,
  remounting `WakeBoot`'s probe. Asserted in the component test.
- [🔄] The same explanation on login, chat, and landing — login done; chat and
  landing are the two `TODO` seams in step 6 and step 7.
- [🔄] Screen reader: `role="status"` + `aria-live="polite"` on the narration,
  `role="alert"` on `unreachable`, and the counter carries `aria-hidden="true"`
  so it is removed from the accessibility tree and the live region diffs only
  the copy. Asserted structurally in the component test; **not** yet confirmed
  against a real screen reader.
- [✅] No source builds a `/api` + `/health` URL. Note the PRD's original grep
  (`grep -rn "api/health" src`) now has an unavoidable false positive: the
  module itself lives at `src/lib/api/health.ts`, so its own import path
  matches. The check that means what was intended:
  `grep -n "API_BASE_URL" src/lib/api/health.ts` → no match, i.e. the probe
  never reads the `/api` base. It reads `NEXT_PUBLIC_SOCKET_URL`, the origin.

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
- ~~**`/health` has no CORS guarantee**~~ — **closed.** The live server answers
  `access-control-allow-origin: *`, so the browser probe is permitted and the
  fallback (timing the first real request) is not needed. The defensive
  handling was kept regardless: `probeHealth` converts any network-level
  rejection into `false` rather than throwing, so an offline client or a future
  CORS change degrades to `unreachable` instead of an uncaught rejection.
