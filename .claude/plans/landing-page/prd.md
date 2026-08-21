# PRD — Landing Page (Part 2)

**Status:** `[⬜]` Not started
**Route:** `/`
**Scope:** A page that introduces Wavelength to real users. No design file is
provided — the visual direction is ours.

---

## The argument the page has to make

Wavelength's one genuinely distinctive idea is **identity without an account**.
A phone number and a name, and you are on the air. No password, no verification
email, no sign-up form. Every design decision below serves that idea.

The brief explicitly prefers "bold" over "generic template", and explicitly
denies bonus credit for stock testimonial sections and FAQ accordions. So: no
testimonials, no FAQ, no logo cloud, no three-column feature grid with outline
icons.

---

## Direction

**Name → concept → visual.** "Wavelength" is what you are on when you and
someone else understand each other, and it is also a physical signal. The page
leans on the second to say the first.

- **Palette:** the `signal-*` violet ramp against near-black `canvas-dark`, with
  `pulse-*` cyan as the accent that marks anything live. Dark by default —
  messaging apps are used at night, and it makes the signal accents carry.
- **Type:** Outfit for display at large sizes with tight tracking; Inter for
  body; mono for anything that represents data (timestamps, phone numbers). The
  mono/sans contrast is the same one used inside the app, so the page and the
  product read as one thing.
- **Motion:** entrance and scroll transitions in Framer Motion; anything
  continuous (the signal pulse) in CSS keyframes so it does not hold the main
  thread. `prefers-reduced-motion` is already honoured globally in
  `global.scss` — verify, do not re-implement.

---

## Steps

### `[⬜]` 1 — Hero

The headline is the product's whole pitch: **"A number, a name, and you're on
the air."**

Beneath it, a **live phone-number field** — the real one from `/login`, inline
in the hero. Typing a number shows it formatting in real time; submitting takes
the user straight into the app as a logged-in user. The primary CTA *is* the
product's entire onboarding, which is the most honest possible demonstration of
"no sign-up flow" — the page cannot claim it without also proving it.

Behind it, a signal visual on the `animate-pulse-ring` keyframes — concentric
rings on a slow loop, not a video, not a Lottie.

**Gate:** server-rendered except the input. Largest contentful paint is text.

---

### `[⬜]` 2 — The chat demo section

Show the actual chat panel, because it is the thing being showcased and it is
where the assignment's effort went.

Not a screenshot. A **scripted replay** of a real conversation using the real
`MessageBubble` / `MessageList` components with a canned message array —
messages arrive on a timer, with the real bubble-in animation and the real
timestamps. Same components, no live socket.

Two reasons this beats a screenshot: it demonstrates the real-time behaviour
that is the graded core of Part 1, and it cannot drift from the product, because
it *is* the product's components.

Pause on `prefers-reduced-motion` and render the full transcript statically.

**Gate:** the section imports from `components/layout/chat/`, not a copy.

---

### `[⬜]` 3 — What it does

Three claims, each earned by something actually built:

- **No accounts.** One number, one name.
- **Live, not polled.** Messages arrive over a socket, in the moment.
- **Groups that behave.** Admins, renames, joining, leaving.

Prose and a single supporting visual each — not an icon grid. If a claim cannot
be shown, cut it rather than padding to three.

---

### `[⬜]` 4 — Responsive + polish

- Fluid type with `clamp()`; no fixed breakpointed font sizes
- Test at 360px, 768px, 1280px, 1920px
- Hero legible and CTA reachable without scroll at 360×640
- Dark and light both deliberate — the page is dark-first, but the light variant
  must not look like an afterthought
- Real metadata and an OG image

**Gate:** axe clean, Lighthouse ≥95 on performance and accessibility, no
horizontal scroll at any width.

---

## Bonus candidate

The brief again wants something **genuinely original**, and names stock
testimonials and FAQ accordions as explicitly not counting.

**The strongest option is the hero login field** (step 1) — a landing page whose
primary CTA is the product's complete onboarding, inline, with no intermediate
sign-up page. It is unusual, it is only possible *because* of how this API
models identity, and it makes the page's central claim unfalsifiable.

Second option, if a smaller and more contained gesture is wanted: **the page
reflects the live API's state.** Ping `/health` and let the hero's signal rings
run at full strength when the API is up and dim when it is cold-starting. A
landing page that knows whether its own backend is awake is a detail nobody asks
for, and it quietly pre-explains the 30–60s cold start before the user hits it
in the app.

Build **one**, completely.

---

## Explicitly not doing

Testimonials, FAQ accordion, pricing table, logo cloud, newsletter capture,
cookie banner, generic feature grid. The brief rules most of these out by name;
the rest would dilute a page whose whole argument is that this product does less
on purpose.
