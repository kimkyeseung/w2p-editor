// Pure zoom/ruler/viewport math — presentation concerns that never touch
// Fabric's own coordinate system (see fabricObjects.ts for that side).
import { mmToPx } from '../../utils/presets'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
export const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
export const VIEWPORT_PADDING = 64 // matches .canvas-wrap's CSS padding (2rem each side)

export const RULER_SIZE = 20 // px, matches .ruler's thickness in Canvas.css

// Picks the smallest mm interval (from a fixed set of "nice" values) whose
// on-screen spacing at the current zoom is still readable — re-picked on
// every render rather than memoized, since it only depends on `zoom`.
const TICK_INTERVALS_MM = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]
const MIN_TICK_SPACING_PX = 40
export const pickTickIntervalMm = (zoomLevel: number) => {
  for (const mm of TICK_INTERVALS_MM) {
    if (mmToPx(mm) * zoomLevel >= MIN_TICK_SPACING_PX) return mm
  }
  return TICK_INTERVALS_MM[TICK_INTERVALS_MM.length - 1]
}

export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}
