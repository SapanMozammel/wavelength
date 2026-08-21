---
name: e2e
description: "project-canonical Playwright + axe-core e2e conventions. Triggers when authoring or modifying any spec under e2e/, fixtures, page objects, or playwright.config.ts; when running pnpm test:e2e; when /e2e-add-spec is invoked. Encodes the project browser matrix, dedicated dev-server port, fixture catalog, reduced-motion default, mock-everything-external rule. Cites external/testing/playwright-best-practices and external/testing/e2e-testing-patterns; extends project architecture conventions; never duplicates them."
---

# Workflow — End-to-End Testing (Playwright + axe-core)

## Required reading first

Before authoring or modifying any e2e spec, read these project skills — they are authoritative:

- [`architecture/component-patterns.md`](../architecture/component-patterns.md) — component structure, file org
- [`architecture/routing.md`](../architecture/routing.md) — routing, locales, navigation helpers
- [`architecture/state.md`](../architecture/state.md) — state management conventions
- [`architecture/data.md`](../architecture/data.md) — data source conventions
- [`workflow/testing.md`](./testing.md) — Vitest unit/component conventions; the unit-vs-e2e boundary
- [`workflow/no-use-effect.md`](./no-use-effect.md) — effects are last resort; specs assert observable outcomes, not effect-driven side effects
- [`design-system/colors.md`](../design-system/colors.md) — project token swap patterns
- [`design-system/typography.md`](../design-system/typography.md) — font registry
- [`design-system/spacing.md`](../design-system/spacing.md) — named spacing scale only

This skill **extends** those conventions for e2e tests; if any of them change, reread before authoring specs. This skill must NOT duplicate them — it cites and extends.

---

## What it is

Playwright + `@axe-core/playwright` for browser-driven end-to-end testing. Vitest (`tests/`) stays canonical for unit + component tests.

## When to write an e2e

Defer to [`workflow/testing.md`](./testing.md) for the unit-vs-e2e boundary. As a heuristic, e2e is for:

- Cross-component flows that span at least two routes or two surfaces
- Locale-aware behavior (URL prefix, `<html lang>`, `<html dir>`, translation parity at the rendered-DOM level)
- Theme + RTL — `.dark` class swap on `<html>`, `dir="rtl"` for RTL locales, persistence across reload
- Network-mocked external integrations
- Accessibility — axe-core scans on production-like routes that Vitest's jsdom can't fully exercise

If the assertion fits comfortably in jsdom + RTL (a single component's render, props, or internal state), it belongs in `tests/`, not `e2e/`.

---

## Project matrix

`playwright.config.ts` defines browser projects. Document your matrix here:

| Project | Engine | Use |
|---|---|---|
| `chromium-desktop` | Chromium 1280×800 | Default fast-feedback target; runs on every commit |
| `firefox-desktop` | Firefox 1280×800 | Cross-engine regressions; full PR matrix |
| `webkit-desktop` | WebKit 1280×800 | iOS/Safari regressions; full PR matrix |
| `mobile-webkit` | `devices['iPhone 15']` | Mobile responsive + iOS Safari |
| `mobile-chromium` | `devices['Pixel 7']` | Mobile responsive on Chromium engine |
| `i18n-rtl` | Chromium, locale `ar`, `baseURL` `/ar` | RTL flow (if applicable) |
| `dark-mode` | Chromium, `colorScheme: 'dark'` | Dark-mode token swaps |
| `motion-on` | Chromium, no reduced-motion override | Runs ONLY `motion.spec.ts` |

**Default dev server port:** document your port. Playwright spawns its own dev server via `webServer.command` so the developer's regular `pnpm dev` keeps running side-by-side.

---

## Fixture catalog

All specs import `test` and `expect` from [`e2e/fixtures.ts`](../../../e2e/fixtures.ts), never raw `@playwright/test`. The default `page` fixture forces `prefers-reduced-motion: reduce` via `page.emulateMedia()`.

Document your fixture catalog here:

| Fixture | Signature | Purpose |
|---|---|---|
| _(add project fixtures)_ | | |

To add a new fixture: extend the `test.extend` generic in `e2e/fixtures.ts`, document the contract here, and reference [`external/testing/e2e-testing-patterns/SKILL.md`](../external/testing/e2e-testing-patterns/SKILL.md) for composition idioms.

---

## Wait strategy

| Wait | Allowed? | Use |
|---|---|---|
| `await page.goto(url)` with default `'load'` or `'domcontentloaded'` | yes | Initial navigation |
| `await expect(locator).toBeVisible()` / `toHaveText()` / `toHaveURL()` | yes | Auto-waiting matchers — preferred over manual probes |
| `await locator.waitFor({ state: 'visible' })` | yes | Element-level deterministic wait |
| `await page.waitForFunction(() => …)` | yes (sparingly) | When DOM state isn't expressible as a locator |
| `await page.waitForLoadState('networkidle')` | **NO** | Background scripts / fonts / analytics can keep network hot |
| `await page.waitForTimeout(ms)` | **NO** | Wall-clock waits are flake. Always wait on a deterministic state. |

The grep gate: `grep -r 'waitForTimeout\|networkidle' e2e/` must return nothing. Wired into the verification block in the PRD.

---

## Mock-everything-external rule

Every external network call has a `page.route()` mock — without exception. A spec that hits a real external service is rejected at review. The `e2e-spec-author` agent refuses to scaffold one.

---

## Reduced-motion-default policy

Animation libraries produce non-deterministic output under headless CI. The default `page` fixture emulates `prefers-reduced-motion: reduce` so animated content settles instantly and assertions are stable.

The `motion-on` project is the only place where motion runs un-emulated, and only `motion.spec.ts` targets it (file-scoped via `testMatch` in `playwright.config.ts`). No other spec disables reduced-motion.

---

## Page Object placement

Document your Page Object Model structure:

| POM | Path | Use |
|---|---|---|
| _(add page objects)_ | | |

Single-purpose specs (i18n, seo, theme) skip POM and inline their selectors — POM overhead isn't worth it for one-shot DOM probes.

---

## Locale-aware specs (if using i18n)

The canonical locale list lives in the routing config — never hardcode it in a spec. For PR-scope coverage, parameterize over a representative sample. See `architecture/routing.md` for locale setup.

## Source-of-truth for asserted copy

Read all expected copy from source files; never hardcode strings:

- Translation keys → read from translation source files per `architecture/routing.md`
- Static content → read from data source files per `architecture/data.md`
- Locale list, locale prefix, RTL set → read from routing config

A spec that asserts a literal string is rejected at review — assert against the imported value.

---

## Slash commands & agent

| Tool | Purpose | Example |
|---|---|---|
| [`/e2e-add-spec [feature]`](../../commands/e2e-add-spec.md) | Scaffold a new e2e spec via the `e2e-spec-author` agent | `/e2e-add-spec Test that the FAQ accordion expands on click` |
| [`/lhci`](../../commands/lhci.md) | Run Lighthouse CI locally | `/lhci` |
| [`e2e-spec-author`](../../agents/e2e-spec-author.md) | Agent that designs and scaffolds Playwright specs | Spawn via Agent tool |

---

## See also

- [`external/testing/playwright-best-practices/SKILL.md`](../external/testing/playwright-best-practices/SKILL.md) — comprehensive Playwright reference
- [`external/testing/e2e-testing-patterns/SKILL.md`](../external/testing/e2e-testing-patterns/SKILL.md) — patterns reference
- [`workflow/testing.md`](./testing.md) — Vitest unit + component conventions; unit-vs-e2e boundary
- [`workflow/no-use-effect.md`](./no-use-effect.md) — effects discipline

---

## Anti-rule reminder

This skill **extends** project conventions; it must not duplicate them. If component-pattern, state, routing, or design-system rules are restated here, that's a smell — collapse the duplication and link to the source. The bridge skill is a thin layer **on top of** project conventions, never a parallel one.
