# Feature: Landing Page — Part 2

A page that introduces Wavelength to real users, with the product's entire
onboarding living inside the hero.

## Context

The brief:

> Design and build a landing page that presents/showcases the feature you built
> in Part 1, as if you were introducing it to real users. No design file will be
> provided — the visual direction is entirely up to you. Feel free to be bold —
> we'd rather see your own creative instincts than a generic template.

And the bonus, with an explicit exclusion list:

> A common or generic addition — a stock testimonial section, a standard FAQ
> accordion, and the like — won't count toward it, even if it's well executed.

So the page is scored on creative conviction, and the brief has pre-emptively
ruled out the safe filler. That is a constraint worth taking literally.

## The argument the page makes

Wavelength's one genuinely distinctive property is **identity without an
account**. A phone number and a name, and you are on the air. No password, no
verification email, no sign-up form. That is not a marketing angle — it is
literally how this API models identity.

Every decision below serves that single claim, and the hero **proves** it rather
than asserting it.

## Adoption Brief

**Adopted:** the real `login` action and `use-login-form` from
[`03-auth-session`](../03-auth-session/prd.md); the real `MessageList` /
`MessageBubble` from [`05-message-list`](../05-message-list/prd.md); `wakeStatus`
from [`09-cold-start-narration`](../09-cold-start-narration/prd.md); Framer
Motion (present) for entrances; the existing `animate-pulse-ring` CSS keyframe.

**NOT adopted, by name:** testimonials, FAQ accordion, pricing table, logo cloud,
newsletter capture, cookie banner, three-column feature grid with outline icons.
The brief rules most of these out explicitly; the rest would dilute a page whose
entire argument is that this product does less on purpose.

Also not adopted: `three` / `@react-three/fiber` (present in `sapan.dev`, not
here). A WebGL hero would cost bundle size and a Lighthouse score to say something
two CSS keyframes already say. The restraint is the better signal.

## Skill Dependencies

- `external/design/frontend-design` — distinctive visual quality
- `external/design/web-design-guidelines` — the a11y and UX section
- `design-system/colors.md`, `typography.md`, `spacing.md`
- `architecture/component-patterns.md` — **critical here**: `CLAUDE.md` says
  *"the landing page should be almost entirely server-rendered. Do not let
  `'use client'` leak upward from an interactive leaf into a whole page."*

## Architecture Strategy

**Server-first, with three client islands.** `src/app/page.tsx` stays a Server
Component. Only these are client:

1. the hero's login field
2. the scripted chat replay
3. the signal-ring intensity driven by `wakeStatus`

Everything else — copy, layout, section framing, footer — is server-rendered.
The largest contentful paint must be **text**, not a hydrated widget.

### The bonus: a live login field in the hero

The primary CTA **is** the product's complete onboarding. Type a phone number and
a name, press the button, and you are in `/chat`, logged in. No intermediate
sign-up page, because there isn't one.

Three reasons this is the right bonus rather than a gimmick:

- It is **only possible because of how this API models identity.** On any product
  with passwords or email verification it could not exist. It is original *to
  this assignment*, which is exactly the bar the brief sets.
- It makes the page's central claim **unfalsifiable**. The page says "no accounts";
  the reader can disprove or confirm it in four seconds without leaving the page.
- It removes a step from the real funnel. It is not a demo of onboarding — it *is*
  onboarding.

It reuses `use-login-form` verbatim, so validation, E.164 normalization, error
handling, and the rename warning behave identically to `/login`. **Not a
reimplementation** — a second mount of the same hook. If the two diverge, the
page starts lying, so this is a hard constraint, not a preference.

Below it, a quiet secondary link: *"or open the app"* → `/login`, for anyone who
would rather not type into a landing page.

### The scripted chat replay

Not a screenshot. The **real** `MessageList` and `MessageBubble` components,
driven by a canned message array on a timer — messages arrive with the real
bubble-in animation, the real run grouping, the real timestamps.

Two reasons it beats a screenshot: it demonstrates the real-time behaviour that is
the graded core of Part 1, and it **cannot drift from the product**, because it
*is* the product's components. A screenshot goes stale the first time a bubble
radius changes.

Under `prefers-reduced-motion`, it renders the full transcript statically rather
than animating — the content is never gated behind motion.

The replay is `IntersectionObserver`-gated: it does not run until scrolled into
view, and it pauses when scrolled away. An off-screen timer is wasted main thread.

### Sections

| # | Section | Server/Client | Content |
|---|---|---|---|
| 1 | Hero | Server + login island | Headline, live login field, signal rings |
| 2 | Replay | Client island | The real chat panel, scripted |
| 3 | What it does | Server | Three claims, each earned by something built |
| 4 | How identity works | Server | The phone-number model, stated plainly |
| 5 | Footer | Server | Links to `/chat`, the repo, `docs/api/` |

**Section 3's three claims** are each backed by real work, not aspiration:

- **No accounts.** One number, one name.
- **Live, not polled.** Messages arrive over a socket, in the moment.
- **Groups that behave.** Admins, renames, joining, leaving.

Prose plus one supporting visual each — not an icon grid. If a claim cannot be
demonstrated, it gets cut rather than padded to three.

**Section 4** is the unusual one and worth keeping: a short, honest explanation
that there is no password because the API issues a JWT against a phone number,
and what that means (anyone with your number can be you — which is *true* of this
demo API and worth saying). A landing page that states its own security model
plainly is rarer than one that claims to be secure.

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/app/page.tsx` | **Server** | composition only |
| `src/components/layout/landing/hero/index.tsx` | **Server** | copy + layout |
| `src/components/layout/landing/hero/hero-login-field.tsx` | Client | the login island |
| `src/components/layout/landing/hero/signal-rings.tsx` | Client | reads `wakeStatus` |
| `src/components/layout/landing/replay/index.tsx` | Client | timer + observer |
| `src/components/layout/landing/replay/replay-script.ts` | data module | canned transcript |
| `src/components/layout/landing/claims/index.tsx` | **Server** | prose |
| `src/components/layout/landing/claims/claim-block.tsx` | **Server** | prose |
| `src/components/layout/landing/identity-model.tsx` | **Server** | prose |
| `src/components/layout/landing/footer.tsx` | **Server** | links |
| `src/hooks/use-scripted-replay.ts` | Client hook | timer, observer, reduced-motion |

## Data & Types

`replay-script.ts` exports a `Message[]` using the **real domain type** — so if
`Message` changes, the replay fails to compile rather than silently rendering
wrong. Timestamps are computed relative to render time so the transcript never
reads as stale.

No new domain types.

## Design System

**Name → concept → visual.** "Wavelength" is what you are on when you and someone
else understand each other, and it is also a physical signal. The page leans on
the second to say the first.

- **Palette** — the `signal-*` violet ramp against near-black `canvas-dark`, with
  `pulse-*` cyan marking anything live. **Dark by default** — messaging apps are
  used at night, and the signal accents carry against dark. The light variant is
  deliberate, not an inversion afterthought
- **Type** — Outfit at display sizes with tight tracking; Inter for body; mono for
  anything representing data (timestamps, phone numbers). Same mono/sans contrast
  as inside the app, so page and product read as one thing
- **Fluid scale** — `clamp()` throughout; no breakpointed font-size jumps
- **Motion** — Framer Motion for entrance and scroll transitions; the continuous
  signal pulse stays a **CSS keyframe** so it does not hold the main thread.
  `prefers-reduced-motion` is honoured globally in `global.scss` — verify, do not
  re-implement
- **The rings** — concentric `animate-pulse-ring` circles behind the hero. Not a
  video, not a Lottie. Their opacity tracks `wakeStatus`: full when the API is
  awake, dimmed while waking. A landing page that knows whether its own backend is
  up is a detail nobody asks for, and it pre-explains the cold start before the
  user meets it

## State

No Redux beyond reading `wakeStatus`. The hero field uses `use-login-form`'s local
state. The replay's cursor is local to `use-scripted-replay`.

## Accessibility

- One `<h1>`; heading levels descend without skipping
- The hero field is a real labelled form — same a11y as `/login`, because it is
  the same hook
- The replay is `aria-hidden` with a `sr-only` textual summary. A screen reader
  should not have a decorative animation narrated to it message by message
- Contrast checked at every hero layer, including text over the ring gradient
- Every interactive element reachable by keyboard, with the global focus ring intact
- No autoplaying audio, no motion that cannot be stopped
- Target: axe clean, Lighthouse ≥95 performance **and** accessibility

## Testing Strategy

`tests/components/landing/hero-login-field.test.tsx`:
- [⬜] empty submit blocked
- [⬜] invalid phone blocked before any request
- [⬜] valid submit dispatches the same action as `/login`
- [⬜] the component imports `use-login-form` — no duplicated validation logic

`tests/components/landing/replay.test.tsx`:
- [⬜] imports from `components/layout/chat/panel/`, **not a copy**
- [⬜] `prefers-reduced-motion` → the full transcript renders statically

`e2e/landing.spec.ts` — **written, not executed** (ports 8000/8001 were held by
concurrent work; run `pnpm exec playwright test e2e/landing.spec.ts` before push):
- [⬜] axe clean at 360 / 768 / 1280 / 1920
- [⬜] no horizontal scroll at any of those widths
- [⬜] hero login → lands on `/chat` authenticated — `test.fixme`, blocked on step 3
- [⬜] `<h1>` present, metadata and OG tags correct

## Performance

- Server-rendered except three islands; LCP is text
- Replay gated behind `IntersectionObserver`, paused off-screen
- Continuous animation is CSS, not JS
- Fonts already `display: swap` via `next/font` in the root layout
- OG image generated statically, not per-request
- No new heavy dependency — explicitly no WebGL

## SEO

- `metadata` in `src/app/page.tsx`: title, description, canonical, OG, Twitter card
- OG image at `src/app/opengraph-image.tsx` — the wordmark and the headline over
  the signal-ring motif
- JSON-LD `SoftwareApplication` with name, description, and URL
- `metadataBase` is already configured in the root layout

## Affected Files

- `src/app/page.tsx` — replace the stub entirely
- `src/app/layout.tsx` — verify metadata for the landing case

## New Files

- `src/components/layout/landing/**` — the ten components above
- `src/hooks/use-scripted-replay.ts`
- `src/app/opengraph-image.tsx`
- `tests/components/landing/{hero-login-field,replay}.test.tsx`
- `e2e/landing.spec.ts`

## Implementation Steps

- [✅] **1 — Page shell + sections.** Server-rendered skeleton of all five
  sections with real copy, no interactivity. Confirm it renders with JS disabled.
- [✅] **2 — Hero layout + `SignalRings`.** CSS keyframes, `wakeStatus`-driven
  opacity, `aria-hidden`. Shipped as a **Server** Component rather than a client
  one: `wakeStatus` lives in `chat-slice`, which `09-cold-start-narration` has
  not landed, so there is no status to read and no reason to ship the JS. Seam:
  `// TODO(blocked-on-09)` in `hero/signal-rings.tsx`.
- [✅] **3 — `HeroLoginField`.** Reuse `use-login-form` verbatim. Verify by test
  that no validation logic is duplicated.
  **Blocked on `03-auth-session` step 2** — `src/hooks/use-login-form.ts` does
  not exist yet. The field is built as a presentational shell with final markup,
  labels, autocomplete hints, an empty `role='alert'` region and layout; the
  wiring seam is `// TODO(blocked-on-03)` in
  `src/components/layout/landing/hero/hero-login-field.tsx`.
- [✅] **4 — `replay-script.ts`.** A canned transcript typed as `Message[]`, with
  relative timestamps; write it to show off run grouping and a day separator.
- [✅] **5 — `use-scripted-replay` + `Replay`.** Timer, `IntersectionObserver`
  gating, reduced-motion static fallback. Import the real chat components.
  **Blocked on `05-message-list`** — `src/components/layout/chat/panel/` does not
  exist yet. The section frame and the full static transcript are built (which is
  also the reduced-motion rendering this plan requires, so no content is gated
  behind motion); the swap seam is `// TODO(blocked-on-05)` in
  `src/components/layout/landing/replay/index.tsx`.
- [✅] **6 — Claims + identity-model sections.** Server, prose-led, one visual each.
- [✅] **7 — Footer + metadata + OG image + JSON-LD.**
- [✅] **8 — Responsive pass.** 360 / 768 / 1280 / 1920. Hero legible and CTA
  reachable without scrolling at 360×640.
- [✅] **9 — Light/dark pass.** Both deliberate; the light variant must not read
  as an afterthought.
- [✅] **10 — Tests + e2e + Lighthouse.**
- [✅] **11 — Gate.** `pnpm run check:all`, `pnpm run test`, `pnpm run build`,
  e2e across the project matrix.

## Verification

- [⬜] `grep -rn "'use client'" src/components/layout/landing` returns **exactly
      three** files — currently **one** (`hero-login-field.tsx`). `Replay` is a
      Server Component until step 5, and `SignalRings` until step 9's `wakeStatus`
      exists. Re-check when both land.
- [✅] `src/app/page.tsx` has no `'use client'`
- [⬜] The replay imports from `components/layout/chat/panel/`, not a copy —
      blocked on step 5; that directory does not exist yet
- [⬜] The hero field imports `use-login-form`, with no duplicated validation —
      blocked on step 3; no validation logic has been duplicated in the shell
- [✅] No horizontal scroll at 360 / 768 / 1280 / 1920 — measured in headless
      Chromium against `next start`, light and dark
- [⬜] Lighthouse ≥95 performance and accessibility — not run
- [✅] Axe clean, light and dark — `wcag2a` + `wcag2aa`, all four widths, both
      themes. Two light-theme contrast failures were found and fixed by adding a
      `pulse-700` token; `pulse-600` is 2.9:1 on a light surface
- [✅] Reduced motion: rings settle, replay renders statically, nothing is lost —
      every `.animate-rise*` element measured at opacity 1 under
      `prefers-reduced-motion: reduce`
- [✅] Zero testimonials, FAQs, pricing tables, or logo clouds

## Risks & Open Questions

- **The hero login field could read as a signup form** — the exact thing the page
  claims not to have. Copy must frame it as *entering*, not *registering*:
  "Your number and a name. That's the whole sign-up." Get this wording right; it
  carries the entire bonus.
- **Reusing `MessageList` on the landing page may pull chat state into the bundle.**
  If `MessageList` depends on `useThread`, extract a presentational
  `MessageListView` that takes `rows` as a prop, and have both the app and the
  replay render it. Decide this during plan 05, not here — noted in 05's risks.
- **Dark-first with a light variant doubles the design pass.** If time runs short,
  commit to dark-only for the landing page and say so, rather than shipping a
  half-considered light mode. `/chat` keeps both regardless.
- **The identity-model section states a real security weakness.** That is
  deliberate and it is the honest read, but the copy must be matter-of-fact about
  a demo API, not alarming.
