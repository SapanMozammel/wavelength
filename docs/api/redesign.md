# If the routes were mine to name

The assignment invites renaming endpoints and adding or removing them. This is
what the same API would look like designed from scratch, and — more usefully —
which of these changes are worth making versus which are just taste.

**Nothing here is implemented.** The client in `src/lib/api/` speaks to the live
server exactly as it is. This document is the design argument; `quirks.md` is
the list of things that actually cost the client something.

---

## The one change that matters

**Return the same entity shape from every transport.**

Everything else on this page is ergonomics. This one is a correctness hazard: a
message arriving over REST and the same message arriving over the socket are
different objects (`_id`/ISO vs `id`/epoch — quirk 2), and the message list is
exactly where those two streams meet. Every consumer must write the same
normalizer, and any consumer that forgets ships a list with broken keys and
`Invalid Date` timestamps that only appears once a second person is talking.

Pick one shape. `id`, and ISO-8601 everywhere:

```json
{ "id": "…", "conversationId": "…", "senderId": "…", "text": "…", "createdAt": "2026-08-21T16:48:37.212Z" }
```

Note also `conversation` → `conversationId` and `sender` → `senderId`: when a
field holds an id, the name should say so, which leaves room for `sender` to
mean the populated user later without a breaking change.

---

## Routes

| Current | Proposed | Why |
|---|---|---|
| `POST /auth/login` | `POST /sessions` | It creates a session. Login-or-register is then plainly the resource semantics, not a special case. |
| `GET /auth/me` | `GET /me` | One less segment; `/me` is idiomatic and unambiguous. |
| `GET /users/search?q=` | `GET /users?query=` | Search is a filter on the users collection, not a sub-resource. `query` reads better than `q` in a URL a human will debug. |
| `POST /conversations` | `POST /conversations` with a body discriminant | See below. |
| `POST /conversations/group` | *(merged)* | Two endpoints for one resource, with divergent response shapes, is the root of quirk 8. |
| `POST /messages` | `POST /conversations/{id}/messages` | Messages belong to a conversation. It already reads that way for `GET`; the asymmetry between the read and write paths serves nothing. |
| `POST /conversations/{id}/admins` | `PUT /conversations/{id}/members/{userId}/role` | Promotion is a property of an existing membership, not a new collection entry. `PUT` also makes demotion expressible, which the current shape cannot do at all. |
| `POST /conversations/{id}/participants` | `POST /conversations/{id}/members` | "Participants" and "members" are used interchangeably in the current API. Pick one — "members" pairs naturally with "admins". |
| `DELETE …/participants/{userId}` | `DELETE …/members/{userId}` | Same. Self-removal as "leave" is fine; it needs a line of documentation, not a second route. |
| `GET /health` under `/api` | `GET /health` at the root | It already *is* at the root. Fix the spec, not the server — the spec's single `{baseUrl}/api` server is what makes it look wrong. |

### One creation endpoint, not two

```http
POST /conversations
{ "type": "direct", "userId": "…" }
{ "type": "group", "name": "Project Team", "memberIds": ["…", "…"] }
```

`201` either way, returning the same fully-populated conversation shape the list
endpoint uses. That single change kills quirk 8 (mismatched creation shapes),
quirk 16 (200-vs-201 inconsistency), and the extra refetch a client currently
needs after starting a direct chat.

---

## Response envelope

Pick one and apply it everywhere. Currently there are four (quirk 17).

The lightest option that still leaves room to grow:

```json
{ "data": <payload>, "meta": { … } }
```

`meta` carries pagination where relevant and is absent otherwise. Collections
get their cursor in `meta` rather than as a sibling of the array:

```json
{ "data": [ … ], "meta": { "hasMore": true, "nextCursor": "6a8880b1…" } }
```

Which brings up the cursor itself.

---

## Pagination

Two fixes, one of them load-bearing:

1. **Make `before` exclusive.** An inclusive cursor (quirk 11) means every
   correct client writes the same dedupe filter, and every incorrect one
   duplicates a message per page. Exclusive is what a cursor means.
2. **Return the next cursor rather than making the client derive it.** The
   client currently has to reach into the last element of a
   descending-ordered array to find the id to send next. `meta.nextCursor`
   states it, and — more importantly — lets the server change its cursor scheme
   later without breaking every client.

Ordering is worth being explicit about too. Newest-first is the right *storage*
order for a cursor that walks backwards through history, so I would keep it and
document it loudly rather than flip it. It is only surprising because it is
undocumented.

---

## Errors

The envelope is already good — `{ error: { message, code, details } }` with
field-level `details` is more than many APIs offer. Three fixes:

- **Never leak driver text.** The Mongoose `CastError` in quirk 12 discloses the
  ODM, the model, and the schema path. A malformed id should be
  `400 { code: "INVALID_ID" }`.
- **`code` should always be a string.** Numeric MongoDB codes (quirk 19) escape
  from the same place the driver text does; fixing one fixes the other.
- **Auth failures should all be `401`.** Missing and invalid tokens are the same
  class of failure (quirk 5).

---

## Validation

Message text needs the validation that group creation already has (quirk 10):

```json
{ "error": { "message": "Validation failed", "code": "VALIDATION_ERROR",
  "details": [ { "path": "text", "message": "must not be empty" } ] } }
```

Reject `""` and whitespace-only. A client should still validate — an empty send
button ought to be disabled, not merely rejected — but "the client will handle
it" is not a validation strategy when the client is untrusted.

Similarly, `POST /conversations` with your own id should be `400`, not a silent
wrong-thread (quirk 9).

---

## Two endpoints worth adding

Both are things this UI wants and cannot express:

**`POST /conversations/{id}/read`** — mark read up to a message id, with an
`unreadCount` on each conversation-list row. Without it, unread state is
per-device and lost on refresh, and the conversation list cannot show the one
piece of information users actually scan it for.

**`typing:start` / `typing:stop` socket events** — a typing indicator is
inferable client-side, but only for conversations you already have open. Doing
it properly needs the server to fan out.

I would **not** add read receipts per-recipient, presence, or reactions. Each is
a meaningful increase in server state for something this feature set does not
need yet.

---

## What I would leave exactly as it is

- **Phone-number identity with no password.** Login-or-register in one call is
  the right primitive for this product. It is also the most opinionated thing
  about the API and it is opinionated in the right direction.
- **Idempotent direct-conversation creation.** Returning the existing
  conversation rather than erroring is correct and saves the client a
  lookup-then-create dance.
- **404 for a valid-but-foreign conversation id.** Refusing to distinguish
  "absent" from "forbidden" is the right call and it is already implemented that
  way.
- **Admin authorization.** Correct, clearly-messaged `403`s. No changes.
- **`hasMore` as a boolean rather than a total count.** A count on an unbounded
  message history is an expensive query for something no interface needs.
