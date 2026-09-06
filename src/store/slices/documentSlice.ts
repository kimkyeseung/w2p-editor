// Document-level operations: preset switching, full replace (load/import),
// save-state tracking, and undo/redo history navigation.
import type { StoreApi } from 'zustand'
import type { EditorState } from '../types'
import { MAX_HISTORY, pushHistory } from '../historyHelpers'

type Set = StoreApi<EditorState>['setState']
type Get = StoreApi<EditorState>['getState']

export type DocumentSlice = Pick<EditorState, 'setPreset' | 'replaceAll' | 'markSaved' | 'undo' | 'redo'>

export const createDocumentSlice = (set: Set, get: Get): DocumentSlice => ({
  setPreset: (presetId) => {
    set((state) => ({ ...pushHistory(state), presetId }))
  },

  replaceAll: (layers, presetId, folders = []) => {
    set((state) => ({
      ...pushHistory(state),
      layers,
      folders,
      guides: [],
      presetId,
      selectedId: null,
      selectedIds: [],
      // Overrides pushHistory's dirty: true — loading fresh content matches
      // what's on disk/in the API by definition, so it isn't "unsaved".
      dirty: false,
    }))
  },

  markSaved: () => {
    set({ dirty: false })
  },

  undo: () => {
    const { past, layers, folders, guides, selectedId, selectedIds, presetId, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      layers: previous.layers,
      folders: previous.folders,
      guides: previous.guides,
      selectedId: previous.selectedId,
      selectedIds: previous.selectedIds,
      presetId: previous.presetId,
      past: past.slice(0, -1),
      future: [{ layers, folders, guides, selectedId, selectedIds, presetId }, ...future].slice(0, MAX_HISTORY),
      dirty: true,
    })
  },

  redo: () => {
    const { future, layers, folders, guides, selectedId, selectedIds, presetId, past } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      layers: next.layers,
      folders: next.folders,
      guides: next.guides,
      selectedId: next.selectedId,
      selectedIds: next.selectedIds,
      presetId: next.presetId,
      future: future.slice(1),
      past: [...past, { layers, folders, guides, selectedId, selectedIds, presetId }].slice(-MAX_HISTORY),
      dirty: true,
    })
  },
})
