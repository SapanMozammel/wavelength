# Design System — Typography

Loaded via `next/font/google` in [`src/app/layout.tsx`](../../../src/app/layout.tsx)
and exposed as CSS variables consumed by `@theme`.

## Registry

| Class | Font | Use for |
|---|---|---|
| `font-display` | Outfit | Headings, hero copy, section titles. Tighten tracking at large sizes. |
| `font-sans` | Inter | Body copy, UI labels, message text. The default — `body` sets it. |
| `font-mono` | System mono stack | Anything representing **data**: timestamps, phone numbers, ids, code. |

The sans/mono contrast is load-bearing: it is the same distinction used inside
the chat panel (message text vs timestamp), so the landing page and the product
read as one system rather than two.

## Scale

Prefer Tailwind's scale (`text-sm` … `text-6xl`). For hero and display type use
`clamp()` so sizing is fluid rather than stepped at breakpoints:

```tsx
<h1 className='font-display text-4xl leading-tight font-semibold text-balance sm:text-6xl'>
```

## Rules

- `text-balance` on headings, `text-pretty` on paragraphs — cheap, and it fixes
  the ragged last line that makes a landing page look unfinished.
- Line height inversely tracks size: `leading-tight` for display, `leading-relaxed`
  for body.
- Message text is `text-[0.9375rem]` — slightly under `text-base`. Chat reads
  denser than prose.
- Timestamps are `font-mono text-xs text-ink-muted`, always paired with a
  `<time dateTime>` carrying the ISO value.
- Weights: 400 body, 500 UI labels, 600 headings. Never 700+ for body text.
