---
description: Investigate and fix a bug using TDD — Vitest+RTL for unit/component, Playwright for e2e
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(pnpm run test*), Bash(pnpm run lint*), Bash(pnpm run type:check*), Bash(pnpm exec vitest*), Bash(pnpm exec playwright*), Bash(git diff*), Bash(git log*), Bash(git status*), Bash(gh issue *), Bash(gh pr *), Bash(command -v *)
---

# Fix Issue

You are a senior engineer on this project. Investigate the reported bug, write a failing test that captures it, then fix the smallest unit that makes the test pass. No band-aids, no swallowed errors.

## Input

Issue number, URL, or description: `$ARGUMENTS`

## Skills to load FIRST (before reading any code)

Invoke each via the **Skill** tool before tracing the bug. **project rules in `CLAUDE.md` and `.claude/skills/{architecture,design-system,workflow}/` override external skill guidance on conflict.**

- `no-use-effect` — strict no-direct-`useEffect` rule. Bugs caused by `useEffect` for derived state should be fixed by removing the effect, not patching it.
- `react-best-practices` — React quality checklist (component structure, hooks, a11y, perf).
- `next-best-practices` — Next.js conventions, RSC boundaries, image/font, route handlers — load when the bug touches an app route or a Server Component.
- `playwright-best-practices` — load when the bug needs a Playwright reproduction (route-level, multi-page, visual, a11y).

## Process

1. **Reproduce.** Try to fetch issue context if `$ARGUMENTS` looks like a numeric ID or GitHub URL:

   ```bash
   if command -v gh >/dev/null 2>&1 && [[ "$ARGUMENTS" =~ ^([0-9]+|https://github.com/) ]]; then
     gh issue view "$ARGUMENTS" 2>/dev/null || echo "No issue context fetched; using \$ARGUMENTS as bug description"
   else
     echo "Treating \$ARGUMENTS as bug description directly"
   fi
   ```

   Don't error if `gh` is missing or the issue doesn't exist. Use `Grep` + `Glob` to locate the failure surface — start from a unique string in the report (label, route, error message, copy text). Read the implicated component(s) and their imports end to end before forming a hypothesis.

2. **Trace the flow** (per project architecture in `.claude/skills/architecture/`):
   - **UI bugs:** trace route → layout/providers → component → state (per `architecture/state.md`) → side effects
   - **Data bugs:** trace per `architecture/data.md` — check data source, fetching conventions, type definitions
   - **i18n bugs:** check translation files and routing config. Run `/review-i18n` if it's a translation parity issue.
   - **Theme bugs:** check theme provider setup per `architecture/state.md`
   - **Style bugs:** check design-system tokens per `skills/design-system/colors.md`

3. **Pick the test layer** (per `workflow/testing.md`):
   - Pure utility / helper → Vitest unit test
   - Component with state, effects, or store → Vitest + RTL
   - Route-level flow, multi-page, visual or a11y regression → Playwright spec in `e2e/<feature>.spec.ts`

4. **Write the failing test FIRST.** It must fail for the reason the bug describes, not for an unrelated assertion. Run only that test:
   ```bash
   pnpm exec vitest tests/path/to/foo.test
   pnpm exec playwright test e2e/<file>.spec.ts --project=chromium-desktop
   ```

5. **Fix the smallest unit.** Address the root cause. Do not wrap the failing call in `try/catch` to silence it, do not paper over with optional chaining, do not add a fallback that hides the broken state. If the cause is in shared infrastructure (`src/lib/utils/*`, `src/components/layout/common/*`, or state store slices), fix it in place — do not refactor opportunistically unless the user asks.

6. **Re-run and widen.**
   ```bash
   /format                                # organize-imports + Prettier + ESLint --fix
   pnpm run test                          # full Vitest suite
   pnpm run lint                          # must be clean
   pnpm run type:check                    # must be clean
   pnpm exec playwright test --project=chromium-desktop  # affected spec(s)
   ```
   For visual changes, update screenshots only when intentional: `pnpm exec playwright test --update-snapshots <spec>`. Never blanket-update.

7. **Self-review the diff.** `git diff` and read every hunk. Reject anything unrelated to the fix — drive-by formatting, removed comments, unrelated refactors. The diff should read like the bug report inverted.

## Constraints

- Use **pnpm** for everything. Never `npm`, never `npx`.
- Never bypass git hooks (`--no-verify`, `--no-gpg-sign`).
- Never run destructive git commands (`reset --hard`, `checkout .`, `clean -f`) without an explicit user ask.
- Never disable TypeScript with `any`, `// @ts-ignore`, or `// @ts-nocheck` to dodge the bug.
- Follow project code conventions per `CLAUDE.md` and `.claude/skills/architecture/`.
- No `console.log` in committed code.
- No new dependencies unless the bug genuinely cannot be fixed without one.

## Report

When done, summarize in 4–6 lines: what was broken, the root cause, the file(s) changed, the new test(s), and the test commands you ran with their results. If the fix touched a component covered by `code-reviewer` rules, note any P1–P6 priorities the diff hits so the user knows whether to invoke `code-reviewer` before commit.
