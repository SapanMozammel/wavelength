# Architecture — Component Patterns

## Server vs Client Components

| | Server (default) | Client |
|---|---|---|
| Directive | none | `'use client'` at top |
| Hooks / state | ✗ | ✓ |
| `memo()` | ✗ | ✓ + set `displayName` |
| Event handlers | ✗ | ✓ |
| When to use | Purely presentational | Needs interactivity, hooks, or events |

**Rules:**
- Server Component by default — add `'use client'` only when hooks/events are required
- Server CAN import Client. Client CANNOT import Server.
- `memo()` + `ComponentName.displayName = 'ComponentName'` mandatory on every Client Component

## Component Templates

### Server Component
```tsx
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

const ComponentName = ({ className }: Props) => {
  return (
    <div className={cn('base-classes', className)}>
      {/* content */}
    </div>
  )
}

export default ComponentName
```

### Client Component
```tsx
'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

const ComponentName = memo(({ className }: Props) => {
  return (
    <div className={cn('base-classes', className)}>
      {/* content */}
    </div>
  )
})

ComponentName.displayName = 'ComponentName'

export default ComponentName
```

## cn() Utility

Always use `cn()` from `@/lib/utils` for all className composition — never string-concatenate:

```tsx
import { cn } from '@/lib/utils'

// ✓ correct
cn('base-class', isActive && 'active-class', className)

// ✗ wrong
`base-class ${isActive ? 'active-class' : ''}`
```

## Common UI Patterns

### Border
```
border border-solid border-secondary-200/50 dark:border-secondary-700/50
```

### Shadow
```
shadow-lg shadow-black/5 dark:shadow-white/5
```

### Hover (card/panel)
```
hover:-translate-y-1 hover:shadow-lg transition-all duration-300
```

### Active / Selected State
```
bg-primary/10 text-primary dark:bg-success/10 dark:text-success
```

### Focus State (form inputs)
```
focus:border-primary dark:focus:border-success focus:outline-none
```

### Error State
```
border-danger text-danger
```

### Disabled State
```
opacity-50 cursor-not-allowed
```

## Animation Library Selection

Choose the right animation tool based on interaction type and duration. Define your project's animation library matrix here.

| Interaction | Duration | Library |
|---|---|---|
| Hover | 150ms | CSS transition |
| Component entrance | 300–500ms | (your animation library) |
| Scroll sequences | variable | (your scroll animation library) |

Document any custom CSS keyframe classes (`@keyframes`) your project registers — this helps reviewers know what's available vs. what needs to be added.

---

## File Organization

Define your project's file organization here. A typical Next.js App Router layout:

| What | Where |
|---|---|
| Page sections | `src/components/layout/{section-name}/index.tsx` |
| Sub-components | `src/components/layout/{section-name}/{sub-component}.tsx` |
| Shared layout pieces | `src/components/layout/common/` |
| Base UI components | `src/components/ui/` |
| Custom icons | `src/components/icons/` |
| Static content | `src/data/content/` |
| App config | `src/data/config/` |
| Type definitions | `src/types/` |
| Utilities | `src/lib/utils/` |
| Styles | `src/styles/` |

**Filename casing.** Every file and folder name is **kebab-case**. React component identifiers (the exported symbol) stay PascalCase. `index.tsx` is the entry file inside any folder unit.

---

## Pre-write Checklist

Before writing or modifying any component:

- [ ] `cn()` from `@/lib/utils` for all classNames — never string-concatenate
- [ ] Design system tokens only — no hardcoded colors or hex values
- [ ] `dark:` variant on every color class
- [ ] Mobile-first breakpoints (`sm:`, `md:`, `lg:`)
- [ ] Server Component by default — `'use client'` only when hooks/events required
- [ ] If Client: `memo()` + `ComponentName.displayName = 'ComponentName'`
- [ ] Internal navigation: use project's locale-aware Link helper (per `architecture/routing.md`). External links: use `NextLink` from `next/link`
- [ ] All imports use `@/` alias
- [ ] `type Props = { ... }` — never `interface`
- [ ] No `any` types
- [ ] `export default ComponentName` at the bottom — never both `export const` and `export default` for the same component

---

## See also

For e2e enforcement of server/client boundaries (reduced-motion default, RSC routes don't await client JS for first paint), see [`../workflow/e2e.md`](../workflow/e2e.md).

### External reference

project rules in this file are authoritative; external references are framework-level guidance — load when project rules don't cover the case.

- [`workflow/no-use-effect.md`](../workflow/no-use-effect.md) — strict no-direct-`useEffect` rule (ALWAYS ACTIVE; project-canonical, the 6-rule guide for derived state, event handlers, `useMemo`, `useSyncExternalStore`, key-based reset, `useMountEffect`)
- [`external/react/react-best-practices/`](../external/react/react-best-practices/) — TSX quality checklist (component structure, hooks, a11y, perf, TS)
- [`external/nextjs/nextjs-app-router-patterns/`](../external/nextjs/nextjs-app-router-patterns/) — advanced patterns (Server Components, streaming, parallel routes)
