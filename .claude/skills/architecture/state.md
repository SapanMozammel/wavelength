# Architecture — State Management

## State Store

Document your project's state management solution (Redux Toolkit, Zustand, Jotai, Context, etc.).

### Slices / Atoms / Stores

Document each piece of state, what it owns, and where it lives:

| State | Owner | Location |
|---|---|---|
| UI state (modals, drawers) | Store | e.g. `src/store/slices/ui-slice.ts` |
| Locale + RTL flag | Store | e.g. `src/store/slices/locale-slice.ts` |
| Color theme (light/dark) | Theme provider | NOT in the store |
| Form field state | local `useState` | Inside component |
| Animation state | local `useState` or animation library | Inside component |

### Typed Hooks (always use these — never raw store hooks)

```tsx
import { useAppDispatch, useAppSelector } from '@/store/hooks'
```

**Never** use raw `useDispatch()` or `useSelector()` directly.

### State Ownership Rules

Clearly document what belongs where to prevent state misplacement:

- **Global UI state** (modals, drawers, notifications) → store
- **Navigation state** (current route, locale) → store or URL params
- **Color theme** → dedicated theme provider (e.g. `next-themes`)
- **Form field state** → local `useState`
- **Animation state** → local `useState` or animation library

---

## Theme

If using a theme provider (e.g. `next-themes`):

```tsx
// Provider configured in src/providers/index.tsx
<ThemeProvider defaultTheme="system" attribute="class">
```

- Access theme: `const { theme, setTheme } = useTheme()` from `next-themes`
- Do not store theme in the state store

---

## Custom Hooks (`src/hooks/`)

Document project-specific hooks here:

| Hook | Purpose |
|---|---|
| `useContactForm` | Form state, validation, and submission |

---

## See also

### External reference

project rules in this file are authoritative; external references are framework-level guidance — load when project rules don't cover the case.

- [`external/react/react-best-practices/`](../external/react/react-best-practices/) — hook usage, state colocation, derived-state patterns
