# PRD — Chat Experience (Part 1) — SUPERSEDED

**Status:** `[⬜]` Superseded on 2026-08-22. No step in this PRD was ever started,
so no completed history is lost.

This plan has been **split into seven executable PRDs**, so each fits a single
`/implement` run and the graded core gets three dedicated passes instead of
sharing one:

| Was | Now |
|---|---|
| Step 1 — chat state container | [`02-chat-state`](../02-chat-state/prd.md) |
| Steps 2–3 — login, session restore | [`03-auth-session`](../03-auth-session/prd.md) |
| Step 4 — conversation list, search, groups | [`04-conversation-directory`](../04-conversation-directory/prd.md) |
| Step 5 — message list ★ | [`05-message-list`](../05-message-list/prd.md) |
| Step 6 — composer + sending ★ | [`06-composer-and-sending`](../06-composer-and-sending/prd.md) |
| Steps 7–8 — real-time ★, auto-scroll | [`07-realtime-and-autoscroll`](../07-realtime-and-autoscroll/prd.md) |
| Step 9 — group management | [`08-group-management`](../08-group-management/prd.md) |
| Step 10 — states and quality pass | [`11-delivery`](../11-delivery/prd.md) |
| Bonus (option 1, chosen) | [`09-cold-start-narration`](../09-cold-start-narration/prd.md) |

Primitives and dependencies the above all depend on were pulled forward into
[`01-ui-foundation`](../01-ui-foundation/prd.md).

**Bonus decision:** of the three candidates this PRD ranked, **cold-start
narration** was chosen and is planned in full. The self-chat guard and the
failed-send retry still ship, but as ordinary correctness inside plans 04 and 06
rather than as headline bonuses — two half-built bonuses read worse than one
finished one.

**Out of scope, unchanged:** read receipts, presence, typing indicators, file
upload, message edit/delete, push notifications. The API supports none of them,
and inventing client-only versions is worse than their absence.

Start at [`.claude/plans/README.md`](../README.md).
