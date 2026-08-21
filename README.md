# Happy Birthday, Alexa

A 3D birthday wish built with React Three Fiber + Vite. A wrapped gift opens like double
doors, a cake drops in and lights its candles, and each section brings its own 3D scene:
floating candles, rising sky lanterns, and a field of stars.

Wishes only. There is no party schedule, venue, RSVP or countdown in this one.

## Run locally

```bash
npm install
npm run dev
```

Vite prints two URLs. The **Network** one works from any phone on the same wifi.

## Edit the wording

Everything lives in one file:

```
src/config.js
```

Name, date, who the wish is from, the note, the "make a wish" line, and the list for
the year ahead. You should not need to touch any other file.

## The four 3D acts

Scrolling swaps what the fixed WebGL canvas renders. Each act fades its materials in and
out as its section reaches the middle of the screen:

| section | act | what renders |
|---|---|---|
| hero + quote | `hero` | the dropped cake, balloons, confetti |
| A note for you | `wish` | a ring of floating lit candles |
| Make a wish | `lanterns` | warm paper sky-lanterns drifting upward |
| For the year ahead | `stars` | a big turning star, a constellation, shooting stars |

## Build

```bash
npm run build     # → dist/
npm run preview
```

`dist/` is a plain static folder. Deploy it anywhere.

## Works offline

The 3D scene makes **no network requests**: lighting is generated in-engine with drei
`Lightformer`s rather than fetching an HDR from a CDN. The only external request is the
Google Fonts stylesheet.
