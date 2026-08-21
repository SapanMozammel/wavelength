# Design System — Spacing & Layout

## Scale

Tailwind's default 4px-based scale. Prefer multiples of `2` (0.5rem) for
component internals and multiples of `4` (1rem) for layout gaps.

## Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-bubble` | 1.125rem | Message bubbles. The run-collapsing corner is overridden per-bubble. |
| `rounded-panel` | 1rem | Cards, panels, modals |
| `rounded-full` | — | Avatars, pills, icon buttons |

## Chat panel layout

The three-region layout is fixed; only the message list scrolls.

```
┌─ header ────────── shrink-0
├─ message list ──── flex-1 min-h-0 overflow-y-auto
└─ composer ─────── shrink-0
```

**`min-h-0` on the scrolling region is mandatory.** A flex child defaults to
`min-height: auto`, which refuses to shrink below its content — so without it
the list grows past the viewport and the whole page scrolls instead of the list.
This is the single most common way this layout breaks.

Use `h-dvh`, not `h-screen`, so mobile browser chrome does not crop the composer.

## Message bubbles

- Max width `min(75%, 40rem)` — long enough to read, short enough to keep the
  sender/receiver asymmetry visible
- Vertical gap: `space-y-1` within a run from one sender, `space-y-4` between runs
- Horizontal padding `px-3.5`, vertical `py-2`

## Touch targets

Minimum 44×44px for anything tappable. Icon buttons get padding to reach it even
when the icon is 20px.

## Safe areas

The composer sits above the home indicator on iOS:
`pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
