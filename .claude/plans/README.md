# Plans — Wavelength

Eleven PRDs, sequenced. Each is executable with `/implement <plan-name>` and
sized to finish in one run.

The assignment brief weights **the chat panel — message list, sending, real-time**
above everything else. Plans 05–07 are that panel, and they are deliberately
split into three so each gets a full pass rather than a shared one.

---

## Sequence

| # | Plan | What it delivers | Blocks |
|---|---|---|---|
| 01 | [`01-ui-foundation`](01-ui-foundation/prd.md) | Deps, shadcn/Radix primitives, app shell, `useMountEffect` | everything |
| 02 | [`02-chat-state`](02-chat-state/prd.md) | `chat-slice` + the merge reducer + thunks | 04–09 |
| 03 | [`03-auth-session`](03-auth-session/prd.md) | `/login`, session restore, route guard | 04+ |
| 04 | [`04-conversation-directory`](04-conversation-directory/prd.md) | Sidebar, search, start direct, create group | 05+ |
| 05 | [`05-message-list`](05-message-list/prd.md) | ★ History, bubbles, grouping, day separators, pagination | 06, 07 |
| 06 | [`06-composer-and-sending`](06-composer-and-sending/prd.md) | ★ Composer, empty-guard, optimistic send, retry | 07 |
| 07 | [`07-realtime-and-autoscroll`](07-realtime-and-autoscroll/prd.md) | ★ Socket wiring, live arrival, auto-scroll discipline | — |
| 08 | [`08-group-management`](08-group-management/prd.md) | Add / remove / promote / rename / leave | — |
| 09 | [`09-cold-start-narration`](09-cold-start-narration/prd.md) | **Part 1 bonus** — the 30–60s wake-up, narrated | — |
| 10 | [`10-landing-page`](10-landing-page/prd.md) | **Part 2** + bonus: live login field in the hero | — |
| 11 | [`11-delivery`](11-delivery/prd.md) | Part 3 write-up, Vercel deploy, e2e + a11y gates | — |

## Dependency graph

```
01 ──┬── 02 ──┬── 04 ──┬── 05 ── 06 ── 07
     │        │        │
     └── 03 ──┘        └── 08
                       └── 09
     └── 10  (independent after 01; hero field needs 03's login action)
                                            11  (last, needs everything)
```

## The cut line

Deadline is **today, Aug 22 2026, at 4:00 PM**. If time runs short, cut from the
bottom:

- **Never cut:** 01, 02, 03, 04, 05, 06, 07, 10, 11 — 05–07 are the graded core,
  10 is a required deliverable, 11 contains both required demo links.
- **Cut first:** 08 group *management* (creation stays — it is required by the
  brief; admin flows are not). Then 09.
- **Never cut 11.** A submission without working demo links "will not be
  reviewed" per the brief. Deploy early and redeploy, rather than deploying last.

## Conventions every plan inherits

- `CLAUDE.md` is authoritative; `.claude/skills/{architecture,design-system,workflow}/`
  next; external skills last.
- **No direct `useEffect` in components** — `workflow/no-use-effect.md` is always
  active. `useEffect` may appear only inside a reusable hook in `src/hooks/`.
- Every wire shape is normalized once in `src/lib/api/normalize.ts`. Nothing
  outside `src/lib/api/` reads `_id` or imports `src/types/api.ts`.
- Markers are `[⬜]` / `[🔄]` / `[✅]`, never `[x]`. Completed steps are never
  overwritten.
