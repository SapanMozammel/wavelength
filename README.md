# Wavelength

A real-time chat application built on phone-number identity — one number, one
name, and you're on the air. Plus a landing page that introduces it.

Built as a take-home assignment against a provided Chat API.

| | Link |
|---|---|
| **Part 1 — Chat app** | _deploy pending_ |
| **Part 2 — Landing page** | _deploy pending_ |
| **Part 1 — API documentation** | [`docs/api/`](docs/api/) |
| **Part 3 — Write-up** | [below](#part-3--thought-process) |

---

## Setup

Requires Node 20+ and pnpm 9+.

```bash
pnpm install
cp .env.example .env.local     # defaults already point at the live API
pnpm dev                       # http://localhost:8000
```

### Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on port 8000 |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit + component tests |
| `pnpm test:e2e` | Playwright, 6-project matrix, port 8001 |
| `pnpm type:check` | TypeScript across `src`, `tests`, `e2e` |
| `pnpm check:all` | Type check + lint + format check |
| `pnpm format:all` | Organize imports + Prettier + ESLint fix |
| `pnpm api:probe` | Re-derive the live API's response shapes (see below) |

### Environment

Two URLs, and they are deliberately different:

```bash
NEXT_PUBLIC_API_BASE_URL=https://frontend-task-chatapp.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://frontend-task-chatapp.onrender.com
```

REST lives under `/api`. **Socket.io lives at the origin root.** Pointing the
socket at the REST base produces a connection that never establishes and never
explains why. There are no secrets — the browser talks to the API directly.

> The demo API runs on a free Render tier and sleeps after inactivity. The first
> request of a session can take 30–60 seconds.

---

## Stack

**Next.js 16** (App Router) · React 19 · TypeScript 6 (strict, with
`exactOptionalPropertyTypes`) · **Tailwind CSS v4** (CSS-first `@theme`, no JS
config) + SCSS · **Redux Toolkit** · **socket.io-client** · next-themes · Framer
Motion · Radix primitives · Tabler icons

**Testing:** Vitest + Testing Library (`tests/`); Playwright + axe-core (`e2e/`)

**Tooling:** ESLint 9 flat config, Prettier, `eslint-plugin-better-tailwindcss`,
kebab-case filename enforcement

---

## Structure

```
src/
├── app/              # / (landing) · /login · /chat
├── components/
│   ├── layout/       # chat/ · landing/ · common/
│   ├── ui/           # primitives
│   └── icons/
├── lib/
│   ├── api/          # http · endpoints · normalize · errors
│   ├── socket/       # socket.io client + event contracts
│   ├── utils/        # cn(), time formatting
│   └── env.ts
├── store/            # Redux Toolkit
├── types/            # api.ts (wire) · chat.ts (domain)
└── styles/           # Tailwind @theme + SCSS partials
docs/api/             # Part 1 documentation deliverable
scripts/api-probe.mjs # regenerates the evidence behind docs/api/
.claude/              # AI workflow: agents, commands, skills, PRDs
```

---

## Part 3 — Thought Process

### Documenting the API before building

The provided Swagger is **request-only**: it lists paths, methods, and request
bodies, but no response bodies and no status codes. Documenting the responses is
part of the assignment, so the first thing built was not the UI — it was
`scripts/api-probe.mjs`, a script that exercises every endpoint against the live
server and prints what comes back.

That decision paid for itself immediately. It surfaced **20 inconsistencies**,
all catalogued with evidence in [`docs/api/quirks.md`](docs/api/quirks.md), and
three of them would have quietly broken the chat panel:

1. **A message has two different shapes depending on transport.** REST returns
   `_id` with an ISO-8601 `createdAt`; the socket's `message:new` returns `id`
   with **epoch-milliseconds** `createdAt`. The message list is precisely where
   those two streams merge — and the failure only appears once a *second user*
   is talking to you, which is the case least likely to be caught in solo
   testing.
2. **The sender receives no socket echo of their own message.** Only other
   participants get `message:new`. So local echo is mandatory, not an
   optimisation, and a client that waits for socket confirmation shows a message
   that never arrives.
3. **The `before` pagination cursor is inclusive** — `?before=X` returns X again.
   Infinite scroll built on it duplicates one message per page.

Two more worth naming because they sit directly on required flows: searching by
phone number **crashes the endpoint with a 500** (`q` is interpolated into a
Mongo `$regex` unescaped, and `+` is an invalid quantifier), and **empty
messages are accepted with a 200** by both REST and socket — so the "empty
messages should not be sendable" requirement is entirely the client's job.

The full catalogue is in [`docs/api/quirks.md`](docs/api/quirks.md); a complete
OpenAPI spec with every response shape is in
[`docs/api/openapi.yaml`](docs/api/openapi.yaml); and what the API would look
like if the routes were mine to name is argued in
[`docs/api/redesign.md`](docs/api/redesign.md). Everything is reproducible —
`pnpm api:probe` re-runs the whole thing.

### Architecture

**One normalization boundary.** Wire types (`src/types/api.ts`) and domain types
(`src/types/chat.ts`) are separate, and
[`src/lib/api/normalize.ts`](src/lib/api/normalize.ts) is the only place they
meet. Every wire shape becomes a domain shape exactly once: `_id` → `id`, every
timestamp → epoch milliseconds, `lastMessage: {}` → `null`, newest-first →
oldest-first, inclusive cursor → deduped.

This is the single most important structural decision in the project, and it is
a direct consequence of the probe. Without knowing that REST and socket messages
have different shapes, the natural design is to pass API responses straight into
components — which works perfectly until a second person sends you a message.
The normalizer means no component ever writes `?._id` or checks whether a
timestamp is a string.

The invariants are pinned by tests: `normalizeRestMessage` and
`normalizeSocketMessage` are asserted to produce byte-identical output for the
same logical message, so a future API change fails loudly in CI rather than
silently in the UI.

**A typed error taxonomy** rather than status-code branching. The API's status
codes are not self-consistent — a missing token is `400`, an invalid one is
`401`, and a malformed id is a `500` carrying a raw Mongoose `CastError`.
`src/lib/api/errors.ts` classifies on status *and* payload code, so the UI
branches on `kind` (`unauthorized`, `not-found`, `offline`, …) and never renders
a driver message to a user.

**Trade-offs considered:**

- *TanStack Query vs. Redux Toolkit.* Query is the better default for
  server-state, but chat is not request/response — optimistic sends, socket
  arrivals, and paginated history all mutate the same ordered list, and that
  wants one reducer owning merge order rather than cache invalidation. RTK also
  matches the conventions already in use across my other projects.
- *Socket-only vs. REST + socket.* Sending over REST rather than the socket
  gives back the server-assigned message id, which the socket's bare
  `{ ok: true }` ack does not. That id is what lets an optimistic message be
  replaced rather than duplicated.
- *SCSS alongside Tailwind v4.* Tailwind for composition, SCSS partials for
  keyframes and things that genuinely want nesting. The cost showed up as a real
  build failure — Tailwind v4 scanned the markdown in `docs/` and `.claude/`,
  compiled illustrative classes like `bg-[url(...)]` into literal CSS, and broke
  module resolution. Fixed with `@source not` exclusions, documented in
  `global.scss` so the next person does not rediscover it.

### Design (Part 2)

Reasoning is recorded in [`.claude/plans/landing-page/prd.md`](.claude/plans/landing-page/prd.md).
In short: the product's one distinctive idea is identity without an account, so
the page's primary CTA is the real login field, inline in the hero — a landing
page that demonstrates "no sign-up flow" rather than claiming it. The palette is
a violet `signal` ramp with cyan `pulse` reserved exclusively for things that are
live, dark-first because that is when messaging apps get used.

### AI tools

Claude Code (Opus), used for: probing the live API and cataloguing its
behaviour; scaffolding the project against my existing conventions; drafting the
API documentation from real probe output; and writing the normalizer, error
taxonomy, and their tests.

What I directed rather than accepted: the decision to probe the API before
writing any UI, and the choice to make the normalization boundary the
architectural centre of the project rather than handling shape differences at
call sites. The project conventions — kebab-case files, `type` over `interface`,
arrow functions, tokens-only styling, the `.formatter` single-source setup — come
from my own `claude-workflow` repo, which is synced into every project I start.

### With more time

- **Virtualized message list.** Fine at demo scale; a 10,000-message
  conversation would not be.
- **A mock API layer for tests.** E2E currently depends on the live server,
  which cold-starts and holds other candidates' data. MSW against the real
  recorded shapes would make CI deterministic.
- **Read state.** The API has no read endpoint, so unread counts are per-device
  and lost on refresh. Worth proposing upstream rather than faking client-side.
- **Broader e2e.** The two-context real-time test is the valuable one; group
  admin flows are currently covered by unit tests only.

### Issues with the API

All 20, with reproduction steps, evidence, and the workaround shipped for each:
[`docs/api/quirks.md`](docs/api/quirks.md).

Worth saying explicitly, since a list of 20 problems reads as an indictment
otherwise: the parts that matter most for safety are correct. Group
authorization returns proper `403`s with clear messages. A valid-but-foreign
conversation id returns `404` with no distinction between "absent" and
"forbidden", which is the right call. Direct-conversation creation is properly
idempotent. Socket auth is enforced at handshake. The problems are concentrated
in response-shape consistency and input validation, not in access control.

---

## AI workflow

This repo is set up to be worked on with Claude Code. [`CLAUDE.md`](CLAUDE.md)
carries the project conventions and the API pitfalls; `.claude/` carries the
agents, slash commands, skills, and PRDs.

```
.claude/
├── agents/      # code-reviewer · test-writer · e2e-spec-author · tailwind-class-reviewer
├── commands/    # /plan · /implement · /review · /test · /commit · /pr · …
├── skills/      # architecture · design-system · workflow · external references
└── plans/       # chat-experience/prd.md · landing-page/prd.md
```

Both PRDs are written and unstarted. The intended flow:

```
/implement chat-experience     # Part 1, steps 1–10
/implement landing-page        # Part 2
/review                        # 6-priority review before PR
```

Synced from [`SapanMozammel/claude-workflow`](https://github.com/SapanMozammel/claude-workflow),
with the GraphQL, i18n, and Tailwind-mangling tooling pruned — none of it
applies here, and leaving it in would misdirect an agent reading the workflow.
