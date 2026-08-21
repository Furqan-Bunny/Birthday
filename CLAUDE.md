# CLAUDE.md

3D birthday **wish** page for Alexa, from Alex & Furqan. Single-page, static, no backend.
React 18 + Vite 5, React Three Fiber / drei / postprocessing over Three.js r169, Lenis for
smooth scroll.

Wishes only. There is deliberately **no** party schedule, venue, RSVP, countdown or age
anywhere in this project — the user removed all of them on purpose. Do not add them back.

Descended from the invitation site at `E:\birthday`, which still has all of that and should
be left alone.

## Commands

```bash
npm run dev       # LAN-accessible by default (server.host = true)
npm run build     # → dist/
npm run preview
```

No tests, no linter, no typechecker. Verify by running the dev server and looking at the page.

## Files

```
index.html          entry + Google Fonts (Fredoka, Cormorant Garamond, Montserrat)
src/main.jsx        mounts <App/> in StrictMode
src/App.jsx         page sections, hooks, inline SVG line-art
src/Intro.jsx       the wrapped gift that unties and swings open
src/Scene.jsx       the fixed WebGL canvas
src/scrollState.js  non-reactive scroll store
src/config.js       ALL copy — name, date, from, note, wish, yearAhead, signoff
src/index.css       all styling
```

**All user-facing copy lives in `config.js`.** Change wording there, not in JSX.

**No em dashes in any user-facing copy.** The user asked for them gone; use commas or a
full stop instead. Code comments are fine.

## Architecture — the two things worth knowing

**1. Scroll never goes through React.** `scrollState.js` exports a plain module object
(`progress`, `velocity`, `act`). Lenis writes to it every tick; `Scene`'s `useFrame`
callbacks read it directly. Scrolling triggers zero re-renders. Do not convert this to
`useState` — that's the whole performance design.

`scrollState.act` (`hero | wish | lanterns | stars`) is set by `useAct` via
IntersectionObserver at 50% visibility. Each 3D act damps its material opacity toward
`act === '<name>' ? 1 : 0` and gates `visible = opacity > 0.02`.

| section | act | 3D |
|---|---|---|
| hero, quote | `hero` | dropped cake, balloons, confetti |
| A note for you | `wish` | ring of floating lit candles |
| Make a wish | `lanterns` | instanced paper sky-lanterns rising |
| For the year ahead | `stars` | big turning star, instanced constellation, shooting stars |

**2. The intro gates everything.** `Intro` locks `html.overflow` while mounted and runs
`idle → untie (1300ms) → open (2000ms) → done`. On `done` it **unmounts** — that cleanup is
what restores scrolling. Lenis only starts once `opened` is true.

`opened` also triggers `DroppedCake`. When the cake lands it calls `onCakeLand` → `heroGo` →
the hero text cascades in. A 2600ms `setTimeout` in `App` is the fallback.

## Hero framing — do not undo this

The hero text and the dropped cake share the same screen. Three things keep them apart, and
changing any one of them alone brings the overlap back:

- `.hero-inner` has `margin-bottom: 18vh` (12vh on mobile, 5vh on landscape phones) so the
  text block sits above centre.
- `DroppedCake` rests at `y - 1.6` with `scale={0.85}` and `z = -0.4`.
- `.hero .from` and `.hero .meta` carry a cream `text-shadow` halo.

## Mobile is a separate render path — don't collapse it

A transparent fixed canvas composited under blurring, scrolling content flickers badly on
mobile browsers. When `isMobile`:

- canvas is **opaque** — `gl.alpha: false` plus a solid `<color attach="background">`
- postprocessing (Bloom/Vignette/Noise) is **off**
- DPR capped at 1.3; balloons 24 (vs 40), confetti 55 (vs 90), lanterns 11 (vs 18),
  shooting stars 2 (vs 3)
- CSS `@media (max-width: 768px)` disables `backdrop-filter` on `.glass`

Because Bloom is off on mobile, anything that relies on glow alone disappears there. That is
why the cake's candles are **solid bright colours** with a little emissive rather than white
wax — white candles vanished completely. Keep them coloured.

Breakpoints: 640px (phone), 380px (small phone), 768px (glass), and
`(max-height: 540px) and (orientation: landscape)` for phones held sideways.

`prefers-reduced-motion` is a third path: no Lenis, intro skips to `done`, hero text
immediate, all sketch animation off.

## Deliberate choices (do not "fix" these)

- **No `<Environment preset>`.** drei's `preset` fetches an HDR from `raw.githack.com`;
  offline that renders every metal surface black. This project uses
  `<Environment resolution={256}>` with `<Lightformer>` children, which bakes the cubemap
  in-engine. **Zero network.** Keep it that way.
- The big star in `StarsAct` parks at `x: 5.4` on landscape. Any closer to centre and it
  sits behind the glass panel, where it reads as a brown smudge rather than a star.
- `twitter:card` is `summary`, because there is no `og:image` yet.

## Gotchas

- A balloon — and a lantern — is **one** `LatheGeometry` whose profile tapers to a hair-thin
  radius at the bottom, so the string/base is part of the same geometry. That keeps it
  instanceable.
- Per-instance colour: `setColorAt` then `instanceColor.needsUpdate = true`. three creates
  `instanceColor` on first call; the material needs **no** `vertexColors` flag.
- Groups whose children are animated by `children.forEach((c, i) => ... arr[i])` must contain
  **only** the mapped array — that's why the shooting stars and the big star in `StarsAct`
  each live outside the constellation's group.
- Candle and lantern flames are emissive meshes + Bloom, deliberately **not** real
  `pointLight`s.

## Conventions

- Easing is `--ease` (expo-out) in CSS; `THREE.MathUtils.damp` in the scene.
- Fade 3D objects by damping material `opacity`, then gate `visible`.
- Reveal animations attach to `.reveal-child` inside `.panel-body`, never to a `.glass`
  ancestor — a transform/opacity on the glass element breaks its `backdrop-filter`.
