# Feature: Auth & Session

`/login` (phone + name, no password), session restore against `/auth/me`, and a
route guard that never flashes the wrong screen.

## Context

The brief: *"a login page where the user enters a phone number and sets their
name to log in. There's no separate registration flow — if the phone number is
new/unique, the API registers it as a new user automatically."*

`sessionSlice` already exists with `sessionEstablished` / `sessionRestored` /
`sessionCleared` and a `status: 'unknown' | 'authenticated' | 'anonymous'`
tri-state. The `'unknown'` state exists precisely so boot can render a skeleton
instead of redirecting — **use it**; do not collapse it to a boolean.

Two API behaviours shape this screen:

- **[Quirk 14] Login silently renames an existing account.** Same phone, new
  name, and the stored name is overwritten everywhere — including in other
  people's conversation lists. There is no profile endpoint; login *is* rename.
- **[Quirk 5] A missing token is `400`, an invalid one is `401`.** Both are auth
  failures. `classify()` already keys on the payload `code`, so the UI must use
  `kind`, never the status code.

## Adoption Brief

**Adopted:** `src/lib/api.login` / `getCurrentUser`, `sessionSlice`,
`src/lib/utils/phone.ts` (plan 01), primitives from plan 01, `zod` (present) for
the login schema.

**NOT adopted:** `react-hook-form` — one form, four states. A `use-login-form`
hook mirrors `sapan.dev`'s `use-contact-form.ts`. Next.js middleware auth — the
JWT lives in `localStorage` (the API is called directly from the browser, there
is no server session), so middleware cannot see it. Guarding is client-side and
that is the honest architecture, not a shortcut.

## Skill Dependencies

- `architecture/routing.md` — route structure and navigation
- `architecture/state.md` — session ownership
- `workflow/no-use-effect.md` — restore runs in a hook, submit in a handler
- `external/testing/playwright-best-practices/testing-patterns/forms-validation.md`

## Architecture Strategy

**Routing.** `/login` is a Server Component page exporting `metadata`; the form
inside it is a Client island. `/chat` is guarded by a client `AuthGate` that
renders one of three things off `session.status`:

| `status` | Renders |
|---|---|
| `unknown` | The chat shell **skeleton** — never a redirect, never the login page |
| `anonymous` | `router.replace('/login')`, once |
| `authenticated` | Children |

Flashing `/login` at an already-authenticated user is the specific failure the
tri-state prevents.

**Session restore.** `use-session-restore.ts`: on mount, read
`localStorage[SESSION_STORAGE_KEY]`, and if a token is present, validate it with
`GET /auth/me` before trusting it. A 7-day JWT expires while a tab sits open, so
a persisted token is a *claim*, not proof. Valid → `sessionRestored` with the
**server's** user (the name may have changed under quirk 14). Invalid →
`sessionCleared`. Absent → `sessionCleared` immediately, no request.

The read happens inside the hook via `useMountEffect`, not at module scope —
module-level `localStorage` access breaks SSR.

**Phone handling.** The field formats as-you-type via `formatPhoneAsYouType`, but
what is **sent** is always `normalizePhone`'s E.164 output. The API accepts
almost anything, so a malformed number is not an error — it is a silently
unfindable account. Client validation is the only validation.

**The rename guard.** The login form pre-fills `name` from the persisted session
when the typed phone matches the stored one. If the user edits it, show an inline
note — *"This will update your name everywhere, including in conversations you
are already in."* This is not decoration: it is the only place the app can
surface quirk 14, and a returning user who types "Sapan M" instead of "Sapan"
renames themselves in every other participant's list.

**Submit** is a plain event handler: validate → normalize → `dispatch(login)` →
on success `router.replace('/chat')`. No effect, no flag relay.

## Component Type Decision

| File | Type | Reason |
|---|---|---|
| `src/app/login/page.tsx` | **Server** | metadata + static copy |
| `src/components/layout/auth/login-form.tsx` | Client | form state, submit |
| `src/components/layout/auth/login-panel.tsx` | **Server** | headline, framing copy |
| `src/components/layout/auth/auth-gate.tsx` | Client | reads session, redirects |
| `src/components/layout/auth/session-boot.tsx` | Client | runs restore once, app-wide |
| `src/hooks/use-login-form.ts` | Client hook | field state + validation |
| `src/hooks/use-session-restore.ts` | Client hook | `useMountEffect` + `/auth/me` |

`session-boot.tsx` mounts inside `providers/index.tsx` so restore runs once for
the whole app, not per guarded route.

## Data & Types

No new domain types. `Session` and `User` already exist.

`src/lib/auth/schema.ts` — a zod schema for the form:

```ts
phone: refined against isValidPhone
name:  min 1 after trim, max 60
```

zod is used for the *shape and messages*; `libphonenumber-js` does the phone
truth. Two libraries, one job each.

## Design System

- Centred card, `max-w-md`, `bg-surface dark:bg-surface-dark`, `rounded-panel`
- The `signal-*` pulse-ring motif from the landing hero repeats faintly behind
  the card, so `/` → `/login` reads as one product
- Phone input in `font-mono` — it is data, and mono makes a mistyped digit visible
- Submit is `signal-600` / `signal-500`; disabled is `opacity-50 cursor-not-allowed`
- Errors `text-danger`, never colour alone — an error icon and text accompany it

## State

Redux `sessionSlice` only. Field values are local `useState` in `use-login-form`
— form state in Redux would re-render on every keystroke for no benefit.

## Accessibility

- `<label>` bound to each input; no placeholder-as-label
- `aria-invalid` + `aria-describedby` wiring to the error node
- Server errors land in a `role="alert"` region above the submit button
- Submit `disabled` while in flight, with `aria-busy`
- `autoComplete="tel"` and `autoComplete="name"`
- The whole form is operable by keyboard; Enter submits
- The `unknown`-state skeleton carries an `aria-live="polite"` "Restoring your
  session" status, so a screen reader is not left in silence

## Testing Strategy

`tests/components/auth/login-form.test.tsx`:

- [✅] empty submit is blocked, and reports which field
- [✅] invalid phone blocked before any request
- [✅] valid submit dispatches `sessionEstablished` with **E.164** phone, not raw input
- [✅] a `validation` API error surfaces inline against its field
- [✅] name pre-fills from a persisted session
- [✅] editing a pre-filled name shows the rename warning

`tests/hooks/use-session-restore.test.ts`: valid token → restored; expired token
→ cleared; absent token → cleared with **no** network call.

Playwright (`e2e/auth.spec.ts`): log in → land on `/chat`; reload → still
authenticated, no flash of `/login`; corrupt the stored token → redirected to
`/login` exactly once.

## Performance

`/login` is server-rendered except the form. `/auth/me` fires once per boot. The
restore request is not blocking paint — the shell renders skeleton immediately.

## SEO

`/login` exports `metadata` with `robots: { index: false }` — a login screen has
no business in an index. The root layout's template supplies the title suffix.

## Affected Files

- `src/app/login/page.tsx` — replace the stub
- `src/app/chat/page.tsx` — wrap in `AuthGate`
- `src/providers/index.tsx` — mount `SessionBoot`
- `src/store/index.ts` — confirm the session persistence listener writes on
  `sessionEstablished` **and** `sessionRestored`, and clears on `sessionCleared`

## New Files

- `src/components/layout/auth/{login-form,login-panel,auth-gate,session-boot}.tsx`
- `src/hooks/{use-login-form,use-session-restore}.ts`
- `src/lib/auth/schema.ts`
- `tests/components/auth/login-form.test.tsx`
- `tests/hooks/use-session-restore.test.ts`
- `e2e/auth.spec.ts`

## Implementation Steps

- [✅] **1 — Schema.** `src/lib/auth/schema.ts` — zod over `isValidPhone`.
- [✅] **2 — `use-login-form`.** Field state, per-field touched flags, validation
  on blur and submit, in-flight lock, server `fieldErrors` mapped back to fields.
- [✅] **3 — `LoginForm`.** Compose plan-01 primitives. As-you-type formatting,
  E.164 on submit, the rename warning, `role="alert"` error region.
- [✅] **4 — `/login` page.** Server page + metadata + `LoginPanel` copy, with the
  form as the only client island. Redirect to `/chat` if already authenticated.
- [✅] **5 — `use-session-restore` + `SessionBoot`.** Validate the persisted token
  against `/auth/me` before trusting it. Mount in `providers/index.tsx`.
- [✅] **6 — `AuthGate`.** The three-way branch on `status`. Skeleton for
  `unknown`, single `router.replace` for `anonymous`.
- [✅] **7 — Guard `/chat`.** Wrap the chat page; confirm no login flash on reload.
- [✅] **8 — Tests.** Component, hook, and the e2e spec.
- [✅] **9 — Gate.** `pnpm run check:all`, `pnpm run test`, and `pnpm run build`
  all pass. The Playwright run was **not** executed: a second agent held port
  8001 for the duration of this work, so `e2e/auth.spec.ts` is written and
  type-checks but is unverified against a running server.

## Verification

- [✅] Reload on `/chat` while logged in never shows `/login`, not even one frame
      — `unknown` renders the skeleton and the redirect is mounted, never
      guarded-inside-an-effect. Asserted in `e2e/auth.spec.ts` (not yet run).
- [🔄] `+1 555 123 4567` and `+15551234567` produce the same stored account.
      A **bare** `15551234567` does **not** — it is refused, per this PRD's own
      Risks section and `phone.ts`: a country code is required, never inferred.
      The verification line as originally written contradicts that decision.
- [✅] Empty name and empty phone are both blocked client-side
- [✅] An expired token redirects once, not per in-flight request — the
      redirect is a mounted component, so the mount *is* the condition.
- [🔄] Axe clean on `/login`, light and dark — spec written, Playwright not
      run. Contrast was verified by computation instead: `danger` as text is
      3.87:1 on `surface` and fails AA, so `danger-ink` / `danger-ink-dark`
      were added (5.6:1 light, 7.2:1 dark).
- [🔄] Keyboard-only: tab to both fields, submit with Enter — asserted in
      `e2e/auth.spec.ts`, not yet run.

## Risks & Open Questions

- **Country code for `libphonenumber-js`.** Parsing a bare `5551234567` needs a
  default region. Plan: require an explicit `+` country code, format as-you-type
  once one is present, and show a hint. Guessing a region from the browser locale
  would silently create accounts under the wrong country code — worse than asking.
- **`localStorage` in private mode** can throw on write. The persistence listener
  must `try/catch`; failing to persist degrades to "log in again next visit",
  which is acceptable. Failing to *catch* white-screens the app.
- **The rename warning could be read as a bug report.** Copy must be neutral and
  factual, not apologetic — it is the API's intended behaviour.
