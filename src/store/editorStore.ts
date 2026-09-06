// The store itself is just this combinator — every action lives in one of
// the `slices/` files, grouped by concern (layer CRUD, layer style, align,
// selection, folders, guides, draw mode, recent colors, document/history).
// Only `layers`/`folders`/`guides`/`selectedId`/`selectedIds`/`presetId`/
// `past`/`future`/`dirty` are declared here directly — they're touched by
// enough different slices that no single one of them should own the
// default. See types.ts for the full EditorState contract.
import { create } from 'zustand'
import { DEFAULT_PRESET_ID } from '../utils/presets'
import type { EditorState } from './types'
import { createAlignSlice } from './slices/alignSlice'
import { createColorsSlice } from './slices/colorsSlice'
import { createDocumentSlice } from './slices/documentSlice'
import { createDrawSlice } from './slices/drawSlice'
import { createFoldersSlice } from './slices/foldersSlice'
import { createGuidesSlice } from './slices/guidesSlice'
import { createLayerCrudSlice } from './slices/layerCrudSlice'
import { createLayerStyleSlice } from './slices/layerStyleSlice'
import { createSelectionSlice } from './slices/selectionSlice'

export type { DrawMode } from './types'

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: [],
  folders: [],
  guides: [],
  selectedId: null,
  selectedIds: [],
  presetId: DEFAULT_PRESET_ID,
  past: [],
  future: [],
  dirty: false,

  ...createLayerCrudSlice(set, get),
  ...createLayerStyleSlice(set),
  ...createAlignSlice(set),
  ...createSelectionSlice(set),
  ...createFoldersSlice(set),
  ...createGuidesSlice(set),
  ...createDrawSlice(set),
  ...createColorsSlice(set),
  ...createDocumentSlice(set, get),
}))
