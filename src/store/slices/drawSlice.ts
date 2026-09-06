// Freehand drawing tool selection/color/width. The stroke itself becomes a
// normal layer once finished — see addPathLayer in layerCrudSlice.
import type { StoreApi } from 'zustand'
import type { EditorState } from '../types'

type Set = StoreApi<EditorState>['setState']

export type DrawSlice = Pick<
  EditorState,
  'drawMode' | 'drawColor' | 'drawWidth' | 'setDrawMode' | 'setDrawColor' | 'setDrawWidth'
>

export const createDrawSlice = (set: Set): DrawSlice => ({
  drawMode: 'none',
  drawColor: '#111827',
  drawWidth: 4,

  setDrawMode: (mode) => set({ drawMode: mode }),
  setDrawColor: (color) => set({ drawColor: color }),
  setDrawWidth: (width) => set({ drawWidth: Math.max(1, width) }),
})
