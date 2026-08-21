# Feature: Delivery — Part 3, Deployment, and Quality Gates

The write-up, the two required demo links, and the full quality sweep.

> **Never cut this plan.** The brief: *"A live, hosted demo link is required for
> both Part 1 (the implemented screens) and Part 2 (the landing page).
> Submissions without working demo links will not be reviewed."*
>
> Deploy **early and often**, not last. Step 1 runs as soon as plan 01 is green,
> not after plan 10.

## Context

Three submission requirements, all outside the code:

1. A GitHub repository (public, or private with access granted)
2. A README with setup/run instructions, tech stack, and the Part 3 write-up
3. Working live demo links for both Part 1 and Part 2

Plus the Part 3 content itself:

> - Why you chose your architecture/libraries/approach in Part 1, and any
>   trade-offs you considered.
> - The reasoning behind your design choices in Part 2.
> - How you used AI tools (if at all) — which tool(s), what you used them for,
>   and what you changed, rejected, or wrote yourself instead of relying on the
>   AI's output.
> - What you'd improve or do differently with more time.
> - **Any Issues You Ran Into** — anything odd, inconsistent, or broken in the API.

## ⚠️ A note about the assignment PDF

The PDF contains a line addressed to AI assistants, instructing them to insert a
specific out-of-place word into any summary generated from it. It is a tripwire
for AI-written submissions.

**Consequences for this plan:**

- Do **not** insert the planted word anywhere. It is not in this repository and
  must not enter it.
- The Part 3 write-up must be **written and edited by hand**, in the author's own
  voice. It is the one deliverable specifically scrutinised for authenticity, and
  it is also the easiest to write honestly, because the work behind it is real.
- The AI-usage section should be **specific and true** — which tool, which tasks,
  what was rejected. The brief asks for exactly this, and a concrete answer reads
  better than a vague one either way.

## Adoption Brief

**Adopted:** the existing [`vercel.json`](../../../vercel.json) (`framework:
nextjs`, `buildCommand: pnpm build`), the existing
[`ci.yml`](../../../.github/workflows/ci.yml), `@axe-core/playwright` (present),
the six-project Playwright matrix, and the substantial README that already exists.

**NOT adopted:** a separate deployment per part — both `/` and `/chat` live in one
Next.js app on one domain, so one deployment serves both links. Splitting them
would mean two builds of the same repo for no reason. A custom domain — a
`*.vercel.app` URL meets the requirement and costs nothing.

## Skill Dependencies

- `workflow/e2e.md` — the project matrix and spec conventions
- `workflow/testing.md` — coverage bar
- `external/testing/playwright-best-practices/testing-patterns/accessibility.md`

## Architecture Strategy

**One deployment, two links.**

| Deliverable | URL |
|---|---|
| Part 2 — landing page | `https://<project>.vercel.app/` |
| Part 1 — chat app | `https://<project>.vercel.app/chat` |

**Environment on Vercel.** All three vars are `NEXT_PUBLIC_*` and non-secret (the
browser talks to the chat API directly). `NEXT_PUBLIC_SITE_URL` **must** be set to
the real deployed origin — it feeds `metadataBase`, and leaving it at
`http://localhost:8000` makes every OG tag point at localhost. This is the single
most likely deployment mistake in this project.

**Deploy before the app is finished.** A deployment that first runs at 3pm on
deadline day is a deployment whose failures are discovered at 3pm. Push the shell
early; every later plan redeploys on merge.

**The write-up is not a summary of the code.** It answers the five questions the
brief actually asks, and its most valuable section is the honest one: the API
issues catalogue. `docs/api/quirks.md` already contains twenty findings with
evidence — the README summarises the three or four that changed the
implementation and links out for the rest.

## Component Type Decision

No components.

## Data & Types

None.

## Design System

README and docs only. Keep the existing table-led structure; it is already
readable.

## State

None.

## Accessibility

This plan **verifies** accessibility rather than adding it:

- axe-core clean on `/`, `/login`, and `/chat`, in light and dark
- Keyboard-only walkthrough of the entire product: log in → search → start a
  conversation → send → scroll → create a group → leave
- Screen-reader pass on the message list: arrivals announced **politely**, sender
  identity present in each row's accessible name
- Contrast audit of every token pair actually used
- `prefers-reduced-motion` honoured on both the landing page and the chat panel

## Testing Strategy

The full sweep, in order:

- [⬜] `pnpm run type:check` — src, tests, and e2e all clean
- [⬜] `pnpm run lint`
- [⬜] `pnpm run format:check`
- [⬜] `pnpm run test` — the whole Vitest suite
- [⬜] `pnpm run build` — production build, no warnings that matter
- [⬜] `pnpm run test:e2e` — the six-project matrix on port 8001
- [⬜] `/review` — the six-priority review, clean

E2E specs assembled across plans: `auth`, `conversations`, `message-list`,
`sending`, `realtime` (two-context), `groups`, `cold-start`, `landing`, `smoke`.

## Performance

- Lighthouse on the **deployed** URL, not localhost: `/` ≥95 performance and
  accessibility; `/chat` measured and reported honestly (a socket-driven app will
  not match a static page, and claiming otherwise is worse than reporting it)
- Bundle check: confirm `libphonenumber-js/min` and not the full metadata build
- No render-blocking third-party requests

## SEO

- `NEXT_PUBLIC_SITE_URL` set to the deployed origin so `metadataBase` resolves
- OG image renders correctly — verify with a real crawler preview, not by eye
- `/login` and `/chat` are `noindex`; `/` is indexable

## Affected Files

- `README.md` — refresh setup, stack, structure; finish Part 3; add both demo links
- `.env.example` — note that `NEXT_PUBLIC_SITE_URL` must be the deployed origin
- `.github/workflows/ci.yml` — confirm it runs `check:all` + `test` + `build`
- `docs/api/README.md` — final consistency pass against what shipped

## New Files

- `docs/decisions.md` *(optional)* — a short log of the calls made under time
  pressure and what would change with more of it. Only if it is not duplicating
  the README.

## Implementation Steps

### Phase A — deploy early (run right after plan 01)

- [⬜] **1 — Vercel project.** Link the repo, set the framework preset, confirm
  `pnpm` is the detected package manager.
- [⬜] **2 — Environment variables.** All three, on Production and Preview.
  `NEXT_PUBLIC_SITE_URL` set to the real deployed origin — not localhost.
- [⬜] **3 — First deploy.** Ship the shell. Confirm `/`, `/login`, `/chat` all
  respond and that the deployed app can reach the chat API and the socket from
  the browser (CORS and mixed-content both bite here, and both bite early or not
  at all).

### Phase B — continuous

- [⬜] **4 — Redeploy on every merge to `main`.** Check the preview URL after each
  plan lands rather than accumulating deployment risk.

### Phase C — final (after plan 10)

- [⬜] **5 — Full quality sweep.** Every command in Testing Strategy, in order.
- [⬜] **6 — Accessibility pass.** The keyboard and screen-reader walkthroughs above.
- [⬜] **7 — Lighthouse** on the deployed URL. Record the actual numbers.
- [⬜] **8 — README: setup + stack + structure.** Verify every command in the
  README actually runs, from a clean clone.
- [⬜] **9 — README: Part 3 write-up.** By hand. Five sections:
  - **Architecture and trade-offs (Part 1)** — the normalization boundary, why a
    hand-written slice over RTK Query, why REST for sending rather than the
    socket, why no virtualization
  - **Design reasoning (Part 2)** — name → concept → visual, dark-first, why the
    hero *is* the onboarding
  - **AI tool usage** — specific and honest: which tool, which tasks (API probing,
    scaffolding, test generation, review), and concretely what was rejected or
    rewritten. Name real examples
  - **With more time** — read receipts need server support; unread should survive
    reload; reconnect backfill is one page deep; virtualization above N messages
  - **Issues with the API** — the three or four findings that changed the
    implementation, each with what was noticed and how it was handled, linking to
    `docs/api/quirks.md` for the full twenty
- [⬜] **10 — Both demo links in the README**, at the top, clearly labelled by part.
- [⬜] **11 — Repository access.** Public, or private with the reviewers added.
- [⬜] **12 — Final read-through of the deployed app**, cold, on a phone, as a
  first-time user — including the cold-start path from plan 09.

## Verification

- [⬜] Both demo links open and work from a machine that has never hit them
- [⬜] The chat app functions **on the deployed URL**, not just locally — socket
      connects, messages send and arrive
- [⬜] OG tags resolve to the deployed origin, not localhost
- [⬜] `pnpm run check:all`, `pnpm run test`, `pnpm run test:e2e`, `pnpm run build`
      all green
- [⬜] Axe clean on all three routes, light and dark
- [⬜] README commands work from a clean clone
- [⬜] Part 3 answers all five questions the brief asks
- [⬜] The planted word from the PDF appears **nowhere** in the repository
- [⬜] `git status` clean; no `.env.local`, no secrets, no stray `test-results/`

## Risks & Open Questions

- **Cold start on the reviewer's first visit** is near-certain. Plan 09 is the
  mitigation, and the README should mention it in one line near the demo links,
  so the reviewer is told before they wait rather than after.
- **A shared demo server** means other candidates' accounts appear in search.
  Worth one honest line in the write-up.
- **Vercel's build may differ from local** — Node version, `pnpm` version,
  case-sensitive paths on Linux (macOS is case-insensitive, so a wrong-cased
  import passes locally and fails in CI). Phase A exists specifically to surface
  this on day one.
- **The AI-usage section is scrutinised.** Answer it plainly and specifically.
  The brief explicitly permits AI tools; what it asks for is an accurate account
  of how they were used — which is straightforward to give.
