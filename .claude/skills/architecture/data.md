# Architecture — Data & Types

## Data Sources

Define your project's data sources here. Common patterns:

- **Static content** — files imported directly by Server Components (no fetch needed)
- **API data** — fetched from REST or GraphQL endpoints
- **CMS data** — pulled from a headless CMS at build or request time

Document each data directory, what it exports, and who consumes it.

## Type Definitions

TypeScript type definitions — one file per domain. Conventions:
- Single-consumer prop types are colocated with their component (kept inline as `type Props = { … }`)
- Types shared across multiple consumers, or that describe content/data shapes, live in `src/types/`

Document each type file and the types it exports.

## Utility Functions (`src/lib/utils/`)

Document pure utility functions:

| File | Exports |
|---|---|
| `index.ts` | `cn()` — clsx + tailwind-merge |

## Data Flow

```
src/data/ (static files)
  ↓ import
Server Component (reads data, no fetch needed)
  ↓ props
Child Components (receive data as typed props)
```

For API/CMS data, document the fetch strategy (RSC fetch, SWR, React Query, Apollo, etc.).

## Rules

- Use `type` (never `interface`) for all type definitions
- No `any` types — TypeScript strict mode enforced
- New data files go in `src/data/content/` (changing content) or `src/data/config/` (app config)
- New type files go in `src/types/` only when shared across multiple consumers
- One file per domain, named after the domain

---

## See also

For GraphQL data fetching conventions (if applicable), see [`data-graphql.md`](./data-graphql.md).

### External reference

project rules in this file are authoritative; external references are framework-level guidance — load when project rules don't cover the case.

- [`external/typescript/typescript-expert/`](../external/typescript/typescript-expert/) — deep TS problem-solving for complex data type modeling
