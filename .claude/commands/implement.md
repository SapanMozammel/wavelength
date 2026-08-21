---
description: Implement a feature from an approved PRD at .claude/plans/[plan-name]/prd.md
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(pnpm run *), Bash(pnpm exec *), Bash(git checkout *), Bash(git pull *), Bash(git rev-parse *), Bash(git status *), Bash(git diff *), Bash(git log *)
---

# Feature Implementation

You are a senior engineer on this project. You ship clean, production-quality code — no demos, no shortcuts, no scope creep. If the PRD is ambiguous, ask before writing code. If you spot issues outside scope, leave a `// TODO(scope-out):` comment and stay focused.

## Input

PRD plan name (resolves to `.claude/plans/[plan-name]/prd.md`): `$ARGUMENTS`

## Skills to load FIRST (before any code)

Invoke each via the **Skill** tool before reading the PRD. **project rules in `CLAUDE.md` and `.claude/skills/{architecture,design-system,workflow}/` are authoritative — when external skill guidance conflicts, project rules win.**

**Always-load (project-canonical):**

- `component-patterns` (project) — component structure, pre-write checklist, file organization
- `colors` (project) — semantic tokens, dark-mode pairs
- `typography` (project) — font registry, heading utilities
- `spacing` (project) — container utilities, section spacing, breakpoints
- `routing` (project) — routing strategy, navigation helpers
- `state` (project) — state management approach, typed hooks
- `data` (project) — data layer conventions, type definitions, data flow

**Conditional load (only when the PRD's scope warrants it):**

- `next-best-practices` — when touching app routes, layouts, route handlers, metadata
- `nextjs-app-router-patterns` — when implementing parallel routes, streaming, advanced data fetching
- `vercel-react-best-practices` — when judging perf decisions or writing performance-sensitive components
- `react-best-practices` — when authoring or refactoring TSX components
- `no-use-effect` — automatic on any React component code (skill is ALWAYS ACTIVE)
- `frontend-design` — when the PRD has UI work that requires distinctive visual quality
- `web-design-guidelines` — before any user-facing surface
- `playwright-best-practices` — when the PRD adds e2e specs
- `figma:figma-implement-design` — only if the PRD references a Figma URL or node id

## Process (in order)

a. **Read the PRD** at `.claude/plans/$ARGUMENTS/prd.md` plus root `CLAUDE.md`. Read every file listed under Affected Files and New Files before any code.

b. **Branch** off the default branch dynamically:

   ```bash
   BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's@^origin/@@')
   BASE=${BASE:-main}
   git checkout "$BASE" && git pull && git checkout -b "feature/$ARGUMENTS"
   ```

   Never commit to `$BASE` directly.

c. **Execute each PRD step in order.** Before starting a step, mark it `[🔄]` in the PRD; mark `[✅]` when done. **Never overwrite or remove completed `[✅]` steps** (project rule: PRD history is sacred). Use `[⬜]` / `[🔄]` / `[✅]` markers — never `[x]`.

d. **Apply the pre-write checklist** from `component-patterns.md` to every component you write or edit. Follow project conventions from `CLAUDE.md` and `.claude/skills/{architecture,design-system,workflow}/`.

e. **Style with project tokens.** Use project design-system tokens per `skills/design-system/colors.md`, `typography.md`, and `spacing.md`. Never introduce new design tokens or fonts beyond the project registry.

f. **Wire data** per `architecture/data.md`. Follow data-fetching conventions in `CLAUDE.md`.

g. **Manage state** per `architecture/state.md`.

h. **Write tests** per `workflow/testing.md`. Cover happy path + loading/error/empty states + interactions + a11y. Playwright e2e per `workflow/e2e.md`.

i. **Quality gate** — run all of these and fix every failure before declaring done:

   ```bash
   /format                             # organize-imports + Prettier + ESLint --fix
   pnpm run lint                       # must be clean
   pnpm run test                       # must be green
   pnpm run type:check                 # must be clean (tsc --noEmit)
   pnpm run build                      # only when a route, layout, config, or middleware changed
   ```

j. **Update `CLAUDE.md`** only if the feature changed module structure, added a new conventions surface, or introduced a new directory worth documenting. Do not add docs for one-off components.

k. **Self-review against the PRD's Verification block.** Walk through each verification item; confirm it passes. Then run the PRD's Risks section as a sanity check — surface any unaddressed risks before declaring done.

l. **Report:** files created, files modified, type check result, test result, verification step status, branch name, and any `// TODO(scope-out):` comments left behind.

## Rules

- **Implement only what's in the plan.** Ask before guessing ambiguous steps. Do not add unrequested features.
- Use **pnpm** for everything. Never `npm`, never `npx`, never `yarn`.
- **No `useEffect` for derived state.** Prefer derivation, `useMemo`, key-based reset, event handlers, `useSyncExternalStore`. The `no-use-effect` skill is the canonical reference and is ALWAYS ACTIVE.
- **No `any`.** TypeScript strict mode is on.
- **Reuse existing components and utilities** before adding new dependencies.
- **Never commit `.env`, secrets, or files containing API keys.** Stage files explicitly — never `git add -A` / `git add .`.
- **Never auto-stage during implementation work.** For renames, use plain `mv` (NOT `git mv`). For single-file deletes, use `rm` (NOT `git rm`). For directory deletes, ask the user. The user manages staging via `/commit-staged` or manual `git add`.
- **Never bypass git hooks** (`--no-verify`, `--no-gpg-sign`).
- **PRD history is sacred** — preserve `[✅]` completed steps when updating the PRD; use `[⬜]` / `[🔄]` / `[✅]` markers, never `[x]`.
