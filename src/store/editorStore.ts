import { create } from 'zustand'
import type {
  EditorLayer,
  ImageLayer,
  LayerFolder,
  LayerShadow,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from '../types/editor'
import { DEFAULT_PRESET_ID, getPresetById, mmToPx } from '../utils/presets'

interface HistoryEntry {
  layers: EditorLayer[]
  folders: LayerFolder[]
  selectedId: string | null
  selectedIds: string[]
  presetId: string
}

interface EditorState {
  layers: EditorLayer[]
  // Folders are a layer-panel-only grouping concept — they have no z-order
  // slot of their own (see the folderId comment on LayerBase) and never
  // reach Canvas.tsx as Fabric objects. Collapsed state is deliberately
  // excluded from undo history (see toggleFolderCollapsed) since it's a
  // panel view preference, not document content.
  folders: LayerFolder[]
  // `selectedId` is kept as the "primary" selection (set whenever exactly
  // one layer is selected) so existing single-object UI — the properties
  // panel's field editing, canvas.setActiveObject — doesn't need to branch
  // on multi-select. `selectedIds` is the full set for multi-select-aware
  // UI (layer panel highlighting, batch delete/duplicate).
  selectedId: string | null
  selectedIds: string[]
  presetId: string
  past: HistoryEntry[]
  future: HistoryEntry[]

  setPreset: (presetId: string) => void
  addTextLayer: () => void
  addImageLayer: (src: string, width: number, height: number) => void
  addShapeLayer: (shape: ShapeKind) => void
  updateLayerTransform: (
    id: string,
    transform: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity'>>,
  ) => void
  updateLayerShadow: (id: string, shadow: Partial<LayerShadow>) => void
  updateTextStyle: (id: string, style: Partial<Omit<TextLayer, keyof EditorLayer | 'type'>>) => void
  updateShapeStyle: (id: string, style: Partial<Omit<ShapeLayer, keyof EditorLayer | 'type' | 'shape'>>) => void
  // Fabric fires one `object:modified` event for both a transform drag AND
  // Fabric's own inline text-editing (double-click on the canvas) — this
  // applies both in one history entry so canvas-driven edits aren't lost
  // the next time the store re-syncs the object from stale layer data.
  applyCanvasModification: (
    id: string,
    patch: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>> & { text?: string },
  ) => void
  renameLayer: (id: string, name: string) => void
  removeLayer: (id: string) => void
  removeLayers: (ids: string[]) => void
  duplicateLayer: (id: string) => void
  duplicateLayers: (ids: string[]) => void
  toggleLock: (id: string) => void
  toggleVisible: (id: string) => void
  reorderLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
  alignLayer: (id: string, alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  selectLayer: (id: string | null) => void
  selectLayers: (ids: string[]) => void
  toggleSelectLayer: (id: string) => void
  // Groups the given layers into a folder. If exactly one of them already
  // belongs to a folder, the rest join that folder instead of a new one
  // being created — lets "group selection" double as "add to this folder".
  groupLayers: (ids: string[], name?: string) => void
  ungroupLayer: (id: string) => void
  removeFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
  toggleFolderVisible: (id: string) => void
  toggleFolderLock: (id: string) => void
  // Deliberately not undo-tracked (see the `folders` field comment).
  toggleFolderCollapsed: (id: string) => void
  reorderFolder: (id: string, direction: 'front' | 'back') => void
  replaceAll: (layers: EditorLayer[], presetId: string, folders?: LayerFolder[]) => void
  undo: () => void
  redo: () => void
}

const MAX_HISTORY = 50

const createId = () =>
  `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const snapshotOf = (state: EditorState): HistoryEntry => ({
  layers: state.layers,
  folders: state.folders,
  selectedId: state.selectedId,
  selectedIds: state.selectedIds,
  presetId: state.presetId,
})

const pushHistory = (state: EditorState): Pick<EditorState, 'past' | 'future'> => ({
  past: [...state.past, snapshotOf(state)].slice(-MAX_HISTORY),
  future: [],
})

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: [],
  folders: [],
  selectedId: null,
  selectedIds: [],
  presetId: DEFAULT_PRESET_ID,
  past: [],
  future: [],

  setPreset: (presetId) => {
    set((state) => ({ ...pushHistory(state), presetId }))
  },

  addTextLayer: () => {
    const id = createId()
    const newLayer: TextLayer = {
      id,
      type: 'text',
      name: `텍스트 ${get().layers.filter((l) => l.type === 'text').length + 1}`,
      locked: false,
      visible: true,
      x: 40,
      y: 40,
      width: 200,
      height: 28,
      rotation: 0,
      opacity: 1,
      shadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5 },
      text: '텍스트를 입력하세요',
      fontFamily: 'Noto Sans KR',
      fontSize: 24,
      color: '#111111',
      align: 'left',
      fontWeight: 'normal',
      fontStyle: 'normal',
      charSpacing: 0,
      lineHeight: 1.16,
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, newLayer],
      selectedId: id,
      selectedIds: [id],
    }))
  },

  addImageLayer: (src, width, height) => {
    const id = createId()
    const newLayer: ImageLayer = {
      id,
      type: 'image',
      name: `이미지 ${get().layers.filter((l) => l.type === 'image').length + 1}`,
      locked: false,
      visible: true,
      x: 40,
      y: 40,
      width,
      height,
      rotation: 0,
      opacity: 1,
      shadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5 },
      src,
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, newLayer],
      selectedId: id,
      selectedIds: [id],
    }))
  },

  addShapeLayer: (shape) => {
    const id = createId()
    const defaultSize: Record<ShapeKind, { width: number; height: number }> = {
      rectangle: { width: 160, height: 100 },
      ellipse: { width: 120, height: 120 },
      triangle: { width: 120, height: 100 },
      line: { width: 160, height: 0 },
    }
    const label: Record<ShapeKind, string> = {
      rectangle: '사각형',
      ellipse: '타원',
      triangle: '삼각형',
      line: '선',
    }
    const { width, height } = defaultSize[shape]
    const newLayer: ShapeLayer = {
      id,
      type: 'shape',
      shape,
      name: `${label[shape]} ${get().layers.filter((l) => l.type === 'shape' && l.shape === shape).length + 1}`,
      locked: false,
      visible: true,
      x: 40,
      y: 40,
      width,
      height,
      rotation: 0,
      opacity: 1,
      shadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5 },
      fill: '#e5e7eb',
      stroke: '#111827',
      strokeWidth: 2,
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, newLayer],
      selectedId: id,
      selectedIds: [id],
    }))
  },

  updateLayerTransform: (id, transform) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, ...transform } : layer,
      ),
    }))
  },

  updateLayerShadow: (id, shadow) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, shadow: { ...layer.shadow, ...shadow } } : layer,
      ),
    }))
  },

  applyCanvasModification: (id, patch) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) => {
        if (layer.id !== id) return layer
        const { text, ...transform } = patch
        return layer.type === 'text' && text !== undefined
          ? { ...layer, ...transform, text }
          : { ...layer, ...transform }
      }),
    }))
  },

  updateTextStyle: (id, style) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id && layer.type === 'text' ? { ...layer, ...style } : layer,
      ),
    }))
  },

  updateShapeStyle: (id, style) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id && layer.type === 'shape' ? { ...layer, ...style } : layer,
      ),
    }))
  },

  renameLayer: (id, name) => {
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === id ? { ...layer, name } : layer)),
    }))
  },

  removeLayer: (id) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.filter((layer) => layer.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    }))
  },

  removeLayers: (ids) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.filter((layer) => !idSet.has(layer.id)),
      selectedId: null,
      selectedIds: [],
    }))
  },

  duplicateLayer: (id) => {
    set((state) => {
      const index = state.layers.findIndex((layer) => layer.id === id)
      if (index === -1) return state
      const source = state.layers[index]
      const newId = createId()
      const clone: EditorLayer = {
        ...source,
        id: newId,
        name: `${source.name} 사본`,
        x: source.x + 16,
        y: source.y + 16,
      }
      // Insert right after the source (rather than appending at the very
      // front of the stack) so a clone of a grouped layer stays inside its
      // folder's contiguous block instead of breaking it out.
      const layers = [...state.layers]
      layers.splice(index + 1, 0, clone)
      return { ...pushHistory(state), layers, selectedId: newId, selectedIds: [newId] }
    })
  },

  duplicateLayers: (ids) => {
    if (ids.length === 0) return
    set((state) => {
      const idSet = new Set(ids)
      const layers = [...state.layers]
      const newIds: string[] = []
      // Walk back-to-front so each splice only shifts indices we've already
      // processed, keeping every remaining source index valid.
      for (let i = layers.length - 1; i >= 0; i--) {
        if (!idSet.has(layers[i].id)) continue
        const source = layers[i]
        const newId = createId()
        const clone: EditorLayer = {
          ...source,
          id: newId,
          name: `${source.name} 사본`,
          x: source.x + 16,
          y: source.y + 16,
        }
        layers.splice(i + 1, 0, clone)
        newIds.push(newId)
      }
      newIds.reverse()
      return {
        ...pushHistory(state),
        layers,
        selectedId: newIds.length === 1 ? newIds[0] : null,
        selectedIds: newIds,
      }
    })
  },

  toggleLock: (id) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, locked: !layer.locked } : layer,
      ),
    }))
  },

  toggleVisible: (id) => {
    set((state) => {
      const layer = state.layers.find((l) => l.id === id)
      if (!layer) return state
      const nextVisible = !(layer.visible !== false)
      const stillSelected = nextVisible || state.selectedId !== id
      return {
        ...pushHistory(state),
        layers: state.layers.map((l) => (l.id === id ? { ...l, visible: nextVisible } : l)),
        selectedId: stillSelected ? state.selectedId : null,
        selectedIds: stillSelected ? state.selectedIds : state.selectedIds.filter((sid) => sid !== id),
      }
    })
  },

  reorderLayer: (id, direction) => {
    set((state) => {
      const index = state.layers.findIndex((layer) => layer.id === id)
      if (index === -1) return state
      const layers = [...state.layers]
      const [item] = layers.splice(index, 1)
      if (direction === 'front') layers.push(item)
      else if (direction === 'back') layers.unshift(item)
      else if (direction === 'forward') layers.splice(Math.min(index + 1, layers.length), 0, item)
      else layers.splice(Math.max(index - 1, 0), 0, item)
      return { ...pushHistory(state), layers }
    })
  },

  alignLayer: (id, alignment) => {
    set((state) => {
      const layer = state.layers.find((l) => l.id === id)
      if (!layer) return state
      const preset = getPresetById(state.presetId)
      const canvasWidth = mmToPx(preset.widthMm + preset.bleedMm * 2)
      const canvasHeight = mmToPx(preset.heightMm + preset.bleedMm * 2)

      let { x, y } = layer
      if (alignment === 'left') x = 0
      else if (alignment === 'center-x') x = (canvasWidth - layer.width) / 2
      else if (alignment === 'right') x = canvasWidth - layer.width
      else if (alignment === 'top') y = 0
      else if (alignment === 'center-y') y = (canvasHeight - layer.height) / 2
      else if (alignment === 'bottom') y = canvasHeight - layer.height

      return {
        ...pushHistory(state),
        layers: state.layers.map((l) => (l.id === id ? { ...l, x, y } : l)),
      }
    })
  },

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

  replaceAll: (layers, presetId, folders = []) => {
    set((state) => ({
      ...pushHistory(state),
      layers,
      folders,
      presetId,
      selectedId: null,
      selectedIds: [],
    }))
  },

  undo: () => {
    const { past, layers, folders, selectedId, selectedIds, presetId, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      layers: previous.layers,
      folders: previous.folders,
      selectedId: previous.selectedId,
      selectedIds: previous.selectedIds,
      presetId: previous.presetId,
      past: past.slice(0, -1),
      future: [{ layers, folders, selectedId, selectedIds, presetId }, ...future].slice(0, MAX_HISTORY),
    })
  },

  redo: () => {
    const { future, layers, folders, selectedId, selectedIds, presetId, past } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      layers: next.layers,
      folders: next.folders,
      selectedId: next.selectedId,
      selectedIds: next.selectedIds,
      presetId: next.presetId,
      future: future.slice(1),
      past: [...past, { layers, folders, selectedId, selectedIds, presetId }].slice(-MAX_HISTORY),
    })
  },
}))
