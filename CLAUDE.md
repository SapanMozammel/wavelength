# CLAUDE.md

Guidance for Claude Code when working in this repository.

---

## What this is

**Wavelength** — a real-time chat app built against a provided Chat API, plus a
landing page that showcases it. Built as a take-home assignment in three parts:

| Part | Deliverable | Where |
|---|---|---|
| 1 | API documentation, written before any code | [`docs/api/`](docs/api/) |
| 1 | Chat app — login, search, direct + group conversations, live messages | `/login`, `/chat` |
| 2 | Creative landing page | `/` |
| 3 | Thought-process write-up | [`README.md`](README.md#part-3--thought-process) |

The assignment brief calls out the **chat panel** — message list, sending,
real-time behaviour — as where the most care should go. Weight effort
accordingly: polish there before polish anywhere else.

---

## Commands

```bash
# Run after every change
pnpm run type:check    # TypeScript (src + tests + e2e)
pnpm run lint:fix      # Auto-fix ESLint
pnpm run format:all    # Organize imports + Prettier + ESLint fix

# Test & build
pnpm run test          # Vitest (run once)
pnpm run build         # Production build
pnpm run dev           # Dev server on port 8000

# Run before push
pnpm run test:e2e      # Playwright (6-project matrix, port 8001)
pnpm run check:all     # type:check + lint + format:check

# API
pnpm api:probe         # Re-derive live API response shapes (see docs/api/)
```

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 6 · Tailwind CSS v4 · SCSS ·
Redux Toolkit · socket.io-client · next-themes · Framer Motion · Radix
primitives · Tabler icons

**Testing:** Vitest + RTL in `tests/`; Playwright + axe-core in `e2e/` on
dedicated port `8001`.

**Deliberately not used:** i18n (single-locale assignment), GraphQL/Apollo (the
API is REST), Tailwind class mangling. The corresponding commands, agents, and
skills were pruned from `.claude/` so they cannot mislead — do not re-add them
via `sync.sh` without reason.

---

## The API is inconsistent — read this before touching data code

The provided API's published spec documents **no response bodies and no status
codes**. All shapes were derived from the live server, and 20 real
inconsistencies were found. Three of them will silently break the chat panel if
forgotten:

1. **A message has two different shapes depending on transport.** REST returns
   `_id` + ISO-8601 `createdAt`; the socket's `message:new` returns `id` +
   **epoch-milliseconds** `createdAt`. The message list merges both streams.
2. **The sender receives no socket echo of their own message.** Only other
   participants get `message:new`. Local echo is mandatory, not an optimisation.
3. **The `before` pagination cursor is inclusive** — it returns the cursor
   message again, duplicating one message per page.

Full catalogue: [`docs/api/quirks.md`](docs/api/quirks.md).

**The rule:** every wire shape is normalized exactly once, in
[`src/lib/api/normalize.ts`](src/lib/api/normalize.ts). Nothing outside
`src/lib/api/` may import from `src/types/api.ts` or read `_id`. If you find
yourself writing `?._id` or `typeof createdAt === 'string'` in a component,
the normalizer is missing a case — fix it there.

Wire types live in [`src/types/api.ts`](src/types/api.ts); domain types the UI
consumes live in [`src/types/chat.ts`](src/types/chat.ts). Keep them separate.

**Phone numbers are normalized the same way.** A phone number is this app's
primary key for identity, and `GET /users/search` substring-matches the stored
string — so a number saved in one format and searched in another is an account
nobody can find, with no error from either request. Everything user-typed goes
through [`src/lib/utils/phone.ts`](src/lib/utils/phone.ts) before it reaches
the API. That module checks numbers are *possible*, not *valid*: the live
server already holds accounts on the `+1555…` block that strict validation
rejects.

---

## Project Structure

```
src/
├── app/              # App Router — / (landing), /login, /chat
├── components/
│   ├── layout/       # chat/, landing/, common/ — feature composition
│   ├── ui/           # Primitives (shadcn-style, new-york)
│   └── icons/
├── lib/
│   ├── api/          # http.ts · index.ts (endpoints) · normalize.ts · errors.ts
│   ├── socket/       # socket.io client + event contracts
│   ├── utils/        # cn(), time formatting
│   └── env.ts        # ALL env reads go through this
├── store/            # Redux Toolkit — slices/, hooks/
├── types/            # api.ts (wire) · chat.ts (domain)
├── hooks/, providers/, styles/
tests/                # Vitest unit + component
e2e/                  # Playwright specs + page objects
docs/api/             # Part 1 deliverable — README, quirks, redesign, openapi.yaml
scripts/api-probe.mjs # Regenerates the evidence behind docs/api/
.formatter/           # Single source for ESLint + Prettier + EditorConfig
```

All file and folder names are kebab-case.

---

## Server vs Client Components

Server Component by default; `'use client'` only when hooks, events, refs, or
browser APIs are needed. Client Component → `memo()` + `ComponentName.displayName`.
Server CAN import Client; Client CANNOT import Server.

Note the shape of this app: the chat screen is client-heavy by necessity (socket,
scroll position, optimistic state), but the **landing page should be almost
entirely server-rendered**. Do not let `'use client'` leak upward from an
interactive leaf into a whole page.

→ [.claude/skills/architecture/component-patterns.md](.claude/skills/architecture/component-patterns.md)

---

## Styling

Tailwind CSS v4 — config lives in CSS `@theme` in
[`src/styles/global.scss`](src/styles/global.scss); there is no
`tailwind.config.js`. SCSS partials alongside it for keyframes and utilities.
Dark mode via the `.dark` class (`next-themes`), declared with `@custom-variant`.

- **Colour** — the `signal-*` (violet) and `pulse-*` (cyan) ramps, plus
  `canvas`/`surface`/`ink` semantic tokens with `-dark` counterparts. Never a
  hardcoded hex.
- **Type** — `font-display` (Outfit) for headings, `font-sans` (Inter) for body,
  `font-mono` for timestamps and code.
- **Motion** — CSS keyframes for hover and micro-interaction (`animate-bubble-in`,
  `animate-pulse-ring`, `animate-typing-dot`), Framer Motion for entrances and
  layout transitions. `prefers-reduced-motion` is honoured globally in
  `global.scss`; individual components need no guard.
- Never build class names dynamically — strings must be static. Compose with
  `cn()` from `@/lib/utils`, never template literals or ternaries returning
  class strings.

---

## State

**Redux Toolkit** (`src/store/`) — `sessionSlice` holds the JWT and current
user, persisted to `localStorage` from listener middleware rather than an
effect. Always use `useAppDispatch()` / `useAppSelector()`, never raw Redux
hooks.

**Theme:** `next-themes`, not Redux.

**Chat data** (conversations, messages, socket status) is deliberately *not* in
Redux yet — decide its home in the PRD before implementing. The constraint that
matters: optimistic sends, socket arrivals, and paginated history all mutate the
same message list, so whatever holds it needs one reducer that owns merge order.

---

## Code Conventions

- Arrow functions only — never `function Foo() {}`
- **kebab-case for all file and folder names**; React component identifiers stay
  PascalCase
- `type` only — never `interface`
- `cn()` from `@/lib/utils` for all className composition
- Design tokens only — no hardcoded colours or hex values
- `@/` alias for all internal imports
- Env vars: read only via `@/lib/env` — never `process.env.X` directly except
  for `NODE_ENV`
- No `any` — strict mode with `noUnusedLocals`, `noUnusedParameters`,
  `exactOptionalPropertyTypes`
- `export default ComponentName` at the bottom of every component file
- **Never call `useEffect` in a component.** `useMountEffect` from
  [`src/hooks/use-mount-effect.ts`](src/hooks/use-mount-effect.ts) is the only
  sanctioned wrapper, and it belongs in a hook — see
  [`.claude/skills/workflow/no-use-effect.md`](.claude/skills/workflow/no-use-effect.md)
- PRD history is sacred — never overwrite completed (`[✅]`) steps; use
  `[⬜]` / `[🔄]` / `[✅]`, never `[x]`

---

## Accessibility

The chat panel is a live region and needs to behave like one:

- New messages announce via `aria-live="polite"` — not `assertive`, which
  interrupts the user mid-read
- The message list is keyboard-scrollable and focusable
- Every icon-only control has an accessible name
- Colour is never the sole distinction between sent and received bubbles —
  alignment and shape carry it too
- Playwright specs assert axe-core cleanliness on both `/` and `/chat`

---

## Slash Commands

Project commands live in `.claude/commands/`, invoked as `/<name> [args]`.

| Command | Purpose |
|---|---|
| `/plan [feature]` | Explore code + load skills + write a PRD at `.claude/plans/[kebab-name]/prd.md`. No code written. |
| `/implement [plan-name]` | Read the PRD, execute step-by-step, run quality gates, mark progress. |
| `/review [scope?]` | 6-priority code review (Security/A11y, Hydration/RSC, Data Layer, Perf, Effects/State, Conventions). Auto-writes a follow-up PRD on Critical/Warning findings. |
| `/fix-issue [num\|description]` | TDD-first bug fix — failing test, smallest fix, re-run gate. |
| `/test [unit\|e2e\|<file>]` | Run a suite, or generate Vitest+RTL / Playwright tests for a target. |
| `/e2e-add-spec [feature]` | Scaffold a Playwright spec via the `e2e-spec-author` agent. |
| `/commit [message?]` | Smart commit — secret scan, `type(scope)` prefix, HEREDOC body. |
| `/commit-staged [message?]` | Commit only what is already staged. |
| `/push [flags?]` | Safe push — quality gate, branch guard, refuses force-push to default. |
| `/pr [base?]` | Structured PR with quality gate and change categories. |
| `/merge [source]` | Safe local merge — refuses dirty trees and divergent targets, never pushes. |
| `/format` | Organize imports + Prettier + ESLint fix. |
| `/new-component [Name]` | Scaffold a component per conventions. |
| `/new-section [Name]` | Scaffold a page section per conventions. |
| `/fix-tw-diagnostics [scope?]` | Sweep Tailwind canonical-class and conflict diagnostics. |

## Agents

| Agent | When to invoke |
|---|---|
| `code-reviewer` | Before commit / before PR — the 6-priority checklist in a parallel context. |
| `test-writer` | Adding or changing components, or fixing a bug TDD-style. |
| `e2e-spec-author` | When `/implement` decides a feature warrants Playwright coverage. |
| `tailwind-class-reviewer` | Auditing className composition against the token system. |

## Plans

PRDs live in `.claude/plans/`. Current:

| Plan | Covers |
|---|---|
| `chat-experience/` | Part 1 — login, search, conversations, message panel, real-time |
| `landing-page/` | Part 2 — the creative showcase page |

## External Skills Library

Framework reference skills in
`.claude/skills/external/{nextjs,react,typescript,testing,design,tooling}/`.
Project rules in `.claude/skills/{architecture,design-system,workflow}/` are
**authoritative** — when external guidance conflicts, project rules win.
