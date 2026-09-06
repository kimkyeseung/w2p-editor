// Shared by every slice that mutates document content (which is most of
// them) — see the `past`/`future` fields on EditorState.
import type { EditorState, HistoryEntry } from './types'

export const MAX_HISTORY = 50

export const createId = () =>
  `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const snapshotOf = (state: EditorState): HistoryEntry => ({
  layers: state.layers,
  folders: state.folders,
  guides: state.guides,
  selectedId: state.selectedId,
  selectedIds: state.selectedIds,
  presetId: state.presetId,
})

// Spread into every set() call that changes document content: `{
// ...pushHistory(state), layers: nextLayers }`. Records the state as it was
// *before* this change (for undo) and marks the document dirty.
export const pushHistory = (state: EditorState): Pick<EditorState, 'past' | 'future' | 'dirty'> => ({
  past: [...state.past, snapshotOf(state)].slice(-MAX_HISTORY),
  future: [],
  dirty: true,
})
