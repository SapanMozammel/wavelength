# Architecture — Routing & i18n

## Route Structure

Document your project's route structure here:

| URL | File | Type | Component |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Home | Server |

## Layout Hierarchy

Document your layout hierarchy:

```
src/app/layout.tsx              # Root layout
src/app/[locale]/layout.tsx     # Locale layout (if using i18n)
src/app/[locale]/page.tsx       # Page
```

## i18n (if applicable)

If using next-intl or similar, document:

- **Supported locales** and default locale
- **Prefix strategy** (`always`, `as-needed`, `never`)
- **Translation file structure** and namespaces
- **Locale detection priority** (URL → cookie → header → fallback)
- **Graceful fallback** for missing translations

## Navigation Imports

Document the correct navigation import for internal vs external links:

```tsx
// ✓ internal routes (locale-aware if using i18n)
import { Link } from '@/i18n/navigation'

// ✓ external links (https://, mailto:, tel:)
import NextLink from 'next/link'
```

## RTL Support (if applicable)

If supporting RTL locales, document:
- Which locales are RTL
- How `dir` is set on `<html>`
- Tailwind `rtl:` variant usage

## Static Generation

If using `generateStaticParams()`, document which routes pre-render which params.

---

## See also

### External reference

project rules in this file are authoritative; external references are framework-level guidance — load when project rules don't cover the case.

- [`external/nextjs/nextjs-app-router-patterns/`](../external/nextjs/nextjs-app-router-patterns/) — advanced patterns (parallel routes, intercepting routes, advanced data fetching)
