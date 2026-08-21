import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles, Environment, Lightformer, Float } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { scrollState } from './scrollState.js'

const damp = THREE.MathUtils.damp

/* Party palette — reused by the balloons and the confetti. */
const PARTY = ['#ff5d8f', '#ffd166', '#5ec8f8', '#8ef0a5', '#c792ea', '#ff8f5d']

/* Warm paper-lantern tints. */
const LANTERN = ['#ffd9a0', '#ffc27a', '#ffe3b8', '#ffb88f']

/* ── shared geometries ───────────────────────────────────────────── */

/* A balloon as a single LatheGeometry: the profile sweeps from the top of the
   balloon, down through the knot, and then continues as a hair-thin radius —
   so the STRING is part of the same geometry. That keeps the whole balloon a
   single instanced draw call (a separate string mesh could not be instanced
   alongside it). */
function useBalloonGeo() {
  return useMemo(() => {
    const profile = [
      [0.001, 0.62],
      [0.14, 0.58],
      [0.27, 0.48],
      [0.36, 0.33],
      [0.41, 0.15],
      [0.42, -0.02],
      [0.38, -0.19],
      [0.3, -0.33],
      [0.19, -0.44],
      [0.09, -0.52],
      [0.11, -0.57], // the knot flares out slightly
      [0.05, -0.6],
      [0.008, -0.63], // string starts
      [0.008, -1.5], // string ends
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(profile, 20)
  }, [])
}

/* A paper sky-lantern: rounded dome on top, tapering to an open mouth, with a
   flat base ring. Same single-lathe trick as the balloon so it instances. */
function useLanternGeo() {
  return useMemo(() => {
    const profile = [
      [0.001, 0.52],
      [0.13, 0.48],
      [0.25, 0.37],
      [0.33, 0.19],
      [0.36, 0.0],
      [0.33, -0.19],
      [0.25, -0.34],
      [0.17, -0.44],
      [0.16, -0.5],
      [0.14, -0.52],
      [0.001, -0.52],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(profile, 18)
  }, [])
}

function useStarGeo(outer = 0.34, inner = 0.15, depth = 0.14) {
  return useMemo(() => {
    const pts = 5
    const s = new THREE.Shape()
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)
    }
    s.closePath()
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 3,
      curveSegments: 24,
    })
    geo.center()
    return geo
  }, [outer, inner, depth])
}

/* ── Balloons — always drifting UP; speed swells with scroll velocity ── */
function Balloons({ count = 40, reduced }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const boost = useRef(0)
  const geo = useBalloonGeo()
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.05 }),
    [],
  )

  const balloons = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 22,
        y: Math.random() * 20 - 10,
        z: (Math.random() - 0.5) * 10 - 3,
        speed: 0.35 + Math.random() * 0.6,
        sway: 0.3 + Math.random() * 0.7,
        scale: 0.55 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
      })
    }
    return arr
  }, [count])

  // Tint each balloon. three creates `instanceColor` on the first setColorAt and
  // the shader picks it up automatically — the material needs no vertexColors flag.
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new THREE.Color()
    balloons.forEach((_, i) => {
      c.set(PARTY[i % PARTY.length])
      m.setColorAt(i, c)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [balloons])

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const target = Math.min(Math.abs(scrollState.velocity) * 0.04, 3)
    boost.current = damp(boost.current, reduced ? 0 : target, 3, delta)

    balloons.forEach((p, i) => {
      p.y += (p.speed + boost.current) * delta // rise
      if (p.y > 11) p.y = -10 // wrap back below
      const x = p.x + Math.sin(t * p.sway + p.phase) * 0.7
      dummy.position.set(x, p.y, p.z)
      // lazy tilt, as if tugged by the string
      dummy.rotation.set(
        Math.sin(t * 0.5 + p.phase) * 0.12,
        Math.sin(t * 0.3 + p.phase) * 0.3,
        Math.sin(t * 0.6 + p.phase) * 0.16,
      )
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, count]} />
}

/* ── Confetti — small tumbling flakes falling through the whole page ── */
function Confetti({ count = 90, reduced }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const boost = useRef(0)
  const geo = useMemo(() => new THREE.BoxGeometry(0.13, 0.2, 0.012), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }),
    [],
  )

  const flakes = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 24,
        y: Math.random() * 20 - 8,
        z: (Math.random() - 0.5) * 11 - 3,
        speed: 0.7 + Math.random() * 1.1,
        sway: 0.5 + Math.random() * 1.2,
        scale: 0.7 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        spinX: 0.6 + Math.random() * 2.2,
        spinY: 0.6 + Math.random() * 2.4,
      })
    }
    return arr
  }, [count])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new THREE.Color()
    flakes.forEach((_, i) => {
      c.set(PARTY[(i + 2) % PARTY.length])
      m.setColorAt(i, c)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [flakes])

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const target = Math.min(Math.abs(scrollState.velocity) * 0.05, 4)
    boost.current = damp(boost.current, reduced ? 0 : target, 3, delta)

    flakes.forEach((p, i) => {
      p.y -= (p.speed + boost.current) * delta // fall
      if (p.y < -9) p.y = 11
      const x = p.x + Math.sin(t * p.sway + p.phase) * 0.9
      dummy.position.set(x, p.y, p.z)
      dummy.rotation.set(t * p.spinX + p.phase, t * p.spinY + p.phase, 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, count]} />
}

/* ── The cake that drops from the top when the wish is opened.
      It lands, bounces, and its candles light. ── */
const CANDLES = 5
function DroppedCake({ play, onLand }) {
  const group = useRef()
  const started = useRef(false)
  const landed = useRef(false)
  const t0 = useRef(0)
  const lit = useRef(0) // 0 → 1 once the cake lands

  const plateMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e8c97a', metalness: 1, roughness: 0.22, transparent: true }),
    [],
  )
  const cakeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f7a8c4', roughness: 0.62, transparent: true }),
    [],
  )
  const frostMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#fff6ec', roughness: 0.5, transparent: true }),
    [],
  )
  // One material per candle. A single white wax cylinder washes out completely
  // against the pale frosting once Bloom is on, so each candle gets its own
  // bright colour and a touch of emissive to hold its edge.
  const candleMats = useMemo(
    () =>
      ['#ff3d7f', '#2bb3f3', '#ffb412', '#4fd67e', '#a95cf0'].map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.28,
            roughness: 0.38,
            transparent: true,
          }),
      ),
    [],
  )
  // one material per flame so each can flicker on its own beat
  const flameMats = useMemo(
    () =>
      Array.from(
        { length: CANDLES },
        () =>
          new THREE.MeshStandardMaterial({
            color: '#ffcf7a',
            emissive: '#ff9d2e',
            emissiveIntensity: 0,
            roughness: 0.4,
            transparent: true,
            opacity: 0,
          }),
      ),
    [],
  )
  const flames = useRef([])

  const allMats = useMemo(
    () => [plateMat, cakeMat, frostMat, ...candleMats, ...flameMats],
    [plateMat, cakeMat, frostMat, candleMats, flameMats],
  )

  const candlePos = useMemo(
    () =>
      Array.from({ length: CANDLES }, (_, i) => {
        const a = (i / CANDLES) * Math.PI * 2
        return [Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52]
      }),
    [],
  )

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return

    if (play && !started.current) {
      started.current = true
      t0.current = state.clock.elapsedTime
    }
    if (!started.current) {
      g.visible = false
      return
    }

    // fade out once we scroll away from the hero
    const target = scrollState.act === 'hero' ? 1 : 0
    const op = damp(cakeMat.opacity, target, 4, delta)
    g.visible = op > 0.02

    const t = state.clock.elapsedTime - t0.current
    const dropDur = 0.95
    let y
    if (t < dropDur) {
      const k = t / dropDur
      y = 7.5 - 7.5 * (k * k) // accelerate downward (gravity-ish)
      g.rotation.y += delta * 1.4
    } else {
      if (!landed.current) {
        landed.current = true
        onLand?.()
      }
      const tb = t - dropDur
      y = Math.abs(Math.sin(tb * 9)) * 0.5 * Math.exp(-tb * 3.2) // damped bounce
      g.rotation.y = damp(g.rotation.y, 0, 2, delta)
    }
    // sits low in frame so the hero text above it stays clean
    g.position.y = y - 1.6

    // candles light up after the landing
    lit.current = damp(lit.current, landed.current ? 1 : 0, 2.6, delta)
    const et = state.clock.elapsedTime
    flameMats.forEach((fm, i) => {
      const flicker = 1 + Math.sin(et * 11 + i * 1.7) * 0.22 + Math.sin(et * 23 + i) * 0.08
      fm.emissiveIntensity = lit.current * 2.4 * flicker
      fm.opacity = lit.current * op
      const f = flames.current[i]
      if (f) f.scale.setScalar(lit.current * flicker)
    })

    // everything fades together
    allMats.forEach((m) => {
      if (!flameMats.includes(m)) m.opacity = op
    })
  })

  return (
    <Float speed={1.1} rotationIntensity={0.06} floatIntensity={0.35}>
      <group ref={group} position={[0, 7.5, -0.4]} scale={0.85}>
        {/* gold plate */}
        <mesh material={plateMat} position={[0, -0.66, 0]}>
          <cylinderGeometry args={[1.45, 1.5, 0.08, 48]} />
        </mesh>
        {/* bottom tier + its frosting lid */}
        <mesh material={cakeMat} position={[0, -0.34, 0]}>
          <cylinderGeometry args={[1.15, 1.2, 0.56, 48]} />
        </mesh>
        <mesh material={frostMat} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[1.21, 1.21, 0.1, 48]} />
        </mesh>
        {/* top tier + its frosting lid */}
        <mesh material={cakeMat} position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.76, 0.81, 0.48, 48]} />
        </mesh>
        <mesh material={frostMat} position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.82, 0.82, 0.08, 48]} />
        </mesh>
        {/* candles + flames */}
        {candlePos.map(([x, , z], i) => (
          <group key={i} position={[x, 0.9, z]}>
            <mesh material={candleMats[i % candleMats.length]}>
              <cylinderGeometry args={[0.065, 0.065, 0.62, 14]} />
            </mesh>
            <mesh
              ref={(el) => (flames.current[i] = el)}
              material={flameMats[i]}
              position={[0, 0.45, 0]}
              scale={0}
            >
              <coneGeometry args={[0.085, 0.3, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </Float>
  )
}

/* ── WISH act: a ring of floating lit candles ── */
function CandlesAct() {
  const grp = useRef()
  const waxMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#fdfbf6', roughness: 0.55, transparent: true, opacity: 0 }),
    [],
  )
  const flameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffcf7a',
        emissive: '#ff9d2e',
        emissiveIntensity: 2.2,
        roughness: 0.4,
        transparent: true,
        opacity: 0,
      }),
    [],
  )

  const candles = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2
        const r = 3.6
        return {
          x: Math.cos(a) * r,
          y: -0.4 + Math.sin(i * 1.3) * 1.2,
          z: -1.5 + Math.sin(a) * 1.7,
          ph: i * 0.8,
          s: 0.85 + (i % 3) * 0.22,
        }
      }),
    [],
  )

  useFrame((state, delta) => {
    const target = scrollState.act === 'wish' ? 1 : 0
    const op = damp(waxMat.opacity, target, 4, delta)
    waxMat.opacity = op
    flameMat.opacity = op
    const t = state.clock.elapsedTime
    flameMat.emissiveIntensity = 2.2 * (1 + Math.sin(t * 12) * 0.18)
    if (grp.current) {
      grp.current.visible = op > 0.02
      grp.current.children.forEach((c, i) => {
        const k = candles[i]
        c.position.y = k.y + Math.sin(t * 0.7 + k.ph) * 0.35
        c.rotation.z = Math.sin(t * 0.5 + k.ph) * 0.08
      })
    }
  })

  return (
    <group ref={grp} visible={false}>
      {candles.map((k, i) => (
        <group key={i} position={[k.x, k.y, k.z]} scale={k.s}>
          <mesh material={waxMat}>
            <cylinderGeometry args={[0.07, 0.07, 0.62, 12]} />
          </mesh>
          <mesh material={flameMat} position={[0, 0.44, 0]}>
            <coneGeometry args={[0.09, 0.26, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ── LANTERNS act: warm paper sky-lanterns drifting upward.
      Instanced, so the whole sky is one draw call. Their glow comes from the
      emissive material plus Bloom — no real lights, same trick as the candles. ── */
function LanternsAct({ count = 18 }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useLanternGeo()
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffdca8',
        emissive: '#ff9d3e',
        emissiveIntensity: 1.5,
        roughness: 0.75,
        transparent: true,
        opacity: 0,
      }),
    [],
  )

  const lanterns = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 18 - 9,
        z: (Math.random() - 0.5) * 12 - 4,
        speed: 0.22 + Math.random() * 0.34,
        sway: 0.2 + Math.random() * 0.45,
        scale: 0.6 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      })),
    [count],
  )

  // Warm per-lantern tint so the sky is not one flat colour.
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new THREE.Color()
    lanterns.forEach((_, i) => {
      c.set(LANTERN[i % LANTERN.length])
      m.setColorAt(i, c)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [lanterns])

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const target = scrollState.act === 'lanterns' ? 1 : 0
    const op = damp(mat.opacity, target, 4, delta)
    mat.opacity = op
    m.visible = op > 0.02
    if (!m.visible) return

    const t = state.clock.elapsedTime
    // the whole sky breathes a little
    mat.emissiveIntensity = 1.5 * (1 + Math.sin(t * 1.6) * 0.12)

    lanterns.forEach((p, i) => {
      p.y += p.speed * delta
      if (p.y > 10) p.y = -9
      const x = p.x + Math.sin(t * p.sway + p.phase) * 0.55
      dummy.position.set(x, p.y, p.z)
      // lanterns hang level and only rock gently
      dummy.rotation.set(
        Math.sin(t * 0.4 + p.phase) * 0.09,
        t * 0.12 + p.phase,
        Math.sin(t * 0.33 + p.phase) * 0.09,
      )
      // a slow individual flicker, as if the flame inside gutters
      const flick = 1 + Math.sin(t * 2.6 + p.phase * 3) * 0.035
      dummy.scale.setScalar(p.scale * flick)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, count]} />
}

/* ── STARS act: one big turning star, a constellation of small ones,
      and shooting stars that streak past every few seconds. ── */
function StarsAct({ shooting = 3 }) {
  const grp = useRef()
  const hero = useRef()
  const shots = useRef([])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const field = useRef()

  const heroGeo = useStarGeo(0.95, 0.42, 0.22)
  const smallGeo = useStarGeo(0.2, 0.09, 0.08)

  const heroMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffd98a',
        metalness: 1,
        roughness: 0.2,
        emissive: '#a5760f',
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0,
      }),
    [],
  )
  const fieldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff0c4',
        metalness: 0.6,
        roughness: 0.3,
        emissive: '#ffbe4d',
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0,
      }),
    [],
  )
  const shotMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fffaf0',
        emissive: '#ffd98a',
        emissiveIntensity: 2.6,
        roughness: 0.3,
        transparent: true,
        opacity: 0,
      }),
    [],
  )

  const stars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.4
        const r = 4.2 + (i % 4) * 1.15
        return {
          x: Math.cos(a) * r,
          y: Math.sin(a) * r * 0.55 + Math.sin(i * 2.1) * 0.9,
          z: -3 - (i % 5) * 1.1,
          ph: i * 0.73,
          s: 0.5 + (i % 4) * 0.24,
          spin: 0.15 + (i % 3) * 0.12,
        }
      }),
    [],
  )

  // Each shooting star gets its own lane and its own moment in the cycle.
  const lanes = useMemo(
    () =>
      Array.from({ length: shooting }, (_, i) => ({
        y: 3.4 - i * 2.1,
        z: -2 - i * 1.4,
        angle: -0.38 - i * 0.08,
        period: 5.5 + i * 2.3,
        offset: i * 1.9,
        len: 9 + i * 1.5,
        s: 1 - i * 0.18,
      })),
    [shooting],
  )

  useFrame((state, delta) => {
    const target = scrollState.act === 'stars' ? 1 : 0
    const op = damp(heroMat.opacity, target, 4, delta)
    heroMat.opacity = op
    fieldMat.opacity = op
    const t = state.clock.elapsedTime

    // the constellation: slow drift + individual twinkle
    const f = field.current
    if (f) {
      f.visible = op > 0.02
      if (f.visible) {
        stars.forEach((p, i) => {
          const tw = 0.72 + Math.abs(Math.sin(t * 1.7 + p.ph)) * 0.5
          dummy.position.set(
            p.x + Math.sin(t * 0.22 + p.ph) * 0.3,
            p.y + Math.sin(t * 0.3 + p.ph) * 0.35,
            p.z,
          )
          dummy.rotation.set(0, 0, t * p.spin + p.ph)
          dummy.scale.setScalar(p.s * tw)
          dummy.updateMatrix()
          f.setMatrixAt(i, dummy.matrix)
        })
        f.instanceMatrix.needsUpdate = true
        fieldMat.emissiveIntensity = 1.1 * (1 + Math.sin(t * 2.2) * 0.2)
      }
    }

    // The big star parks clear of the glass panel — out to the right on
    // landscape, straight overhead on portrait. Sitting it any closer to centre
    // puts it behind the panel, where it reads as a smudge rather than a star.
    if (hero.current) {
      const portrait = state.size.width / state.size.height < 1
      hero.current.position.x = damp(hero.current.position.x, portrait ? 0 : 5.4, 4, delta)
      hero.current.position.y = damp(hero.current.position.y, portrait ? 4.2 : 3.3, 4, delta)
      hero.current.rotation.z += delta * 0.25
      hero.current.scale.setScalar(op * (1 + Math.sin(t * 1.6) * 0.06))
    }

    // shooting stars: each rides its lane, fading in and out across one pass
    if (grp.current) grp.current.visible = op > 0.02
    shotMat.opacity = op
    lanes.forEach((L, i) => {
      const s = shots.current[i]
      if (!s) return
      const k = ((t + L.offset) % L.period) / L.period // 0..1 across the lane
      // only the first 35% of the cycle is the streak; the rest is dark sky
      if (k > 0.35) {
        s.scale.setScalar(0)
        return
      }
      const u = k / 0.35
      const travel = -L.len / 2 + u * L.len
      s.position.set(travel, L.y - u * 1.4, L.z)
      s.rotation.z = L.angle
      // fade in fast, fade out slow
      const fade = Math.sin(u * Math.PI)
      s.scale.set(L.s * fade * 2.6, L.s * fade * 0.16, L.s * fade * 0.16)
    })
  })

  return (
    <>
      {/* the constellation — one instanced draw call */}
      <instancedMesh ref={field} args={[smallGeo, fieldMat, stars.length]} visible={false} />

      {/* the shooting stars live in their own group, away from anything
          that maps children[i] onto an array */}
      <group ref={grp} visible={false}>
        {lanes.map((L, i) => (
          <mesh key={i} ref={(el) => (shots.current[i] = el)} material={shotMat} scale={0}>
            <sphereGeometry args={[0.5, 12, 8]} />
          </mesh>
        ))}
      </group>

      <Float speed={1} rotationIntensity={0.1} floatIntensity={0.6}>
        <mesh ref={hero} geometry={heroGeo} material={heroMat} position={[3.2, 2.6, -0.5]} scale={0} />
      </Float>
    </>
  )
}

/* ── Cinematic camera ── */
function Rig({ reduced }) {
  useFrame((state, delta) => {
    const p = scrollState.progress
    const cam = state.camera
    // On portrait / narrow screens, pull the camera back so wide-spread elements
    // (the constellation, the corner star) stay on screen.
    const aspect = state.size.width / state.size.height
    const portraitBoost = aspect < 1 ? (1 / aspect - 1) * 4 : 0
    const tz = 6.5 + p * 5.5 + portraitBoost
    const ty = p * 1.6
    const tx = Math.sin(p * Math.PI) * 1.2 + state.pointer.x * 0.4
    const lift = state.pointer.y * 0.3
    if (reduced) {
      cam.position.set(tx, ty + lift, tz)
    } else {
      cam.position.x = damp(cam.position.x, tx, 3, delta)
      cam.position.y = damp(cam.position.y, ty + lift, 3, delta)
      cam.position.z = damp(cam.position.z, tz, 3, delta)
    }
    cam.lookAt(0, ty * 0.4, 0)
  })
  return null
}

export default function Scene({ reduced = false, mobile = false, opened = false, onCakeLand }) {
  return (
    <Canvas
      className="scene-canvas"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}
      dpr={mobile ? [1, 1.3] : [1, 1.75]}
      camera={{ position: [0, 0, 6.5], fov: 42 }}
      gl={{ antialias: true, alpha: !mobile, powerPreference: 'high-performance' }}
    >
      {/* On mobile the canvas is OPAQUE (solid bg) — a transparent fixed canvas
          composited with scrolling content flickers on mobile browsers. */}
      {mobile && <color attach="background" args={['#fdf4f8']} />}
      <fog attach="fog" args={['#fdf7fb', 11, 36]} />

      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 6, 5]} intensity={2.2} color="#fff2e4" />
      <pointLight position={[-5, -2, 3]} intensity={24} color="#ffc4dc" distance={20} />
      <pointLight position={[4, 3, -4]} intensity={20} color="#bfe4ff" distance={20} />
      <pointLight position={[0, 0.5, 2.5]} intensity={5} color="#ffe1ad" distance={9} />

      <DroppedCake play={opened} onLand={onCakeLand} />
      <CandlesAct />
      <LanternsAct count={mobile ? 11 : 18} />
      <StarsAct shooting={mobile ? 2 : 3} />
      <Balloons reduced={reduced} count={mobile ? 24 : 40} />
      <Confetti reduced={reduced} count={mobile ? 55 : 90} />
      <Sparkles count={160} scale={[20, 14, 10]} size={3} speed={0.25} color="#ffe6a3" opacity={0.75} />

      {/* A LOCAL environment. drei's `preset` prop would fetch an HDR from a CDN
          (raw.githack.com) — offline that leaves every metal surface black. These
          Lightformers are rendered into a cubemap in-engine: zero network. */}
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 5, -9]} scale={[12, 6, 1]} color="#fff3e0" />
        <Lightformer intensity={1.4} position={[-6, 1, 2]} scale={[6, 6, 1]} color="#ffd9e6" />
        <Lightformer intensity={1.2} position={[6, 2, 2]} scale={[6, 6, 1]} color="#cfe6ff" />
        <Lightformer intensity={1} position={[0, -5, 3]} scale={[10, 4, 1]} color="#fff6e8" />
      </Environment>

      <Rig reduced={reduced} />

      {/* Postprocessing only on desktop — the extra render pass over a transparent
          canvas is a flicker source on mobile, so we skip it there. */}
      {!mobile && (
        <EffectComposer disableNormalPass>
          <Bloom intensity={0.55} luminanceThreshold={0.75} luminanceSmoothing={0.3} mipmapBlur radius={0.7} />
          <Vignette eskil={false} offset={0.35} darkness={0.35} />
          <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.08} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
