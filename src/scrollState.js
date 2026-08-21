// A plain module-level store for scroll state.
// The 3D scene reads this every frame inside useFrame — NOT via React state —
// so scrolling never triggers re-renders (the key to a buttery feel).
export const scrollState = {
  progress: 0, // 0..1 over the whole page
  velocity: 0, // signed scroll velocity from Lenis
  act: 'hero', // which section is in view: hero | cake | party | gifts
}

// Section-window helpers. `from` and `distance` are in 0..1 page units.
export function range(from, distance, margin = 0) {
  const p = scrollState.progress
  const start = from - margin
  const end = start + distance + margin * 2
  if (p < start) return 0
  if (p > end) return 1
  return (p - start) / (end - start)
}

// 0 at the edges of the window, peaks at 1 in the middle — great for fades.
export function curve(from, distance, margin = 0) {
  return Math.sin(range(from, distance, margin) * Math.PI)
}
