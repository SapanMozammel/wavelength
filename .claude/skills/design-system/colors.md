# Design System — Colors

Tokens are declared in `@theme` in [`src/styles/global.scss`](../../../src/styles/global.scss).
There is no `tailwind.config.js` — Tailwind v4 reads the CSS.

All values are `oklch` so light and dark pairs stay perceptually matched at
equal lightness, which `hsl` does not guarantee.

## Brand ramps

| Token | Role |
|---|---|
| `signal-50` … `signal-900` | Primary violet ramp. `signal-600` is the default interactive colour; `signal-300` is its dark-mode counterpart. |
| `pulse-400` / `pulse-500` / `pulse-600` / `pulse-700` | Cyan accent. **Reserved for things that are live** — connection status, new-message affordances, the hero's signal rings. Do not use it as a second brand colour. `pulse-600` fails AA for text on a light surface (2.9:1); use `pulse-700` for cyan *text* or a cyan indicator dot in the light theme, and `pulse-400` in the dark one. |

## Semantic surfaces

| Light | Dark | Usage |
|---|---|---|
| `canvas` | `canvas-dark` | Page background |
| `surface` | `surface-dark` | Cards, panels, message bubbles |
| `surface-raised` | `surface-raised-dark` | Hover states, composer, elevated rows |
| `border-subtle` | `border-subtle-dark` | Hairlines, dividers |

## Text

| Light | Dark | Usage |
|---|---|---|
| `ink` | `ink-dark` | Primary text |
| `ink-muted` | `ink-muted-dark` | Secondary text, timestamps, placeholders |

## Status

| Token | Usage |
|---|---|
| `success` | Delivered, connected |
| `warning` | Reconnecting, degraded |
| `danger` | Send failure, destructive actions |

## Dark mode

Class-driven via `next-themes`, declared as
`@custom-variant dark (&:where(.dark, .dark *))`. Write the light value as the
base and the dark value under `dark:`:

```tsx
<div className='bg-surface text-ink dark:bg-surface-dark dark:text-ink-dark' />
```

## Rules

- **Never a hardcoded hex or `rgb()`.** If a colour is needed that no token
  provides, add the token.
- **Colour is never the only signal.** Sent and received message bubbles differ
  by alignment and corner radius as well as fill — a colour-blind user and a
  greyscale screenshot both have to be able to tell them apart.
- `pulse-*` means live. Using it decoratively drains the one place it carries
  meaning.
- Contrast: body text ≥ 4.5:1, large display text ≥ 3:1, in **both** themes.
  `ink-muted` on `surface` is the pair that most often fails — check it.
