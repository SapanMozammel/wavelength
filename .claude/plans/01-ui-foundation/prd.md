# Feature: UI Foundation

Install the remaining dependencies, build the shadcn-style primitive set and the
chat app shell, so every later plan composes rather than invents.

## Context

`src/components/` is empty. `components.json` is configured (new-york, RSC,
tabler icons, `cssVariables: false`) but no primitive has been generated. Every
plan from 03 onward needs buttons, inputs, avatars, dialogs and skeletons, so
this runs first and nothing else starts until it is green.

Design tokens already exist in [`src/styles/global.scss`](../../../src/styles/global.scss)
— the `signal-*` / `pulse-*` ramps and the `canvas` / `surface` / `ink` semantic
set. **Primitives consume those tokens directly.** `components.json` sets
`cssVariables: false`, so do *not* let a shadcn generator write a `--background`
/ `--foreground` shim layer; it would create a second, competing colour system.

Related: [`02-chat-state`](../02-chat-state/prd.md) consumes nothing here but
runs in parallel safely.

## Adoption Brief

**Adopted — new dependencies**

| Package | Why |
|---|---|
| `@radix-ui/react-dropdown-menu` | Conversation row actions, group admin menu |
| `@radix-ui/react-avatar` | Participant avatars with initials fallback |
| `@radix-ui/react-scroll-area` | Sidebar + search results scroll containers |
| `@radix-ui/react-checkbox` | Group creation multi-select |
| `@radix-ui/react-label` | Accessible form labels |
| `@radix-ui/react-separator` | Sidebar and panel dividers |
| `sonner` | Toasts for send failure, group actions, reconnect |
| `libphonenumber-js` | E.164 parse / format / validate — see below |

`libphonenumber-js` earns its weight against two documented API faults:
[quirk 3](../../../docs/api/quirks.md) (search 500s on a leading `+`) and
[quirk 14](../../../docs/api/quirks.md) (login silently renames an account). A
number stored in one format and searched in another is an account nobody can
find. Import from `libphonenumber-js/min` — the full metadata bundle is not
needed and roughly triples the cost.

**Already present, reused:** `@radix-ui/react-dialog`, `react-popover`,
`react-tooltip`, `react-slot`, `react-visually-hidden`, `class-variance-authority`,
`clsx`, `tailwind-merge`, `@tabler/icons-react`, `framer-motion`.

**NOT adopted, deliberately**

- `react-hook-form` — two small forms (login, group create). `sapan.dev` hand-rolls
  `use-contact-form.ts` for the same reason. A hook per form is less code than the
  library plus its resolver.
- `@tanstack/react-virtual` — the message list does scroll-height-delta anchoring
  when prepending older pages (see [`05-message-list`](../05-message-list/prd.md)).
  A virtualizer that owns scroll position fights that directly. Conversation
  volumes here are demo-scale.
- Radix `ScrollArea` **in the message list** — it is adopted for the sidebar only.
  Its custom viewport wraps the scrollable node, so `scrollTop` / `scrollHeight`
  work only through an extra ref indirection, and plans 05 and 07 do that maths
  constantly. The message list uses a native `overflow-y-auto` element.

## Skill Dependencies

- `architecture/component-patterns.md` — Server default, `'use client'` only for
  hooks/events/refs, `memo()` + `displayName` on every client component
- `design-system/colors.md`, `typography.md`, `spacing.md` — token names
- `workflow/tailwind-v4-syntax.md` — `@theme`, no `tailwind.config.js`
- `workflow/no-use-effect.md` — always active; this plan creates the sanctioned
  escape hatch

## Architecture Strategy

**Styling** — primitives are token-only. No hex, no `bg-slate-*`, no
`--background` variables. A primitive that needs a colour reaches for
`bg-surface dark:bg-surface-dark`, `text-ink dark:text-ink-dark`,
`border-border-subtle dark:border-border-subtle-dark`, or the `signal-*` ramp.

**Variants** — `cva` for anything with more than two visual states (Button,
Badge). A single boolean toggle uses `cn()` and a conditional, not a variant
table.

**Client boundary** — Radix primitives are client components, so the wrappers
around them are too. Pure presentational primitives (Skeleton, EmptyState,
Spinner, Avatar's static fallback) stay Server so a landing page can render them
without shipping JS.

**Accessibility baseline set here, inherited everywhere:** focus ring is already
global in `global.scss` (`:focus-visible`, 2px `signal-500`) — primitives must
not override it. Every icon-only control takes a required `label` prop that
becomes `aria-label`; make it required in the type so it cannot be forgotten.

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/components/ui/button.tsx` | Client | Radix `Slot`, `asChild` |
| `src/components/ui/input.tsx` | Client | controlled value, events |
| `src/components/ui/textarea.tsx` | Client | auto-grow ref, events |
| `src/components/ui/label.tsx` | Client | Radix |
| `src/components/ui/avatar.tsx` | Client | Radix image-load state |
| `src/components/ui/skeleton.tsx` | **Server** | pure presentational |
| `src/components/ui/spinner.tsx` | **Server** | pure presentational |
| `src/components/ui/empty-state.tsx` | **Server** | pure presentational |
| `src/components/ui/error-state.tsx` | Client | retry callback |
| `src/components/ui/badge.tsx` | **Server** | pure presentational |
| `src/components/ui/separator.tsx` | Client | Radix |
| `src/components/ui/checkbox.tsx` | Client | Radix |
| `src/components/ui/scroll-area.tsx` | Client | Radix |
| `src/components/ui/dropdown-menu.tsx` | Client | Radix |
| `src/components/ui/dialog.tsx` | Client | Radix |
| `src/components/ui/sheet.tsx` | Client | Radix Dialog, mobile sidebar |
| `src/components/ui/tooltip.tsx` | Client | Radix |
| `src/components/ui/icon-button.tsx` | Client | wraps Button, requires `label` |
| `src/components/ui/toaster.tsx` | Client | `sonner` mount point |
| `src/components/layout/common/theme-toggle.tsx` | Client | `useTheme` |
| `src/components/layout/common/logo.tsx` | **Server** | inline SVG wordmark |

All in kebab-case files; identifiers stay PascalCase; `export default` at the
bottom.

## Data & Types

No new domain types. `src/types/chat.ts` and `src/types/api.ts` are untouched.

## Design System

- **Surfaces** — `bg-canvas dark:bg-canvas-dark` for the page,
  `bg-surface dark:bg-surface-dark` for panels,
  `bg-surface-raised dark:bg-surface-raised-dark` for hovered / elevated rows
- **Brand** — `signal-600` primary action (light), `signal-500` (dark);
  `pulse-500` reserved **exclusively** for live/real-time affordances so the
  cyan never becomes decoration
- **Radius** — `rounded-panel` for panels, `rounded-bubble` for message bubbles,
  `rounded-full` for avatars and pills
- **Type** — `font-display` headings, `font-sans` body, `font-mono` timestamps
  and phone numbers
- **Motion** — CSS transitions ≤200ms for hover/press; Framer Motion only for
  entrance and layout. `prefers-reduced-motion` is global — no per-component guard

## State

None introduced. `sonner`'s toast queue is library-internal and deliberately not
mirrored into Redux.

## Accessibility

- Icon-only controls: `label: string` is a **required** prop on `IconButton`
- Dialog and Sheet get a title, `VisuallyHidden` when not shown
- Contrast checked for `signal-600` on `surface` and `signal-500` on
  `surface-dark` at 4.5:1
- Skeletons are `aria-hidden` with an `aria-live` status sibling, so a screen
  reader hears "Loading messages", not a wall of empty boxes

## Testing Strategy

Primitives get characterisation tests only where behaviour exists — Button
(`asChild`, disabled), IconButton (accessible name present), ErrorState (retry
fires). Skeleton/Spinner/Badge are visual and get no unit test. Real coverage
lands in plans 03–07 against real surfaces.

## Performance

Radix packages import per-component, never as a barrel. `sonner`'s `<Toaster />`
mounts once in `providers/index.tsx`. `libphonenumber-js/min` only —
a `pnpm build` bundle check confirms the full metadata build did not sneak in.

## Affected Files

- `package.json` — 8 new dependencies
- `src/providers/index.tsx` — mount `<Toaster />` inside the existing providers
- `src/app/layout.tsx` — apply `bg-canvas dark:bg-canvas-dark` to `<body>` and
  add a skip link

## New Files

- `src/hooks/use-mount-effect.ts` — the single sanctioned `useEffect` wrapper
- `src/components/ui/*.tsx` — the 19 primitives in the table above
- `src/components/layout/common/theme-toggle.tsx` — light/dark switch
- `src/components/layout/common/logo.tsx` — wordmark
- `src/lib/utils/phone.ts` — `normalizePhone`, `formatPhoneAsYouType`,
  `isValidPhone`, wrapping `libphonenumber-js/min`
- `tests/lib/utils/phone.test.ts`
- `tests/components/ui/button.test.tsx`, `icon-button.test.tsx`, `error-state.test.tsx`

## Implementation Steps

- [✅] **1 — Install dependencies.** `pnpm add` the six Radix packages, `sonner`,
  `libphonenumber-js`. Verify `pnpm build` still passes before writing any component.
- [✅] **2 — `useMountEffect`.** Create `src/hooks/use-mount-effect.ts` exactly as
  specified in `workflow/no-use-effect.md`, with the eslint-disable comment. This
  is the only place `useEffect` is called in the app outside `src/hooks/`.
- [✅] **3 — Phone utilities.** `src/lib/utils/phone.ts` over `libphonenumber-js/min`.
  `normalizePhone` returns E.164 or `null`; `formatPhoneAsYouType` drives the login
  field; `isValidPhone` gates submit. Unit-test first — a bad normalizer produces
  unfindable accounts, which is invisible until a second user searches.
- [✅] **4 — Presentational primitives.** Skeleton, Spinner, Badge, EmptyState,
  ErrorState, Logo. Server components, tokens only, no `'use client'`.
- [✅] **5 — Form primitives.** Button (cva: `primary` / `secondary` / `ghost` /
  `danger` × `sm` / `md` / `lg`), IconButton (required `label`), Input, Textarea,
  Label, Checkbox.
- [✅] **6 — Overlay + layout primitives.** Dialog, Sheet, DropdownMenu, Tooltip,
  Popover wrapper, Separator, ScrollArea, Avatar (initials fallback derived from
  `User.name`).
- [✅] **7 — Toaster + theme toggle.** Mount `<Toaster />` in `providers/index.tsx`
  with `richColors` off and token-matched styling. Build `theme-toggle.tsx` on
  `useTheme`, guarding hydration per `rendering-hydration-no-flicker`.
- [✅] **8 — Shell polish.** `<body>` background tokens, a skip link to `#main`,
  and confirm the global focus ring survives every primitive.
- [✅] **9 — Gate.** `pnpm run format:all`, `pnpm run check:all`, `pnpm run test`,
  `pnpm run build`.

## Verification

- [⬜] No primitive contains a hex value or a `bg-slate-*` / `--background` class
- [⬜] No `cssVariables` shim layer was added to `global.scss`
- [⬜] `IconButton` will not compile without a `label`
- [⬜] Light and dark both checked at 375px and 1280px
- [⬜] `grep -rn "useEffect" src/components src/app` returns nothing
- [⬜] `grep -rn "_id" src/components` returns nothing
- [⬜] `pnpm run check:all` and `pnpm run test` green

## Risks & Open Questions

- **shadcn CLI vs hand-written.** The CLI wants `cssVariables` and a `baseColor`
  palette this project does not use. Recommendation: hand-write the primitives in
  the new-york idiom against project tokens. Faster than reconciling the generated
  output, and the token discipline is a graded quality.
- **`sonner` theming.** It ships its own CSS custom properties. Pass explicit
  `toastOptions.classNames` rather than importing its stylesheet, so it inherits
  `surface` / `ink` tokens instead of introducing a third palette.
