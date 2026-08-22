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
pnpm dev                       # prints the URL it picked (default :3000)
```

### Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server. Set `PORT` to pin it; otherwise Next picks the first free port from 3000 |
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

### Deploying

One deployment serves both parts: `/` is the landing page, `/chat` is the app.

```bash
vercel link
vercel --prod
```

Set these in the Vercel project, on **Production and Preview**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://frontend-task-chatapp.onrender.com/api` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://frontend-task-chatapp.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | the deployed origin, e.g. `https://wavelength.vercel.app` |

`NEXT_PUBLIC_SITE_URL` is the one worth double-checking: it feeds `metadataBase`,
so if it is missing or stale every Open Graph tag and the landing page's JSON-LD
point somewhere that is not the site. There are no secrets — the browser talks to
the chat API directly.

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

**One reducer owns message order.** Three sources write to the same ordered
list — an optimistic send, a socket arrival, and a page of older history — and
they arrive out of order by nature. All four merge cases live in one pure module
([`chat-merge.ts`](src/store/slices/chat-merge.ts)) that was written test-first,
before any component imported it:

- an optimistic message appends under a `clientId`
- the server response replaces it **in place, by position** — delete-then-append
  would let two fast sends swap places
- a socket arrival is a no-op if its id is already present, and otherwise
  inserts by `createdAt` (binary search, because sockets can deliver out of order)
- an older page prepends without disturbing the tail

**Auto-scroll is three rules, not one.** The brief asks for one sentence' worth
of behaviour — follow the conversation, but do not yank a reader who has scrolled
up — and that is where most implementations fail, because they treat it as a
single condition. Following an arrival while the reader is at the bottom,
*always* following their own send (sending is an explicit request to see the
result), and holding position otherwise are three different answers. "At the
bottom" is a threshold, never an equality test: a trackpad leaves fractional
`scrollTop`, so exact comparison classifies a reader who is visibly pinned to the
bottom as having scrolled away, and silently stops following.

Holding position is only survivable because of the "N new messages" pill —
without it, a message that arrives while reading history is simply invisible.

**Scroll position and draft text are deliberately not in Redux.** Both change on
every frame or keystroke, and putting them in the store would re-render the whole
history to produce a value the DOM already knows.

**Effects are structural, not choreographed.** The panel is mounted as
`<ChatPanel key={conversationId} />`, so switching threads remounts rather than
re-synchronising: history refetches on mount, the scroll anchor resets, and there
is no window in which one thread renders against another's participants. The same
trick holds the socket — a component keyed on the session token, so a new token
builds a clean connection instead of re-authenticating one in place.

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

Reasoning is recorded in [`.claude/plans/10-landing-page/prd.md`](.claude/plans/10-landing-page/prd.md).
In short: the product's one distinctive idea is identity without an account, so
the page's primary CTA is the real login field, inline in the hero — a landing
page that demonstrates "no sign-up flow" rather than claiming it. The palette is
a violet `signal` ramp with cyan `pulse` reserved exclusively for things that are
live, dark-first because that is when messaging apps get used.

### AI tools

**Claude Code (Opus)**, used heavily and across the whole project — the brief
asks for an accurate account, so here is one.

*What it was used for:* probing the live API and cataloguing its behaviour;
drafting the API documentation from real probe output; writing the normalizer,
error taxonomy, state container and their tests; and building most of the UI.
Later phases ran several agents in parallel, each in its own git worktree with an
explicit file-ownership boundary, so concurrent work could not clobber shared
files — `chat-slice.ts` and `types/chat.ts` were each assigned to exactly one
track at a time.

*What I directed rather than accepted:* probing the API before writing any UI,
and making the normalization boundary the architectural centre rather than
handling shape differences at call sites. Splitting the message list into a
store-free presentational view and a connected container was also a direction —
it let the landing page reuse the product's real message geometry without pulling
chat state into its bundle.

*What went wrong, and what that taught me:* agents told not to run Playwright, so
ports stayed free for parallel work, wrote e2e specs that had therefore never
executed. Four were wrong on first run — none because the app was broken:

- a bare `getByRole('alert')` matched Next's own `__next-route-announcer__`,
  present on every page, so "nothing is announced" could never pass
- a spec seeded state by visiting `/login`, then caught its own setup navigation
  and read it as a redirect
- an axe scan landed mid-entrance-animation and reported ~58 contrast failures at
  a 1.01 ratio, because it was measuring invisible text
- interactions fired before hydration, so the form submitted natively and skipped
  client validation entirely

Each time the product was verified correct *before* the test was changed. The
lesson was a process one — a test that has never been run is not evidence — and
it surfaced a real convention gap: `workflow/e2e.md` documents a reduced-motion
fixture that had never been implemented, which is what allowed the axe flake.

*What was checked rather than trusted:* an agent added new colour tokens against
an explicit instruction not to. It was right — recomputing the contrast showed
the existing `danger` is 3.87:1 on a light surface, which fails AA for text. The
socket was likewise verified end-to-end against the live server rather than
assumed correct, which confirmed `message:new` really does arrive as
`{ id, createdAt: <epoch> }` while REST returns `_id` and an ISO string.

The project conventions — kebab-case files, `type` over `interface`, arrow
functions, tokens-only styling, the no-`useEffect` rule, the `.formatter`
single-source setup — come from my own `claude-workflow` repo, synced into every
project I start.

### With more time

- **Group administration.** Creating groups works, which is what the brief asks
  for. Adding, removing, promoting and leaving are not built — the API supports
  all four, and the plan for them is written
  ([`08-group-management`](.claude/plans/08-group-management/prd.md)); it was cut
  under time pressure rather than overlooked. The consequence worth naming: a
  member who joins a group currently cannot leave it.
- **Virtualized message list.** Fine at demo scale; a 10,000-message
  conversation would not be. Deliberately avoided for now because a virtualizer
  owns scroll position, and the load-older path already does
  `scrollHeight`-delta anchoring that it would fight.
- **A send queue that survives reload.** Failed sends are retryable, but only
  while the tab is open.
- **Reconnect backfill is one page deep.** A disconnect longer than one page of
  traffic can still leave a gap in history.
- **Read state.** The API has no read endpoint, so unread counts are per-device
  and lost on refresh. Worth proposing upstream rather than faking client-side.
  For the same reason no message shows a delivery checkmark — this API cannot
  confirm delivery, and drawing a tick would be a lie told in UI.

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
└── plans/       # 11 sequenced PRDs, one per slice of work
```

The work was planned as eleven PRDs before any feature code was written, each
sized to a single `/implement` run, with a dependency graph and an explicit cut
line in [`.claude/plans/README.md`](.claude/plans/README.md). Nine shipped.
[`08-group-management`](.claude/plans/08-group-management/prd.md) was cut
deliberately — it is the one plan the brief does not require.

Progress lives in the PRDs themselves (`[⬜]` / `[🔄]` / `[✅]`), so the record of
what was built, deferred, and why is in the repo rather than in a chat log.

Synced from [`SapanMozammel/claude-workflow`](https://github.com/SapanMozammel/claude-workflow),
with the GraphQL, i18n, and Tailwind-mangling tooling pruned — none of it
applies here, and leaving it in would misdirect an agent reading the workflow.
