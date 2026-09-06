import type { StoreApi } from 'zustand'
import type { EditorState } from '../types'

type Set = StoreApi<EditorState>['setState']

export type SelectionSlice = Pick<EditorState, 'selectLayer' | 'selectLayers' | 'toggleSelectLayer'>

export const createSelectionSlice = (set: Set): SelectionSlice => ({
  selectLayer: (id) => {
    set({ selectedId: id, selectedIds: id ? [id] : [] })
  },

  selectLayers: (ids) => {
    set({ selectedId: ids.length === 1 ? ids[0] : null, selectedIds: ids })
  },

  toggleSelectLayer: (id) => {
    set((state) => {
      const nextIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id]
      return { selectedId: nextIds.length === 1 ? nextIds[0] : null, selectedIds: nextIds }
    })
  },
})
