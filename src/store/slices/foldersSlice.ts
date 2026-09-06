// Layer-panel folder grouping — see the `folders` field comment on
// EditorState for why folders aren't a z-order concept.
import type { StoreApi } from 'zustand'
import type { EditorLayer } from '../../types/editor'
import type { EditorState } from '../types'
import { createId, pushHistory } from '../historyHelpers'

type Set = StoreApi<EditorState>['setState']

export type FoldersSlice = Pick<
  EditorState,
  | 'groupLayers'
  | 'ungroupLayer'
  | 'removeFolder'
  | 'renameFolder'
  | 'toggleFolderVisible'
  | 'toggleFolderLock'
  | 'toggleFolderCollapsed'
  | 'reorderFolder'
>

export const createFoldersSlice = (set: Set): FoldersSlice => ({
  groupLayers: (ids, name) => {
    if (ids.length === 0) return
    set((state) => {
      const idSet = new Set(ids)
      const members = state.layers.filter((l) => idSet.has(l.id))
      if (members.length === 0) return state

      // If the selection already touches exactly one existing folder, add
      // the rest of the selection to it instead of nesting a new one.
      const existingFolderIds = new Set(
        members.map((l) => l.folderId).filter((fid): fid is string => !!fid),
      )
      let folderId: string
      let folders = state.folders
      if (existingFolderIds.size === 1) {
        folderId = [...existingFolderIds][0]
      } else {
        folderId = createId()
        folders = [
          ...state.folders,
          { id: folderId, name: name || `그룹 ${state.folders.length + 1}`, locked: false, visible: true, collapsed: false },
        ]
      }

      // Move the whole selection into one contiguous block, keeping their
      // relative order, at the position the front-most selected layer
      // originally held (so grouping doesn't otherwise reshuffle the stack).
      const rest = state.layers.filter((l) => !idSet.has(l.id))
      let lastMemberIndex = -1
      state.layers.forEach((l, i) => {
        if (idSet.has(l.id)) lastMemberIndex = i
      })
      const insertPos = state.layers.slice(0, lastMemberIndex + 1).filter((l) => !idSet.has(l.id)).length
      const taggedMembers = state.layers.filter((l) => idSet.has(l.id)).map((l) => ({ ...l, folderId }))
      const layers = [...rest.slice(0, insertPos), ...taggedMembers, ...rest.slice(insertPos)]

      return { ...pushHistory(state), folders, layers }
    })
  },

  ungroupLayer: (id) => {
    set((state) => {
      const layer = state.layers.find((l) => l.id === id)
      if (!layer || !layer.folderId) return state
      const folderId = layer.folderId
      const remaining = state.layers.filter((l) => l.id !== id)
      // Reinsert right after the folder's remaining block (rather than
      // leaving it in place) so pulling a layer out of the middle of a
      // group never splits that group into two disjoint runs.
      let lastIndex = -1
      remaining.forEach((l, i) => {
        if (l.folderId === folderId) lastIndex = i
      })
      const updated: EditorLayer = { ...layer, folderId: undefined }
      const layers =
        lastIndex === -1
          ? [...remaining, updated]
          : [...remaining.slice(0, lastIndex + 1), updated, ...remaining.slice(lastIndex + 1)]
      return { ...pushHistory(state), layers }
    })
  },

  removeFolder: (id) => {
    set((state) => ({
      ...pushHistory(state),
      folders: state.folders.filter((f) => f.id !== id),
      layers: state.layers.map((l) => (l.folderId === id ? { ...l, folderId: undefined } : l)),
    }))
  },

  renameFolder: (id, name) => {
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }))
  },

  toggleFolderVisible: (id) => {
    set((state) => ({
      ...pushHistory(state),
      folders: state.folders.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f)),
    }))
  },

  toggleFolderLock: (id) => {
    set((state) => ({
      ...pushHistory(state),
      folders: state.folders.map((f) => (f.id === id ? { ...f, locked: !f.locked } : f)),
    }))
  },

  toggleFolderCollapsed: (id) => {
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)),
    }))
  },

  reorderFolder: (id, direction) => {
    set((state) => {
      const members = state.layers.filter((l) => l.folderId === id)
      if (members.length === 0) return state
      const rest = state.layers.filter((l) => l.folderId !== id)
      const layers = direction === 'front' ? [...rest, ...members] : [...members, ...rest]
      return { ...pushHistory(state), layers }
    })
  },
})
