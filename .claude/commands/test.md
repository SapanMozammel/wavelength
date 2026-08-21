---
description: Run or generate tests — Vitest unit/component, i18n parity audit, or Playwright e2e
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(pnpm run test*), Bash(pnpm run test:watch*), Bash(pnpm run test:coverage*), Bash(pnpm exec vitest *), Bash(pnpm exec playwright *), Bash(pnpm run lint*), Bash(git diff*), Bash(git log*)
---

# Test

Two modes — the command picks based on `$ARGUMENTS`:

- **Run mode** (`unit`, `e2e`, `i18n`, or empty): execute the relevant test suite, analyze failures, fix them
- **Generate mode** (a file path, component name, or feature description): produce Vitest + RTL or Playwright tests for the target

## Input

`$ARGUMENTS` — one of `unit` / `e2e` / `i18n` / empty / `<file path or feature description>`

## Skills to load FIRST (before reading the target or running the suite)

Invoke each via the **Skill** tool. **project rules in `CLAUDE.md`, `workflow/testing.md`, and `workflow/i18n-audit.md` override external skill guidance on conflict.**

- `react-best-practices` — TSX testing patterns + the broader component checklist.
- `web-design-guidelines` — defines critical a11y violations the test should catch.
- `playwright-best-practices` — load **only** when writing or running e2e specs.
- `apollo-client` — load **only** when the target imports from `@/lib/apollo/`.

## Run Mode

Determine scope from `$ARGUMENTS`:

| Argument | Action |
|---|---|
| `unit` | `pnpm run test` (Vitest, run-once) |
| `e2e` | `pnpm run test:e2e` (Playwright, defaults to all 8 projects in the matrix). Use `--project=chromium-desktop` for a fast single-browser smoke. |
| `i18n` | Run project's i18n audit: parallel-spawn agents to check translation parity (missing keys, over-translation, orphan keys, ICU placeholder integrity) per `.claude/commands/review-i18n.md` (was `audit-i18n.md`); produce the three PRDs at `.claude/plans/{missing-translations-audit, over-translation-audit, orphan-translation-keys-audit}/prd.md` |
| empty | `pnpm run test` (and `pnpm run test:e2e` if `e2e/` exists) |

If all pass: report summary (suites, tests, duration, coverage if `pnpm run test:coverage` was used).

If failures: for each failing test:
1. Show test name + file location.
2. Read the relevant source file.
3. Diagnose the root cause (logic bug, type mismatch, missing mock in `tests/setup.tsx`, stale snapshot, content drift from a recent rewrite).
4. Apply a fix — never delete or skip the failing test, never widen types to silence errors, never weaken assertions to make a test pass.
5. Re-run only the failed test to confirm it passes (`pnpm exec vitest tests/path/to/foo.test`).

Final report: tests fixed, tests still failing (if any), next steps.

## Generate Mode

Triggered when `$ARGUMENTS` is a file path, component name, or feature description.

### Process

1. **Read the target.** Open the file at `$ARGUMENTS` (or `Grep` for it if a name was given). Follow each import that affects behavior: providers, hooks, GraphQL operations (when Apollo is in use), helpers from `src/lib/utils/*`, types from `src/types/*`. Note every external dependency that needs mocking.

2. **Pick the test layer.**
   - Pure function / utility / `src/lib/*` module → **Vitest unit** in `tests/lib/foo.test.ts`. No DOM.
   - React component, custom hook, or Context provider → **Vitest + RTL** in `tests/components/Foo.test.tsx`. Use `render` from `tests/test-utils.tsx` (Redux-Provider-wrapped).
   - Whole route, multi-component journey, visual regression, accessibility audit → **Playwright** in `e2e/<feature>.spec.ts`.

3. **Reuse what exists.** Before writing fresh helpers:
   - Check `tests/test-utils.tsx` — project's `render` already wraps in `<Provider store={store}>`. Always import `render` from here, never directly from `@testing-library/react`.
   - Check `tests/setup.tsx` — project's global mocks (see `workflow/testing.md` for the full list). **If a new global mock is needed, extend `tests/setup.tsx` rather than adding `vi.mock(...)` per test.**
   - Check sibling `tests/components/*` for existing patterns and match their style.

4. **Generate the spec.** Cover the layers below — skip what genuinely doesn't apply, but don't stop at "renders without crashing".

### Coverage checklist (component / hook)

- [ ] **Renders with realistic data** from project's static data shapes (per `architecture/data.md`).
- [ ] **Loading / Empty states** — when the component shows distinct states.
- [ ] **Error state** — when the component handles failure (form validation, network error, retry).
- [ ] **Prop variants** that change layout or behavior.
- [ ] **User interactions** — `click`, `type`, `submit`, keyboard (`Tab`, `Enter`, `Escape`).
- [ ] **State transitions** — store dispatches, derived UI, hook returns (per `architecture/state.md`).
- [ ] **URL params** — `useSearchParams` / `useParams` (already mocked in `tests/setup.tsx`).
- [ ] **localStorage** — persisted keys when relevant; use `vi.stubGlobal('localStorage', ...)`.
- [ ] **`prefers-reduced-motion` variant** when the component animates.
- [ ] **Accessibility** — roles, labels, focus management on dialogs/menus. Prefer `getByRole` over `getByTestId`.
- [ ] **Data-fetching mocks** (when target uses a data library) — at least one success + one error mock per query/mutation hit.

### Coverage checklist (Playwright e2e)

- [ ] **Happy path** through the feature.
- [ ] **At least one edge case** (empty results, validation failure, network error via `page.route(...)`).
- [ ] **i18n** — verify on representative locales including RTL when applicable (per `architecture/routing.md`).
- [ ] **Theme** — verify in light + dark when token-touching.
- [ ] **Accessibility scan** with `@axe-core/playwright` — no critical violations.
- [ ] **Visual regression** at 375 / 768 / 1440 px via `toHaveScreenshot()` when the spec covers a visual surface.
- [ ] **Console errors asserted clean** (`page.on('console', ...)`).

5. **Place the file correctly.**

   | Type | Location | Naming |
   |------|----------|--------|
   | Vitest unit / component | `tests/components/`, `tests/lib/`, `tests/data/`, `tests/store/`, `tests/ui/` | `Foo.test.tsx` / `helper.test.ts` |
   | Playwright e2e | `e2e/` | `<feature>.spec.ts` |

   Keep tests in `tests/` outside `src/`, NOT `__tests__/` next to source (per `workflow/testing.md`).

6. **Run until green.**

   ```bash
   pnpm exec vitest tests/path/to/foo.test       # single file
   pnpm run test                                  # full suite
   pnpm exec playwright test e2e/<file>.spec.ts --project=chromium-desktop
   ```

   For visual specs verify all viewports pass; on first run create the baseline with `--update-snapshots` and review the PNGs in `e2e/screenshots/` before committing.

   Finish with `pnpm run lint`.

## Mocking rules

- project's `tests/setup.tsx` already has global mocks (see `workflow/testing.md`). **Don't duplicate these per test** — extend `tests/setup.tsx`.
- Data-fetching libraries (when in use): wrap with the library's mock provider — see `architecture/data.md` and any data library skills loaded.
- localStorage: `vi.stubGlobal('localStorage', { getItem, setItem, removeItem, clear })` and reset between tests in `beforeEach`.
- **Never mock the module under test. Never mock React itself.**

## Constraints

- Use **pnpm** for everything. Never `npm` / `npx`.
- TypeScript strict — no `any`, no `@ts-nocheck` in new test files. Import types from `src/types/*`.
- Follow project testing conventions in `CLAUDE.md` and `.claude/skills/workflow/testing.md`.
- Do not weaken assertions to make a test pass. If the component is buggy, fail the test and tell the user.

## Report

When done, summarize in 4–6 lines: which file you tested, which layer (Vitest unit / Vitest+RTL / Playwright), the cases covered, the path to the new spec, and the exact command you ran with its result.
