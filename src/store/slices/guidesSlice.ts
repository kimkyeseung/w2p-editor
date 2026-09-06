import type { StoreApi } from 'zustand'
import type { EditorState } from '../types'
import { createId, pushHistory } from '../historyHelpers'

type Set = StoreApi<EditorState>['setState']

export type GuidesSlice = Pick<EditorState, 'addGuide' | 'updateGuide' | 'removeGuide' | 'clearGuides'>

export const createGuidesSlice = (set: Set): GuidesSlice => ({
  addGuide: (axis, position) => {
    set((state) => ({
      ...pushHistory(state),
      guides: [...state.guides, { id: createId(), axis, position }],
    }))
  },

  updateGuide: (id, position) => {
    set((state) => ({
      ...pushHistory(state),
      guides: state.guides.map((g) => (g.id === id ? { ...g, position } : g)),
    }))
  },

  removeGuide: (id) => {
    set((state) => ({
      ...pushHistory(state),
      guides: state.guides.filter((g) => g.id !== id),
    }))
  },

  clearGuides: () => {
    set((state) => ({ ...pushHistory(state), guides: [] }))
  },
})
