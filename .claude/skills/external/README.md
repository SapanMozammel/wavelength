# External Skills Library

Framework-level reference skills curated from upstream skill libraries (Anthropic, Vercel Engineering, currents.dev, Apollographql, community). **project rules in `CLAUDE.md` and `.claude/skills/{architecture,design-system,workflow}/` are authoritative — when external guidance conflicts with project rules, project wins.**

These skills auto-trigger or load on demand via the Claude Code Skill tool. Most are project-agnostic; load them for general framework wisdom, then defer to project-specific rules for project conventions.

## Authority gradient

```
project rules (architecture/, design-system/, workflow/)   ← authoritative, project-canonical
        ↓
Bridge skills (e.g. workflow/e2e.md, architecture/data-graphql.md)   ← cite external + extend with project specifics
        ↓
External skills (this directory)   ← framework-level reference; lower priority on conflict
```

When in doubt during code authoring or review: read the project skill first, then load the relevant external skill for deeper coverage if a specific case isn't documented in project's rules. Never let an external skill override `CLAUDE.md`.

## Categories

### `nextjs/` (3 skills) — Next.js App Router framework reference

| Skill | Source | When to use |
|---|---|---|
| `next-best-practices` | Anthropic | **Load first** for any Next.js work — file conventions, RSC boundaries, data patterns, async APIs, metadata, route handlers, image/font optimization, bundling. Drives Priority 2 (Hydration & RSC) decisions in code review. |
| `nextjs-app-router-patterns` | Anthropic | Advanced patterns — Server Components, streaming, parallel routes, advanced data fetching. Load when implementing parallel routes, intercepting routes, or non-trivial data flows. |
| `next-upgrade` | Anthropic | Procedural — follow when upgrading Next.js to a new major version. Cites official codemods. |

**Overlap note:** `next-best-practices` is the entry point; `nextjs-app-router-patterns` is the deep dive for advanced cases. Don't load both for routine work.

### `react/` (2 skills) — React + hooks discipline

| Skill | Source | When to use |
|---|---|---|
| `react-best-practices` | Anthropic | **Auto-trigger on TSX edits** — runs a condensed quality checklist (component structure, hooks usage, a11y, perf, TypeScript). Reviewer-style. |
| `vercel-react-best-practices` | Vercel Engineering | 67-rule perf reference for React + Next.js. Load before judging Priority 4 (Performance) findings. Heavier than `react-best-practices`; reach for it when perf is the focus. |

**Overlap note:** `react-best-practices` is auto-trigger reviewer; `vercel-react-best-practices` is the deep perf reference.

**Moved to project-canonical:** the `no-use-effect` skill (formerly `external/react/no-use-effect/`) lives at [`workflow/no-use-effect.md`](../workflow/no-use-effect.md). Reason: the rule is "ALWAYS ACTIVE" project-wide and conflicts with the framework-reference framing; treating it as authoritative project rule is more honest. Citations from `code-reviewer` agent, `/review` command, and `architecture/component-patterns.md` footer now point at the workflow location.

### `typescript/` (2 skills) — TypeScript depth

| Skill | Source | When to use |
|---|---|---|
| `typescript-expert` | Anthropic | Deep problem-solving — type-level programming, performance optimization, monorepo management, migration strategies. Load when stuck on a complex type or refactoring across modules. |
| `typescript-advanced-types` | Anthropic | Advanced type system — generics, conditional types, mapped types, template literals, utility types. Load when designing reusable type utilities. |

**Overlap note:** `typescript-expert` is deep problem-solving; `typescript-advanced-types` is the type-system deep dive. Use `typescript-expert` first for unfamiliar problems.

**Removed:** the `nextjs-react-typescript` skill was deleted because it actively conflicts with project rules in `CLAUDE.md` Code Conventions: it advocates `interface` over `type` (project: `type` only), `function` over arrow functions (project: arrow only), named exports over `export default` (project: `export default` at bottom), and `nuqs` for URL search params (this project does not use it). The conflict was higher than the value of its 52-line summary. The project's `CLAUDE.md` Code Conventions block is the canonical reference for the project TypeScript style.

### `testing/` (2 skills) — Playwright + e2e patterns

| Skill | Source | When to use |
|---|---|---|
| `playwright-best-practices` | currents.dev | Comprehensive Playwright reference — POM, mocking via `page.route()`, axe-core a11y, visual regression, console-error monitoring, multi-tab flows, file uploads, GraphQL mocking, mobile/responsive, performance budgets, security. **Load when writing or debugging e2e specs.** |
| `e2e-testing-patterns` | currents.dev / R&D drop | Patterns reference — selector strategy, fixture composition, network mocking, parallelism, flake mitigation. Pair with `playwright-best-practices` when designing a new spec or refactoring an existing one. |

**Overlap note:** project's `workflow/testing.md` (Vitest unit/component conventions) is authoritative for test placement (`tests/` outside `src/`, NOT `__tests__/`). The bridge skill `workflow/e2e.md` cites both external skills for general Playwright wisdom while encoding project-specific conventions (browser matrix, dedicated e2e port, fixture catalog, reduced-motion default).

### `design/` (2 skills) — UI / UX / a11y

| Skill | Source | When to use |
|---|---|---|
| `frontend-design` | Anthropic | Production-grade visual quality, anti-generic-AI aesthetics. Load when the task involves building or styling user-facing UI. |
| `web-design-guidelines` | Anthropic | Web Interface Guidelines compliance — accessibility + UX standards. Drives Priority 1 (Security & A11y) findings in code review. **Load before any user-facing surface.** |

**Overlap note:** project's `design-system/{colors,typography,spacing}.md` are authoritative for tokens, fonts, spacing scales, and dark-mode pairings. Load these BEFORE `frontend-design` to avoid token-drift suggestions from the external skill.

### `data/` (1 skill) — GraphQL data layer

| Skill | Source | When to use |
|---|---|---|
| `apollo-client` | Apollographql | Apollo Client 4.x patterns — setup, hooks, caching, fragments, RSC integration, testing. **Load only when reviewing or authoring files that import from `src/lib/apollo/`.** Rules apply only when Apollo is in use. |

**Trim note:** the `references/integration-{client,react-router,tanstack-start}.md` files were deleted during copy — project uses Next.js, only `integration-nextjs.md` applies.

**Overlap note:** when Apollo is in use, project's `architecture/data-graphql.md` is authoritative for project-specific conventions (RSC vs client decision, Redux/Apollo state boundary, fragment colocation, `dataMasking: true`, codegen flow). Load that bridge skill first; cite this external skill for deeper Apollo wisdom.

### `tooling/` (1 skill) — bundler

| Skill | Source | When to use |
|---|---|---|
| `turbopack` | Anthropic | Turbopack expert guidance — bundler config, HMR optimization, build issues, Turbopack vs Webpack differences. project uses Turbopack default for `next dev` and `next build`. |

## Skipped (not in this library)

- **`nextjs`** (general Next.js skill) — redundant with `next-best-practices` + `nextjs-app-router-*`. Not copied.

## Loading priority

For most project work:

1. **Project skills first** — `architecture/component-patterns.md`, the relevant `design-system/*.md`, applicable `workflow/*.md`. These are project-canonical.
2. **Bridge skills** when present — `workflow/e2e.md`, `architecture/data-graphql.md`. They cite external skills + extend with project specifics.
3. **External skills here** — only when a specific case isn't covered by project or bridge skills.

## How to update this library

External skills should be refreshed periodically from upstream. To update one:

1. Fetch from the upstream source directly.
2. Re-apply any project-specific trims (e.g., the apollo-client `integration-{client,react-router,tanstack-start}.md` deletes)
3. Verify `Skill` tool can still load it
4. Note the upstream version in this README if it materially changed
