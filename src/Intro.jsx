import { useEffect, useRef, useState } from 'react'
import { birthday as b } from './config.js'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Full-screen wrapped gift:
   idle  → the whole screen is a wrapped box with a ribbon tied across it,
           the name, and "Tap to open"
   untie → the bow comes undone (loops fly apart, tails drop) and the ribbon
           retracts off both sides
   open  → the wrapping splits down the centre and swings open like double
           doors, revealing the 3D site behind
   done  → overlay removed, smooth scroll handed to the page                  */
export default function Intro({ onDone }) {
  const [stage, setStage] = useState('idle')
  const opened = useRef(false)

  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [])

  const open = () => {
    if (opened.current) return
    opened.current = true
    if (prefersReduced) {
      setStage('done')
      onDone?.()
      return
    }
    setStage('untie')
    setTimeout(() => setStage('open'), 1300) // after the ribbon unties + retracts
    setTimeout(() => {
      setStage('done')
      onDone?.()
    }, 1300 + 2000) // after the doors finish opening
  }

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  if (stage === 'done') return null

  return (
    <div
      className={`intro is-${stage}`}
      role="button"
      tabIndex={0}
      aria-label="Tap to open the birthday wish"
      onClick={open}
      onKeyDown={onKey}
    >
      <div className="invite">
        {/* the two full-height wrapping-paper doors */}
        <div className="door left">
          <Balloons className="fl tl" />
          <Balloons className="fl bl" />
        </div>
        <div className="door right">
          <Balloons className="fl tr" />
          <Balloons className="fl br" />
        </div>

        {/* name etc. sit in the UPPER area so the ribbon never crosses them */}
        <div className="invite-face">
          <div className="face-content">
            <div className="invite-mono">🎂</div>
            <p className="invite-eyebrow">{b.eyebrow}</p>
            <h2 className="invite-names">{b.name}</h2>
            <div className="invite-divider" />
            <p className="invite-date">{b.date}</p>
            <p className="invite-from">{b.from}</p>
          </div>
        </div>

        {/* horizontal ribbon band across the box + bow */}
        <div className="ribbon">
          <span className="ribbon-strip left" />
          <span className="ribbon-strip right" />
          <span className="bow" aria-hidden="true">
            <i className="loop l" />
            <i className="loop r" />
            <i className="tail l" />
            <i className="tail r" />
            <i className="knot" />
          </span>
        </div>

        <p className="tap-hint">Tap to open</p>
      </div>
    </div>
  )
}

/* A small cluster of balloons (line-art) for the corners of the wrapping. */
function Balloons({ className }) {
  return (
    <svg className={`floral ${className}`} viewBox="0 0 130 130" aria-hidden="true">
      {/* strings */}
      <path className="stem" d="M64 122 C 58 100 50 84 44 66" />
      <path className="stem" d="M64 122 C 68 98 72 80 74 58" />
      <path className="stem" d="M64 122 C 76 102 90 90 100 76" />
      {/* balloons */}
      <ellipse className="balloon b1" cx="42" cy="52" rx="17" ry="21" />
      <ellipse className="balloon b2" cx="76" cy="44" rx="15" ry="19" />
      <ellipse className="balloon b3" cx="104" cy="62" rx="13" ry="16" />
      {/* knots */}
      <path className="stem" d="M42 73 l -3 5 h 6 z" />
      <path className="stem" d="M76 63 l -3 5 h 6 z" />
      <path className="stem" d="M104 78 l -3 5 h 6 z" />
    </svg>
  )
}
