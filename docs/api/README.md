# Chat API — Reference

Written for Part 1 of the assignment, **before** any UI was built.

The upstream Swagger at
[frontend-task-chatapp.onrender.com/docs](https://frontend-task-chatapp.onrender.com/docs/)
is deliberately request-only: it lists paths, methods, and request bodies, but
documents **no response bodies and no status codes**. Everything below —
response shapes, status codes, error envelopes, ordering, pagination semantics —
was derived by exercising the live server.

That exercise is scripted, not hand-waved:

```bash
pnpm api:probe          # readable transcript of every call and its response
pnpm api:probe --json   # same run, machine-readable, for diffing later
```

Three companion documents:

| File | What it is |
|---|---|
| [`quirks.md`](./quirks.md) | The 20 inconsistencies found, each with evidence and the workaround shipped |
| [`redesign.md`](./redesign.md) | How this API would be shaped if the routes were mine to name |
| [`openapi.yaml`](./openapi.yaml) | A complete spec — the upstream one, extended with every response shape |

---

## Conventions

**Base URL** — `https://frontend-task-chatapp.onrender.com/api`

**Socket origin** — `https://frontend-task-chatapp.onrender.com` (the server
**root**, *not* the `/api` base). Socket.io serves itself at `<origin>/socket.io/`.
This is the single easiest thing to get wrong; pointing the socket at `/api`
fails without a useful error.

**Auth** — `Authorization: Bearer <jwt>` on every route except `POST /auth/login`.
The token is issued by login, and carries `sub` (the user id), `iat`, and `exp`.
Observed lifetime is **7 days**.

**Identifiers** — every entity is keyed on `_id` (a 24-character Mongo ObjectId
hex string). Not `id`. See [quirk 1](./quirks.md#1-mongo-_id-leaks-through-the-whole-rest-surface).

**Timestamps** — ISO-8601 strings over REST, epoch milliseconds over the socket.
See [quirk 2](./quirks.md#2-the-same-message-has-two-different-shapes-depending-on-transport),
which is the most consequential one in this API.

**Error envelope** — every handled failure returns:

```json
{ "error": { "message": "Validation failed", "code": "VALIDATION_ERROR", "details": [ { "path": "name", "message": "Required" } ] } }
```

`details` is present only on validation errors. `code` is normally a string, but
unhandled driver errors leak a **numeric** MongoDB code instead — so a consumer
must treat it as `string | number`.

Observed codes: `NO_TOKEN`, `INVALID_TOKEN`, `VALIDATION_ERROR`, `NOT_FOUND`,
`FORBIDDEN`, `SERVER_ERROR`, plus raw numerics such as `51091`.

---

## Auth

### `POST /auth/login`

Login and registration in one call. A phone number that has never been seen is
registered; an existing one logs in. No password anywhere in the system.

**Auth:** none.

**Request**

```json
{ "phone": "+15551234567", "name": "Ada Lovelace" }
```

Both fields are required; omitting either yields `400 VALIDATION_ERROR`.

**`200 OK`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "6a888073e5d6aac97523611b",
    "name": "Ada Lovelace",
    "phone": "+15551234567",
    "createdAt": "2026-08-21T16:44:35.181Z"
  }
}
```

**Behaviour worth knowing:** logging in with an existing phone number and a
*different* name **overwrites the stored name**. There is no separate profile
update — login doubles as rename. See
[quirk 14](./quirks.md#14-login-silently-renames-an-existing-account).

| Status | When |
|---|---|
| `200` | Logged in or registered |
| `400` | `VALIDATION_ERROR` — `phone` or `name` missing |

---

### `GET /auth/me`

Returns the user behind the bearer token. Used to validate a persisted session
on boot.

**`200 OK`** — a bare user object, **not** wrapped in `{ user: … }` the way
login wraps it:

```json
{ "_id": "6a888073e5d6aac97523611b", "name": "Ada Lovelace", "phone": "+15551234567", "createdAt": "2026-08-21T16:44:35.181Z" }
```

| Status | When |
|---|---|
| `200` | Valid token |
| `400` | `NO_TOKEN` — header absent. **Should be 401**; see [quirk 5](./quirks.md#5-a-missing-token-is-a-400-an-invalid-one-is-a-401) |
| `401` | `INVALID_TOKEN` — malformed, expired, or wrong signature |

---

## Users

### `GET /users/search`

Search by name or phone, for starting a conversation.

**Query:** `q` (documented as required).

**`200 OK`** — a bare array. Note these results carry **no `createdAt`**, unlike
the user object returned by login:

```json
[
  { "_id": "6a888073e5d6aac97523611b", "name": "Ada Lovelace", "phone": "+15551234567" },
  { "_id": "6a88807fe5d6aac975236161", "name": "Ada Byron",    "phone": "+15559990001" }
]
```

Matching is a case-insensitive substring against both name and phone. **The
current user is included in their own results** — filter client-side, or you
will offer the user a chat with themselves.

Two serious problems here, both worked around in
[`src/lib/api/index.ts`](../../src/lib/api/index.ts):

- **`q` is interpolated into a Mongo `$regex` unescaped.** `?q=%2B1` (a leading
  `+`, i.e. the first character of any E.164 number) returns `500` with
  `Regular expression is invalid: quantifier does not follow a repeatable item`,
  code `51091`. See [quirk 3](./quirks.md#3-searching-by-phone-number-crashes-the-endpoint).
- **Omitting `q` returns every user in the database** rather than the documented
  `400`. See [quirk 4](./quirks.md#4-omitting-the-required-q-dumps-the-entire-user-directory).

| Status | When |
|---|---|
| `200` | Results (possibly `[]`) |
| `400` | `NO_TOKEN` |
| `500` | `q` contains a regex metacharacter |

---

## Conversations

### `GET /conversations`

Every conversation the caller belongs to, most-recently-updated first.

**`200 OK`** — the only endpoint that wraps its payload in `{ data: … }`:

```json
{
  "data": [
    {
      "_id": "6a8880dde5d6aac97523631c",
      "type": "group",
      "lastMessage": {},
      "updatedAt": "2026-08-21T16:46:21.363Z",
      "name": "Wavelength Crew",
      "createdBy": "6a888073e5d6aac97523611b",
      "admins": ["6a888073e5d6aac97523611b"],
      "participants": [
        { "_id": "6a888073e5d6aac97523611b", "name": "Ada Lovelace",  "phone": "+15551234567" },
        { "_id": "6a88807fe5d6aac975236161", "name": "Grace Hopper",  "phone": "+15559990001" }
      ]
    },
    {
      "_id": "6a8880afe5d6aac97523628b",
      "type": "direct",
      "lastMessage": { "text": "see you then", "sender": "6a888073e5d6aac97523611b", "createdAt": "2026-08-21T16:45:40.226Z" },
      "updatedAt": "2026-08-21T16:45:40.461Z",
      "participant": { "_id": "6a88807fe5d6aac975236161", "name": "Grace Hopper", "phone": "+15559990001" }
    }
  ]
}
```

**This is a discriminated union in everything but declaration.** `type` is the
discriminant:

| `type` | Has | Does not have |
|---|---|---|
| `direct` | `participant` (singular, one resolved user) | `name`, `admins`, `createdBy`, `participants` |
| `group` | `participants` (plural array), `name`, `admins`, `createdBy` | `participant` |

Reading `participants` on a direct row gives `undefined` — a crash waiting to
happen. Modelled properly as a TS union in
[`src/types/api.ts`](../../src/types/api.ts).

`lastMessage` is `{}` — **not `null`** — when a conversation has no messages.
See [quirk 7](./quirks.md#7-lastmessage-is-an-empty-object-not-null).

---

### `POST /conversations`

Open a 1-to-1 conversation. Idempotent: calling it twice with the same peer
returns the existing conversation rather than creating a duplicate.

**Request**

```json
{ "userId": "6a88807fe5d6aac975236161" }
```

**`200 OK`** — and this is where it gets awkward. The response is a **stub**
that looks nothing like the same conversation as it appears in `GET /conversations`:

```json
{
  "_id": "6a8880afe5d6aac97523628b",
  "participants": ["6a888073e5d6aac97523611b", "6a88807fe5d6aac975236161"],
  "createdAt": "2026-08-21T16:45:35.293Z"
}
```

No `type`. No `lastMessage`. No `updatedAt`. `participants` is an array of **id
strings** rather than resolved user objects — the opposite of the group endpoint,
which returns them fully populated. A newly created conversation therefore
cannot be rendered into the list from its own response.

Also: `200`, not `201`. And passing **your own id** does not error — it returns
an unrelated existing conversation that happens to contain your id, silently
opening the wrong thread. Both guarded client-side; see
[quirks 8 and 9](./quirks.md#8-post-conversations-returns-a-different-shape-than-the-list-endpoint).

| Status | When |
|---|---|
| `200` | Created or resolved to an existing conversation |
| `400` | `NO_TOKEN`, or `userId` missing |

---

### `GET /conversations/{id}/messages`

Paginated history.

**Path:** `id` — the conversation id.
**Query:** `limit` (default appears to be 50), `before` (message-id cursor).

**`200 OK`**

```json
{
  "messages": [
    { "_id": "6a8880b4e5d6aac9752362a4", "conversation": "6a8880afe5d6aac97523628b", "sender": "6a888073e5d6aac97523611b", "text": "third",  "createdAt": "2026-08-21T16:45:40.226Z" },
    { "_id": "6a8880b2e5d6aac97523629c", "conversation": "6a8880afe5d6aac97523628b", "sender": "6a888073e5d6aac97523611b", "text": "second", "createdAt": "2026-08-21T16:45:38.968Z" },
    { "_id": "6a8880b1e5d6aac975236297", "conversation": "6a8880afe5d6aac97523628b", "sender": "6a888073e5d6aac97523611b", "text": "first",  "createdAt": "2026-08-21T16:45:37.548Z" }
  ],
  "hasMore": false
}
```

Two things to internalise:

1. **Order is newest-first (descending).** A chat renders oldest-first, so every
   page must be reversed.
2. **`before` is inclusive.** `?before=X` returns X again as the first element.
   Paginate naively and you duplicate one message per page — visible as a
   repeated bubble and a duplicate React key. See
   [quirk 11](./quirks.md#11-the-before-cursor-is-inclusive).

`sender` and `conversation` are raw id strings; there is no populated variant,
so sender identity must be resolved against the conversation's participant list.

| Status | When |
|---|---|
| `200` | History page |
| `404` | `NOT_FOUND` — conversation does not exist, or the caller is not a member (correctly indistinguishable) |
| `500` | `id` is not a valid ObjectId — leaks a raw Mongoose `CastError`. Should be `400`; see [quirk 12](./quirks.md#12-a-malformed-id-is-a-500-with-a-leaked-driver-error) |

---

### `POST /messages`

Send to a direct or group conversation. Delivery to other participants happens
over the socket; see [Real-time](#real-time-socketio).

**Request**

```json
{ "conversationId": "6a8880afe5d6aac97523628b", "text": "Hello!" }
```

**`200 OK`**

```json
{
  "_id": "6a8880b1e5d6aac975236297",
  "conversation": "6a8880afe5d6aac97523628b",
  "sender": "6a888073e5d6aac97523611b",
  "text": "Hello!",
  "createdAt": "2026-08-21T16:45:37.548Z"
}
```

**`""` and `"   "` are both accepted with a `200`.** There is no server-side
text validation at all — which sits oddly beside group creation, where
validation is strict. The assignment requires empty messages to be unsendable,
so the rule is enforced entirely on the client. See
[quirk 10](./quirks.md#10-empty-messages-are-accepted-by-both-transports).

---

## Groups

A group is a conversation with **three or more** members, a name, and one or
more admins. The creator starts as the sole admin. Only admins may add or remove
members, promote others, or rename; any member may leave by removing themselves.

All five endpoints below return the **full group object**, consistently:

```json
{
  "_id": "6a8880dde5d6aac97523631c",
  "type": "group",
  "name": "Wavelength Crew",
  "createdBy": "6a888073e5d6aac97523611b",
  "admins": ["6a888073e5d6aac97523611b"],
  "participants": [
    { "_id": "6a888073e5d6aac97523611b", "name": "Ada Lovelace", "phone": "+15551234567" }
  ],
  "createdAt": "2026-08-21T16:46:21.363Z",
  "updatedAt": "2026-08-21T16:46:21.363Z"
}
```

Note the contrast with `POST /conversations`: here `participants` **is**
populated, and creation correctly answers `201`.

### `POST /conversations/group`

```json
{ "name": "Project Team", "participantIds": ["<id>", "<id>"] }
```

`201 Created`. Validation is genuinely strict:

| Status | When |
|---|---|
| `201` | Created; caller becomes admin |
| `400` | `name` blank → `"name is required"` |
| `400` | fewer than 3 total members → `"a group needs at least 3 members"` |

Since the creator counts, `participantIds` needs **at least two** entries.

### `POST /conversations/{id}/participants`

```json
{ "userIds": ["<id>"] }
```

`200`. Admins only — `403 FORBIDDEN` otherwise.

### `DELETE /conversations/{id}/participants/{userId}`

`200`. Admins only, **except** that passing your own id is how you leave.

### `POST /conversations/{id}/admins`

```json
{ "userId": "<id>" }
```

`200`. Admins only. The target must already be a member.

### `PATCH /conversations/{id}`

```json
{ "name": "Renamed Team" }
```

`200`. Admins only — verified: a non-admin gets
`403 { "error": { "message": "Only admins can rename the group", "code": "FORBIDDEN" } }`.

---

## Real-time (Socket.io)

Not part of the OpenAPI document. Connect to the **origin root**:

```ts
import { io } from 'socket.io-client';

const socket = io('https://frontend-task-chatapp.onrender.com', {
	auth: { token },
	transports: ['websocket'],
});
```

An absent or invalid token is rejected at handshake with a `connect_error`
carrying `"Invalid token"` — there is no dedicated auth-failure event.

### `message:send` — client → server

```ts
socket.emit('message:send', { conversationId, text }, (ack) => {
	// ack === { ok: true }
});
```

Functionally equivalent to `POST /messages`. The ack is `{ ok: true }` and
carries **no message body**, so the sender does not learn the server-assigned id
this way. Empty text is accepted here too.

### `message:new` — server → client

```json
{
  "id": "6a888165e5d6aac9752364d6",
  "conversation": "6a8880afe5d6aac97523628b",
  "sender": "6a88807fe5d6aac975236161",
  "text": "socket hello",
  "createdAt": 1787330917212
}
```

**Two things here define the whole client architecture:**

1. **`id`, not `_id`. `createdAt` as an epoch number, not an ISO string.** The
   same logical message has a different shape depending on which transport
   delivered it. Merge the two naively and half your list has `undefined` keys
   and `Invalid Date` timestamps.
2. **The sender does not receive their own echo.** Only *other* participants get
   `message:new`. So the socket cannot be the source of truth for your own
   messages — a local echo is mandatory, not an optimisation.

Both are handled once, in
[`src/lib/api/normalize.ts`](../../src/lib/api/normalize.ts), and pinned by
[`tests/lib/api/normalize.test.ts`](../../tests/lib/api/normalize.test.ts).

### `conversation:updated` — server → client

Fired when a group the caller belongs to is created, renamed, or has its
membership or admin list changed. Payload is the conversation; the reliable
response is to refetch the conversation list.

---

## System

### `GET /health`

```json
{ "status": "ok" }
```

**Lives at the origin root — `https://…onrender.com/health` — not under `/api`.**
The spec declares a single server of `{baseUrl}/api`, which places this route at
`/api/health`, where it returns `404 NOT_FOUND`. See
[quirk 6](./quirks.md#6-health-is-not-where-the-spec-says-it-is).

The demo server is on a free tier and cold-starts after inactivity; the first
request of a session can take 30–60 seconds. This endpoint is the cheapest way
to warm it.
