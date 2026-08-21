---
description: Review staged or recent project changes for security, a11y, hydration, performance, effects/state, and project code conventions. Auto-writes a follow-up PRD on Critical/Warning findings.
allowed-tools: Read, Grep, Glob, Bash(git diff*), Bash(git diff --cached*), Bash(git log*), Bash(git status*), Bash(git rev-parse*), Bash(pnpm run lint*), Bash(pnpm run test*), Bash(pnpm run type:check*)
---

# Code Review

Review the current project changes for quality, security, a11y, and convention compliance.

## Input

Scope (optional): `$ARGUMENTS`

- **No argument** → review staged changes (`git diff --cached`); if empty, fall back to working tree (`git diff`)
- **A file path** (e.g. `src/components/layout/Hero/index.tsx`) → review that file as a single-scope target
- **A glob pattern** (e.g. `src/components/layout/**/index.tsx`) → review all matching files
- **A commit hash or branch ref** → review that commit's diff (`git show $ARGUMENTS`) or `git diff $ARGUMENTS`

## Skills to load FIRST (before the gate or diff)

Invoke each via the **Skill** tool. **project rules in `CLAUDE.md` and `.claude/skills/{architecture,design-system,workflow}/` override external skill guidance on conflict.**

- `react-best-practices` — React quality checklist for TSX files (component structure, hooks, a11y, perf, TS).
- `vercel-react-best-practices` — load before judging Priority 4 (Performance).
- `next-best-practices` — load before judging Priority 2 (Hydration & RSC).
- `web-design-guidelines` — load before judging Priority 1 (Security & A11y).
- `no-use-effect` — load before judging Priority 5 (Effects & State).
- Load any data-fetching library skill only when the reviewed files import from that library.

## Flags

Parse `$ARGUMENTS` for these flags (remove them before using the rest as scope):

- `--skip-build` — skip the lint + type-check gate (use only for doc-only diffs)
- `--skip-tests` — skip the test gate (use only for doc-only diffs)

## Pre-Review (Quality Gate)

Run BEFORE reading the diff. Stop and surface failures immediately — no review of broken trees.

```bash
# Lint + types (skip if --skip-build)
pnpm run lint
pnpm run type:check

# Tests (skip if --skip-tests)
pnpm run test
```

Then identify changed files:

```bash
git diff --cached --name-only   # or git diff --name-only when nothing staged
git diff --cached                # full patch for review
```

## Checklist

Apply checks **only to changed code**. Report issues only when >80% confident. Do not flag style preferences that Prettier/ESLint already handle.

### Priority 1: Security & Accessibility (Critical)

- `dangerouslySetInnerHTML` with unsanitized user input → XSS
- External `<a>` missing `rel="noopener noreferrer"` when `target="_blank"`
- `next/image` missing `alt` (decorative needs `alt=""`, never absent)
- Icon-only buttons missing `aria-label` / accessible name
- Color-only state communication (no text/icon fallback)
- Modals/dropdowns without focus trap or `Escape` handler
- Interactive surfaces (custom buttons, cards) without keyboard handlers (`onKeyDown` Enter/Space)
- Hardcoded secrets, API keys, tokens

### Priority 2: Hydration & RSC Boundaries (Critical / Warning)

- `'use client'` only where it's actually needed (hooks, browser APIs, event handlers)
- RSC files importing `useState` / `useEffect` / `useRef` / `next/navigation`'s client hooks (must be client)
- Top-level `localStorage` / `window` / `document` access in client components without a mount guard
- DOM-mutating libs (lightboxes, react-modal portals) without `next/dynamic` + `ssr: false`
- Server / Client mismatch — values that differ between SSR and first client render (`Date.now()`, `Math.random()`, locale)
- `next/dynamic` with `ssr: false` used inside an RSC (only valid in client components)
- Client component importing a Server Component (forbidden direction)

### Priority 3: Data Layer (Critical / Warning)

Follow project data-fetching conventions per `architecture/data.md` and any data library skills loaded. Common issues:

- Inline query/operation definitions in components — should live in dedicated operation files and be imported
- Hand-typed query/response results when generated types are available
- `useEffect` wrapping data-fetching hooks — most libraries manage their own lifecycle
- Missing error handling on mutations/queries

When no data-fetching library is in use: skip P3 entirely. Static-data routes are correct by design.

### Priority 4: Performance (Warning)

- Raw `<img>` instead of `next/image`; missing `sizes` on responsive images; missing `priority` on LCP image
- Heavy modals / lightboxes / chart libs / 3D content not loaded via `next/dynamic`
- Animations without `motion-safe:` / `prefers-reduced-motion` gate
- Missing Suspense boundary around RSC data dependency that streams
- List rendering without stable `key` (array index for dynamic lists is a bug)
- Heavy 3D / canvas components rendered eagerly when offscreen (should pause or lazy-load)
- Unbounded queries (when using a data-fetching library) — no `first` / pagination on potentially large lists

### Priority 5: Effects & State (Warning)

- `useEffect` for derived state — project rule: **no-direct-useEffect** — prefer derivation, `useMemo`, event handlers, key-based reset, `useSyncExternalStore`
- Missing or excess deps in remaining effects
- Cleanup function missing for subscriptions, listeners, intervals, timeouts, animation contexts
- `useMemo` / `useCallback` overused (no dep on heavy compute) or underused (passed to memoized children)
- Local state (`useState`) holding values that belong in the project's state store (per `architecture/state.md`)
- Raw store hooks instead of typed wrappers (per `architecture/state.md`)
- Theme stored in state when the project delegates it to a theme provider

### Priority 6: Conventions & Readability (Suggestion / Warning)

**project-canonical rules** (per `CLAUDE.md` Code Conventions + project skills):

- Relative imports (`../../`) instead of `@/` path alias
- `any` type, `// @ts-ignore`, `// @ts-nocheck` introduced in new code (strict mode forbids)
- `interface` keyword used for props or type definitions — project uses `type` only
- `function Foo() {}` declaration — project uses arrow functions only (`const Foo = () => {}`)
- String concatenation or template literals for className composition — must use `cn()` from `@/lib/utils`
- Hardcoded hex colors / arbitrary CSS values (e.g. `#ff0000`, `[16px]`) — must use project tokens (`text-primary`, `p-4`)
- Hardcoded color values that duplicate project tokens (`bg-[#ffffff]` → `bg-white`)
- Inline `style={{}}` for static values — prefer Tailwind utilities or `@utility` SCSS classes
- Both `export const Foo` AND `export default Foo` for the same component — project rule: one or the other (`export default` at the bottom)
- Font classes outside project registry — project font registry is closed (per `design-system/typography.md`)
- Internal navigation not using the project's locale-aware Link helper (per `architecture/routing.md`)
- External navigation (`https://`, `mailto:`, `tel:`) using the internal locale-aware Link instead of `NextLink`
- Project-canonical copy conventions violated (per `CLAUDE.md`)
- Module structure changed but `CLAUDE.md` not updated
- Vitest test missing for new logic (project tests live in `tests/` outside `src/`, NOT `__tests__/` next to source)
- PRD update overwriting `[✅]` history — project rule: PRD history is sacred, preserve completed steps
- `[x]` markers used in PRD checklists — project rule: use `[⬜]` / `[🔄]` / `[✅]` only

## What NOT to Flag

- **Project-canonical design pairs** (per `design-system/colors.md` and `CLAUDE.md`)
- **Formatting issues** — Prettier handles via PostToolUse hook in `.claude/settings.json`
- **Pre-existing issues in untouched files** unless they pose a critical security risk
- **Stylistic preferences** with no rule backing
- **Adding type hints to code outside the diff** (scope creep)
- **<80% confidence findings** (better to under-flag than over-flag)
- **Intentional viewport-relative values** in known locations per `design-system/spacing.md`
- **Data-fetching library rules on files that don't use that library** — gate by import statements

## Output Format

Group findings by file, ordered by severity (Critical → Warning → Suggestion):

```
### `src/components/layout/Hero/index.tsx`

- **Line 42** | **Critical** | Icon-only `<button>` missing `aria-label`
  **Fix:** Add `aria-label="Close menu"` (or similar descriptive text); the icon child does not provide an accessible name.

- **Line 67** | **Warning** | `useEffect` derives `displayName` from `firstName + lastName`
  **Fix:** Derive directly: `const displayName = firstName + ' ' + lastName` — no effect needed.
```

## Verdict

End every review with one of:

| Verdict | Criteria |
|---|---|
| **APPROVE** | No Critical or Warning issues found |
| **APPROVE WITH WARNINGS** | Warning issues exist but non-blocking — list them |
| **REQUEST CHANGES** | Any Critical issue, or multiple Warnings that compound |

### Summary Table

```
| Severity   | Count |
|------------|-------|
| Critical   | 0     |
| Warning    | 0     |
| Suggestion | 0     |

**Verdict: APPROVE**
```

## Auto-PRD-on-violations (project memory rule — NOT opt-in)

When the review finds **any Critical or Warning** issues, write or update a follow-up PRD at `.claude/plans/[scope-slug]-review/prd.md` so the user can run `/implement [scope-slug]-review` to apply fixes.

**Slug derivation:**

- File-scoped review (`$ARGUMENTS = <path>`) → kebab-case from the file path (e.g., `src/components/layout/Hero/index.tsx` → `hero-component-review`)
- Diff-scoped review (default) → kebab-case from the feature/branch name (e.g., a diff on `feature/contact-form-redesign` → `contact-form-redesign-review`)
- Multi-file review with no obvious feature → `code-review-{YYYY-MM-DD}` (today's date)

**PRD structure:**

- Standard project PRD layout: Context, Affected Files, Implementation Steps, Verification, Risks
- Each violation is a separate `[⬜] Step N: <fix description>` entry under Implementation Steps
- Severity prefixes the step description: `[Critical]` or `[Warning]`
- Quote the original line + the suggested fix verbatim
- **Preserve `[✅]` markers** if the PRD already exists — never overwrite completed history
- End with a Verification block listing the items to re-check after fixes ship

**Final prompt to user:** "Ready? Run `/implement [scope-slug]-review`"

This behavior is **not optional**. The `code-reviewer` agent enforces the same policy.
