// Align-to-canvas, align-to-selection, and even-gap distribution.
import type { StoreApi } from 'zustand'
import type { EditorLayer } from '../../types/editor'
import type { EditorState } from '../types'
import { getPresetById, mmToPx } from '../../utils/presets'
import { pushHistory } from '../historyHelpers'

type Set = StoreApi<EditorState>['setState']
type Alignment = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'

export type AlignSlice = Pick<EditorState, 'alignLayer' | 'alignLayers' | 'alignLayersToCanvas' | 'distributeLayers'>

// Shared by alignLayer (one layer) and alignLayersToCanvas (each layer in a
// multi-selection independently) — every other layer's position is
// irrelevant here, unlike alignLayers' align-to-selection.
const alignToCanvas = (layer: EditorLayer, alignment: Alignment, canvasWidth: number, canvasHeight: number) => {
  let { x, y } = layer
  if (alignment === 'left') x = 0
  else if (alignment === 'center-x') x = (canvasWidth - layer.width) / 2
  else if (alignment === 'right') x = canvasWidth - layer.width
  else if (alignment === 'top') y = 0
  else if (alignment === 'center-y') y = (canvasHeight - layer.height) / 2
  else if (alignment === 'bottom') y = canvasHeight - layer.height
  return { x, y }
}

export const createAlignSlice = (set: Set): AlignSlice => ({
  alignLayer: (id, alignment) => {
    set((state) => {
      const layer = state.layers.find((l) => l.id === id)
      if (!layer) return state
      const preset = getPresetById(state.presetId)
      const canvasWidth = mmToPx(preset.widthMm + preset.bleedMm * 2)
      const canvasHeight = mmToPx(preset.heightMm + preset.bleedMm * 2)
      const { x, y } = alignToCanvas(layer, alignment, canvasWidth, canvasHeight)

      return {
        ...pushHistory(state),
        layers: state.layers.map((l) => (l.id === id ? { ...l, x, y } : l)),
      }
    })
  },

  alignLayersToCanvas: (ids, alignment) => {
    if (ids.length === 0) return
    set((state) => {
      const idSet = new Set(ids)
      if (!state.layers.some((l) => idSet.has(l.id))) return state
      const preset = getPresetById(state.presetId)
      const canvasWidth = mmToPx(preset.widthMm + preset.bleedMm * 2)
      const canvasHeight = mmToPx(preset.heightMm + preset.bleedMm * 2)

      return {
        ...pushHistory(state),
        layers: state.layers.map((l) =>
          idSet.has(l.id) ? { ...l, ...alignToCanvas(l, alignment, canvasWidth, canvasHeight) } : l,
        ),
      }
    })
  },

  alignLayers: (ids, alignment) => {
    if (ids.length < 2) return
    set((state) => {
      const idSet = new Set(ids)
      const selected = state.layers.filter((l) => idSet.has(l.id))
      if (selected.length < 2) return state

      const minX = Math.min(...selected.map((l) => l.x))
      const maxRight = Math.max(...selected.map((l) => l.x + l.width))
      const minY = Math.min(...selected.map((l) => l.y))
      const maxBottom = Math.max(...selected.map((l) => l.y + l.height))

      return {
        ...pushHistory(state),
        layers: state.layers.map((l) => {
          if (!idSet.has(l.id)) return l
          let { x, y } = l
          if (alignment === 'left') x = minX
          else if (alignment === 'center-x') x = (minX + maxRight) / 2 - l.width / 2
          else if (alignment === 'right') x = maxRight - l.width
          else if (alignment === 'top') y = minY
          else if (alignment === 'center-y') y = (minY + maxBottom) / 2 - l.height / 2
          else if (alignment === 'bottom') y = maxBottom - l.height
          return { ...l, x, y }
        }),
      }
    })
  },

  distributeLayers: (ids, axis) => {
    if (ids.length < 3) return
    set((state) => {
      const idSet = new Set(ids)
      const selected = state.layers.filter((l) => idSet.has(l.id))
      if (selected.length < 3) return state

      const posKey = axis === 'horizontal' ? 'x' : 'y'
      const sizeKey = axis === 'horizontal' ? 'width' : 'height'
      const sorted = [...selected].sort((a, b) => a[posKey] - b[posKey])
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSize = sorted.reduce((sum, l) => sum + l[sizeKey], 0)
      const span = last[posKey] + last[sizeKey] - first[posKey]
      const gap = (span - totalSize) / (sorted.length - 1)

      const nextPos = new Map<string, number>()
      let cursor = first[posKey]
      sorted.forEach((l) => {
        nextPos.set(l.id, cursor)
        cursor += l[sizeKey] + gap
      })

      return {
        ...pushHistory(state),
        layers: state.layers.map((l) =>
          nextPos.has(l.id) ? { ...l, [posKey]: nextPos.get(l.id)! } : l,
        ),
      }
    })
  },
})
