# API Quirks

Twenty inconsistencies found while exercising the live server, in rough order of
how much each one costs a client that does not know about it. Every entry has
the request that demonstrates it, what came back, and what this project does
about it.

Reproduce the whole list with `pnpm api:probe`.

> Base URL throughout: `https://frontend-task-chatapp.onrender.com/api`
> Origin: `https://frontend-task-chatapp.onrender.com`

---

## Shape and consistency

### 1. Mongo `_id` leaks through the whole REST surface

Every entity is keyed on `_id`, the raw MongoDB ObjectId field, rather than a
transport-level `id`. It is a small thing that touches every type in the app.

**Handled:** renamed to `id` once, in `normalizeUser` / `normalizeRestMessage` /
`normalizeConversation`. Nothing outside `src/lib/api/` sees `_id`.

---

### 2. The same message has two different shapes depending on transport

The highest-impact finding in this API.

REST — `POST /messages` and `GET /conversations/:id/messages`:

```json
{ "_id": "6a888165…", "conversation": "6a8880af…", "sender": "6a88807f…", "text": "hi", "createdAt": "2026-08-21T16:48:37.212Z" }
```

Socket — `message:new`:

```json
{ "id": "6a888165…", "conversation": "6a8880af…", "sender": "6a88807f…", "text": "hi", "createdAt": 1787330917212 }
```

`_id` vs `id`. ISO-8601 string vs epoch milliseconds. A message list is
precisely the place where these two streams get merged, so a client that passes
them through unmodified ends up with `key={undefined}` on every live message and
`Invalid Date` on every timestamp — and both failures appear only once a *second
user* is talking to you, which is exactly the case that is easiest to miss in
solo testing.

**Handled:** `normalizeRestMessage` and `normalizeSocketMessage` both produce
the same `Message` domain type — `id` plus epoch-ms `createdAt`. A test asserts
the two are byte-for-byte equal for the same logical message, so the invariant
cannot rot.

---

### 3. Searching by phone number crashes the endpoint

```
GET /users/search?q=%2B15551234567     →  500
{"error":{"message":"Regular expression is invalid: quantifier does not follow a repeatable item","code":51091}}
```

`q` is interpolated into a Mongo `$regex` **without escaping**. A leading `+` —
the first character of every E.164 phone number — is a regex quantifier with
nothing to repeat, so the driver throws and the error escapes as a 500.

The assignment asks for search "by a number or name", so this is directly on the
critical path. It is also a mild ReDoS surface: `?q=(a+)+$` is accepted as a
pattern.

**Handled:** `sanitizeSearchTerm()` strips `. * + ? ^ $ { } ( ) | [ ] \` before
the term is sent. `+15551234567` becomes `15551234567`, which still substring-
matches the stored number. Pinned by `tests/lib/api/sanitize.test.ts`.

---

### 4. Omitting the required `q` dumps the entire user directory

`q` is `required: true` in the spec. Omitting it does not produce a `400` — it
returns **every registered user**, names and phone numbers included. On a shared
demo server that is every other candidate's test data.

**Handled:** a blank query short-circuits to `[]` client-side; the request is
never sent. A search panel should also never render results for an empty box,
so this costs nothing.

---

### 5. A missing token is a 400, an invalid one is a 401

```
GET /auth/me  (no header)        →  400  {"code":"NO_TOKEN"}
GET /auth/me  (bad token)        →  401  {"code":"INVALID_TOKEN"}
```

Both are authentication failures and both should be `401`. A client that keys
"session expired, log out" off the status code alone will miss the first case
and instead surface it as a validation error.

**Handled:** `classify()` in `src/lib/api/errors.ts` keys on the payload `code`
before the status, so `NO_TOKEN` and `INVALID_TOKEN` both map to
`kind: 'unauthorized'`.

---

### 6. `/health` is not where the spec says it is

The spec declares one server, `{baseUrl}/api`, which places health at
`/api/health`. That returns `404 NOT_FOUND`. The route actually lives at the
origin root, `/health`, and answers `{"status":"ok"}`.

The same root/`/api` split applies to Socket.io, which serves itself at
`<origin>/socket.io/`. Pointing the socket at the REST base is the most common
way to get a connection that never establishes and never says why.

**Handled:** two separate env vars — `NEXT_PUBLIC_API_BASE_URL` (with `/api`)
and `NEXT_PUBLIC_SOCKET_URL` (without) — with the reason written into
`.env.example` so nobody "tidies" them into one.

---

### 7. `lastMessage` is an empty object, not `null`

A conversation with no messages returns `"lastMessage": {}`. Reading
`lastMessage.text` yields `undefined`, which renders as an empty preview row
rather than an "empty" state — the row looks broken rather than new.

**Handled:** `normalizeLastMessage` returns `Message | null` after an `'text' in
wire` check.

---

### 8. `POST /conversations` returns a different shape than the list endpoint

Creating a direct conversation returns:

```json
{ "_id": "6a8880af…", "participants": ["6a888073…", "6a88807f…"], "createdAt": "2026-08-21T16:45:35.293Z" }
```

The *same conversation* in `GET /conversations`:

```json
{ "_id": "6a8880af…", "type": "direct", "lastMessage": {}, "updatedAt": "…", "participant": { "_id": "…", "name": "…", "phone": "…" } }
```

No `type`. No `updatedAt`. `participants` (plural, id strings) instead of
`participant` (singular, resolved object). The newly created conversation cannot
be rendered into the list from its own response — the obvious fix is a full
refetch, which costs a round trip and makes the new chat appear a beat late.

Note that `POST /conversations/group` does **not** have this problem: it returns
a fully populated group. The inconsistency is between the two creation endpoints.

**Handled:** `normalizeCreatedDirectConversation(wire, peer)` folds in the peer
`User` the caller already had in hand from search, reconstituting a complete
`DirectConversation` with no extra request.

---

### 9. Starting a conversation with yourself opens someone else's

```
POST /conversations  { "userId": "<your own id>" }   →  200
```

It does not create a self-chat and it does not error. It returns an **unrelated
existing conversation** that merely contains your id — in testing, the A↔B
conversation. A user who finds themselves in search results and taps their own
name is silently dropped into a stranger's thread.

**Handled:** `startDirectConversation` rejects `peer.id === currentUserId`
before the request. The current user is also filtered out of search results.

---

### 10. Empty messages are accepted by both transports

```
POST /messages  { "text": "" }      →  200, message stored with text ""
POST /messages  { "text": "   " }   →  200, message stored with text "   "
socket message:send  { "text": "" } →  ack { ok: true }
```

No server-side validation on message text at all. The assignment requires that
empty messages not be sendable, so the entire rule is the client's job.

The contrast with group creation is stark — that endpoint rejects a blank name
*and* enforces a minimum member count. Validation exists in this API; it just
was not applied to the one field users type into most.

**Handled:** enforced twice — the composer disables its send control on an empty
trimmed value, and `sendMessage()` throws before issuing the request, so no code
path can reach the server with blank text.

---

## Pagination

### 11. The `before` cursor is inclusive

```
GET …/messages?limit=1              → [m3]
GET …/messages?limit=5&before=m3    → [m3, m2, m1]     ← m3 again
```

The cursor message is returned as the first element of the next page. Infinite
scroll built on this duplicates one message per page load — a repeated bubble
and a duplicate React key at every page boundary.

**Handled:** `normalizeMessagePage(wire, cursor)` filters the cursor id out of
the page whenever one was supplied. Pinned by a test.

---

### 12. A malformed id is a 500 with a leaked driver error

```
GET /conversations/not-a-real-id/messages   →  500
{"error":{"message":"Cast to ObjectId failed for value \"not-a-real-id\" (type string) at path \"_id\" for model \"Conversation\"","code":"SERVER_ERROR"}}
```

A client-supplied malformed id is a `400`, not a `500`. The raw Mongoose message
also discloses the ODM, the model name, and the schema path.

A valid-but-foreign id, by contrast, is handled correctly: `404 NOT_FOUND`, with
no distinction between "does not exist" and "not yours" — which is the right
call.

**Handled:** `classify()` maps a 500 whose message starts with
`Cast to ObjectId failed` to `kind: 'not-found'`, so a bad id from a stale link
shows "conversation not found" rather than "the server had a problem". Raw
driver text is never rendered — `userFacingMessage()` substitutes copy per kind.

---

### 13. Message history has no total count

`{ messages, hasMore }` gives no total and no page count, so a "247 messages"
affordance or a scrollbar sized to the true history is not possible without
walking every page.

**Handled:** accepted. The UI uses `hasMore` for a load-older affordance and
never claims a total.

---

## Behaviour

### 14. Login silently renames an existing account

```
POST /auth/login { "phone": "+1999…", "name": "Ada Lovelace" }  →  user.name = "Ada Lovelace"
POST /auth/login { "phone": "+1999…", "name": "RENAMED" }       →  user.name = "RENAMED"
```

Same phone, new name, and the stored name is overwritten. There is no separate
profile endpoint, so login *is* the rename mechanism. Benign as a design choice,
but worth stating: a returning user who types their name slightly differently
changes how they appear in everyone else's conversation list.

**Handled:** documented, not worked around — it is the API's intended shape. The
login form pre-fills the last-used name from the persisted session so a returning
user does not rename themselves by accident.

---

### 15. The sender receives no `message:new` echo

Only *other* participants get the socket event. The sender's own message never
comes back over the socket, and the `message:send` ack is a bare `{ ok: true }`
with no message body — so it does not carry the server-assigned id either.

This is defensible (it saves a round trip) but it must be known: a client that
waits for the socket to confirm its own send will show a message that never
arrives.

**Handled:** local echo is mandatory rather than decorative. The composer
appends an optimistic `Message` with a `clientId` and `status: 'sending'`, then
`POST /messages` returns the real message and the optimistic copy is replaced by
id. A failed send flips to `status: 'failed'` with a retry affordance instead of
vanishing.

---

### 16. `POST` creates answer `200`, except when they answer `201`

`POST /conversations` → `200`. `POST /messages` → `200`.
`POST /conversations/group` → `201`.

Same verb, same "resource created" semantics, two different codes across
endpoints.

**Handled:** no status-code branching anywhere; success is `response.ok`.

---

### 17. Response envelopes are inconsistent across endpoints

| Endpoint | Envelope |
|---|---|
| `POST /auth/login` | `{ token, user }` |
| `GET /auth/me` | bare user object |
| `GET /users/search` | bare array |
| `GET /conversations` | `{ data: [...] }` |
| `GET …/messages` | `{ messages: [...], hasMore }` |
| `POST /messages` | bare message object |
| group endpoints | bare group object |

Four different conventions. `{ data }` appears exactly once.

**Handled:** each endpoint function unwraps its own envelope; callers get a
plain domain value.

---

### 18. The current user appears in their own search results

`GET /users/search?q=<your name>` includes you. Combined with quirk 9, tapping
your own result opens an unrelated conversation.

**Handled:** filtered client-side against the session user id.

---

### 19. `error.code` is sometimes a string and sometimes a number

Handled errors use string codes (`VALIDATION_ERROR`, `FORBIDDEN`). Unhandled
driver errors leak the numeric MongoDB code instead — `51091` for the regex
failure in quirk 3.

**Handled:** typed as `string | number` on `WireApiError`; the UI never displays
it.

---

### 20. Cold starts of 30–60 seconds

The demo server is on a free Render tier and sleeps after inactivity. The first
request of a session can take the better part of a minute. It is not a bug in
the API, but a client that shows a generic spinner for 45 seconds looks broken.

**Handled:** the socket is configured with a long `timeout` and a generous
reconnection schedule rather than failing fast, and the first load distinguishes
"waking the server up" from an ordinary pending request so the wait is explained
rather than silent.

---

## What was *not* wrong

Worth stating, since a list like this reads as an indictment otherwise:

- **Group authorization is correct.** Non-admin rename → `403`, with a clear
  message. Membership and admin checks hold up.
- **Conversation access control is correct.** A valid-but-foreign conversation
  id → `404`, with no distinction between "absent" and "forbidden".
- **`POST /conversations` is properly idempotent.** Calling twice returns the
  existing conversation rather than duplicating.
- **Group validation is genuinely strict** — blank name and under-3 membership
  are both rejected with useful `details`.
- **Socket auth is enforced at handshake.** A bad token is rejected outright.
- **JWT expiry is sane** at 7 days.
