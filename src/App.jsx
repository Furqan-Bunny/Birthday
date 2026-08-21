import { useCallback, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import Scene from './Scene.jsx'
import Intro from './Intro.jsx'
import { scrollState } from './scrollState.js'
import { birthday as b } from './config.js'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isMobile =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  (window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches)

/* Smooth inertia scroll — feeds the non-reactive scrollState every tick. */
function useSmoothScroll(enabled) {
  useEffect(() => {
    if (!enabled) return
    if (prefersReduced) return
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true })
    lenis.on('scroll', ({ scroll, limit, velocity }) => {
      scrollState.progress = limit > 0 ? scroll / limit : 0
      scrollState.velocity = velocity
    })
    let raf
    const loop = (t) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [enabled])
}

function useNativeScrollFallback() {
  useEffect(() => {
    if (!prefersReduced) return
    const onScroll = () => {
      const limit = document.documentElement.scrollHeight - window.innerHeight
      scrollState.progress = limit > 0 ? window.scrollY / limit : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}

/* Adds `.in` to children the first time the section enters view → CSS reveal.
   The wrapper itself has no transform/opacity, so it never breaks the glass
   panel's backdrop-filter. */
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReduced) {
      el.classList.add('in')
      return
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('in')
          obs.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

/* Tells the 3D scene which "act" is on screen so it can swap its content. */
function useAct(name) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) scrollState.act = name
      },
      { threshold: [0.5] },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [name])
  return ref
}

export default function App() {
  const [opened, setOpened] = useState(false)
  const [heroGo, setHeroGo] = useState(false)
  useSmoothScroll(opened)
  useNativeScrollFallback()

  const heroRef = useAct('hero')

  // When the dropped cake lands and lights its candles: reveal the hero text.
  const onCakeLand = useCallback(() => {
    setHeroGo(true)
  }, [])

  // Fallback so the hero text always appears even if the cake never reports.
  useEffect(() => {
    if (!opened) return
    if (prefersReduced) {
      setHeroGo(true)
      return
    }
    const id = setTimeout(() => setHeroGo(true), 2600)
    return () => clearTimeout(id)
  }, [opened])

  return (
    <>
      {/* Render Intro only until it opens — so on completion it UNMOUNTS and
          its scroll-lock cleanup runs, freeing the page to scroll. */}
      {!opened && <Intro onDone={() => setOpened(true)} />}
      <Scene reduced={prefersReduced} mobile={isMobile} opened={opened} onCakeLand={onCakeLand} />

      <main className="content">
        {/* ── HERO ── */}
        <section className={`hero ${heroGo ? 'go' : ''}`} ref={heroRef}>
          <div className="hero-inner">
            <p className="eyebrow line"><span>{b.eyebrow}</span></p>
            <h1 className="names">
              <span className="line"><span>{b.name}</span></span>
            </h1>
            <p className="tagline line"><span>{b.tagline}</span></p>
            <p className="meta line"><span>{b.date}</span></p>
            <p className="from line"><span>{b.from}</span></p>
          </div>
          <div className="scroll-hint">Scroll</div>
        </section>

        {/* ── QUOTE ── */}
        <QuoteSection />

        {/* ── THE NOTE — floating candles behind ── */}
        <Panel title={b.note.title} align="left" act="wish" feature={<SketchCake />}>
          <p className="lead reveal-child">{b.note.body}</p>
        </Panel>

        {/* ── MAKE A WISH — rising lanterns behind ── */}
        <Panel title={b.wish.title} act="lanterns" feature={<SketchLantern />}>
          <p className="lead reveal-child">{b.wish.body}</p>
        </Panel>

        {/* ── FOR THE YEAR AHEAD — the star field behind ── */}
        <Panel title={b.yearAhead.title} act="stars" feature={<SketchStars />}>
          <ul className="menu reveal-child">
            {b.yearAhead.items.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Panel>

        <footer>
          <span className="footer-signoff">{b.signoff}</span>
          {b.from}
        </footer>
      </main>
    </>
  )
}

/* A generic glassmorphism panel that also reports its act.
   `feature` renders above the title — that is where the line-art sketches go. */
function Panel({ title, children, align = 'center', act = 'hero', feature }) {
  const actRef = useAct(act)
  const ref = useReveal()
  return (
    <section className="panel-section" ref={actRef}>
      <div className={`glass panel ${align}`}>
        <div ref={ref} className="panel-body">
          {feature}
          <h2 className="reveal-child">{title}</h2>
          <div className="divider reveal-child" />
          {children}
        </div>
      </div>
    </section>
  )
}

function QuoteSection() {
  const actRef = useAct('hero')
  const ref = useReveal()
  return (
    <section className="panel-section" ref={actRef}>
      <div className="glass panel quote-panel">
        <div ref={ref} className="panel-body">
          <p className="quote-mark reveal-child">&ldquo;</p>
          <p className="quote-text reveal-child">{b.quote.text}</p>
          <div className="divider reveal-child" />
          <p className="quote-ref reveal-child">{b.quote.author}</p>
        </div>
      </div>
    </section>
  )
}

/* Sketch-style tiered cake — draws itself in, then the flames light and flicker. */
function SketchCake() {
  return (
    <svg className="sketch cake" viewBox="0 0 340 250" aria-hidden="true">
      {/* plate */}
      <path className="ln" d="M52 214 H288" />
      <path className="ln soft" d="M72 222 H268" />
      {/* bottom tier */}
      <path className="ln" d="M74 214 V168 H266 V214" />
      <path className="ln drip" d="M74 168 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 20 0 q10 14 16 0" />
      {/* top tier */}
      <path className="ln" d="M108 168 V124 H232 V168" />
      <path className="ln drip" d="M108 124 q10 13 20 0 q10 13 20 0 q10 13 20 0 q10 13 20 0 q10 13 20 0 q10 13 20 0 q10 13 4 0" />
      {/* candles */}
      <g className="candles">
        <path className="ln" d="M132 124 V92" />
        <path className="ln" d="M170 124 V86" />
        <path className="ln" d="M208 124 V92" />
      </g>
      {/* flames */}
      <g className="flames">
        <path className="ln flame" d="M132 88 q7 -8 0 -18 q-7 10 0 18 Z" />
        <path className="ln flame" d="M170 82 q7 -8 0 -18 q-7 10 0 18 Z" />
        <path className="ln flame" d="M208 88 q7 -8 0 -18 q-7 10 0 18 Z" />
      </g>
    </svg>
  )
}

/* Sketch-style paper lantern that lifts off once it is drawn. */
function SketchLantern() {
  return (
    <svg className="sketch lantern" viewBox="0 0 340 250" aria-hidden="true">
      {/* the lantern itself — rises as a whole */}
      <g className="lant lant-main">
        <path className="ln" d="M126 96 q44 -52 88 0 q6 42 -14 72 H140 q-20 -30 -14 -72 Z" />
        <path className="ln soft" d="M140 168 h60 v10 h-60 Z" />
        <path className="ln soft rib" d="M170 44 V168 M144 62 q10 56 6 106 M196 62 q-10 56 -6 106" />
        {/* the flame inside */}
        <path className="ln glow" d="M170 150 q11 -13 0 -30 q-11 17 0 30 Z" />
      </g>
      {/* two smaller lanterns further away */}
      <g className="lant lant-s1">
        <path className="ln soft" d="M52 132 q22 -28 44 0 q3 22 -7 38 H59 q-10 -16 -7 -38 Z" />
        <path className="ln soft" d="M59 170 h30 v6 H59 Z" />
      </g>
      <g className="lant lant-s2">
        <path className="ln soft" d="M248 112 q18 -24 36 0 q3 18 -6 32 h-24 q-9 -14 -6 -32 Z" />
        <path className="ln soft" d="M254 144 h24 v6 h-24 Z" />
      </g>
      {/* sparks drifting up */}
      <g className="pops">
        <path className="ln soft pop" d="M108 214 L108 202 M102 208 L114 208" />
        <path className="ln soft pop" d="M232 220 L232 210 M227 215 L237 215" />
      </g>
    </svg>
  )
}

/* Sketch-style stars — one big, two small, all twinkling. */
function SketchStars() {
  return (
    <svg className="sketch stars" viewBox="0 0 340 250" aria-hidden="true">
      <path
        className="ln star-big"
        d="M170 54 L185 104 L237 104 L195 134 L211 184 L170 154 L129 184 L145 134 L103 104 L155 104 Z"
      />
      <path
        className="ln soft star-sm s1"
        d="M64 92 L71 114 L94 114 L76 128 L83 150 L64 136 L45 150 L52 128 L34 114 L57 114 Z"
      />
      <path
        className="ln soft star-sm s2"
        d="M276 78 L282 96 L301 96 L286 108 L292 126 L276 114 L260 126 L266 108 L251 96 L270 96 Z"
      />
      <g className="pops">
        <path className="ln soft pop" d="M104 204 L104 190 M97 197 L111 197" />
        <path className="ln soft pop" d="M238 210 L238 198 M232 204 L244 204" />
        <path className="ln soft pop" d="M170 220 L170 208 M164 214 L176 214" />
      </g>
    </svg>
  )
}
