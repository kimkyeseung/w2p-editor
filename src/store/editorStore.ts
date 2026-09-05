import { create } from 'zustand'
import type {
  EditorGuide,
  EditorLayer,
  ImageLayer,
  LayerBorder,
  LayerFolder,
  LayerGradient,
  LayerShadow,
  PathCommand,
  PathLayer,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from '../types/editor'
import { DEFAULT_PRESET_ID, getPresetById, mmToPx } from '../utils/presets'

const RECENT_COLORS_KEY = 'w2p-recent-colors'
const MAX_RECENT_COLORS = 12

export type DrawMode = 'none' | 'pencil' | 'circle' | 'spray'

const loadRecentColors = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveRecentColors = (colors: string[]) => {
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors))
  } catch {
    // Private browsing / storage full — swatches just won't persist.
  }
}

interface HistoryEntry {
  layers: EditorLayer[]
  folders: LayerFolder[]
  guides: EditorGuide[]
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
  // User-placed ruler guides (see the EditorGuide comment) — undoable within
  // a session like any other document edit, but session-only scaffolding:
  // not persisted with save/load or the project API, and reset whenever a
  // project is loaded via replaceAll.
  guides: EditorGuide[]
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
  // Shared across every color picker in the app and persisted to
  // localStorage — a UI convenience, not document content, so it's
  // excluded from undo history (same reasoning as toggleFolderCollapsed).
  recentColors: string[]
  // Illustrator-style "Transform Again" (Cmd/Ctrl+D): the most recent
  // canvas-driven move/rotate delta, replayable on whatever is selected
  // later. Deliberately excludes scale/resize — only move and rotate are in
  // scope — and is meta-state about the editing session rather than
  // document content, so it's excluded from undo history.
  lastTransform: { dx: number; dy: number; dRotation: number } | null
  // Freehand drawing tool state — which brush is active (if any) and its
  // current color/width. Meta-state about the editing session rather than
  // document content (same reasoning as `lastTransform`), so it's excluded
  // from undo history and not persisted; a stroke itself becomes a normal
  // undoable PathLayer once drawn (see addPathLayer).
  drawMode: DrawMode
  drawColor: string
  drawWidth: number

  setPreset: (presetId: string) => void
  addTextLayer: () => void
  addImageLayer: (src: string, width: number, height: number) => void
  addShapeLayer: (shape: ShapeKind) => void
  setDrawMode: (mode: DrawMode) => void
  setDrawColor: (color: string) => void
  setDrawWidth: (width: number) => void
  // Commits one finished freehand stroke (Fabric's `path:created`) as a new
  // layer — `path` is the raw command array straight off the Fabric object,
  // and the geometry is its on-canvas bounding box (see Canvas.tsx).
  addPathLayer: (
    path: PathCommand[],
    geometry: { x: number; y: number; width: number; height: number },
    style: { stroke: string; strokeWidth: number },
  ) => void
  updatePathStyle: (id: string, style: Partial<Pick<PathLayer, 'stroke' | 'strokeWidth' | 'fill'>>) => void
  updateLayerTransform: (
    id: string,
    transform: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'blendMode'>>,
  ) => void
  updateLayerShadow: (id: string, shadow: Partial<LayerShadow>) => void
  updateLayerBorder: (id: string, border: Partial<LayerBorder>) => void
  flipLayer: (id: string, axis: 'horizontal' | 'vertical') => void
  addRecentColor: (color: string) => void
  updateTextStyle: (id: string, style: Partial<Omit<TextLayer, keyof EditorLayer | 'type'>>) => void
  updateShapeStyle: (id: string, style: Partial<Omit<ShapeLayer, keyof EditorLayer | 'type' | 'shape'>>) => void
  updateShapeGradient: (id: string, gradient: Partial<LayerGradient>) => void
  // Fabric fires one `object:modified` event for both a transform drag AND
  // Fabric's own inline text-editing (double-click on the canvas) — this
  // applies both in one history entry so canvas-driven edits aren't lost
  // the next time the store re-syncs the object from stale layer data.
  applyCanvasModification: (
    id: string,
    patch: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>> & { text?: string },
  ) => void
  // Reapplies `lastTransform` to every currently selected layer, in one
  // undo step. A no-op with nothing recorded yet or nothing selected.
  repeatLastTransform: () => void
  renameLayer: (id: string, name: string) => void
  removeLayer: (id: string) => void
  removeLayers: (ids: string[]) => void
  duplicateLayer: (id: string) => void
  duplicateLayers: (ids: string[]) => void
  // Flatten/merge: swaps every given layer for one new rasterized image
  // layer in a single step (Canvas.tsx does the actual rendering — this
  // just commits the result). Inserted where the topmost merged layer sat,
  // joining its folder if every merged layer shared the same one.
  replaceLayersWithImage: (
    ids: string[],
    image: { src: string; x: number; y: number; width: number; height: number },
  ) => void
  toggleLock: (id: string) => void
  toggleVisible: (id: string) => void
  reorderLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
  // Uses `maskId`'s shape to clip `targetId`'s visible content (a Fabric
  // clipPath), set by dragging one layer panel row onto another. The mask
  // layer can't be an image (Canvas.tsx builds the clip shape synchronously
  // every render pass, and image layers load asynchronously). Repositions
  // the mask to sit directly above the target in z-order, joining the
  // target's folder if any, to keep that folder's contiguous-run invariant
  // intact.
  setClipMask: (maskId: string, targetId: string) => void
  removeClipMask: (targetId: string) => void
  alignLayer: (id: string, alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  // Illustrator-style "align to selection" (as opposed to alignLayer's
  // align-to-canvas): positions every given layer relative to the
  // combined bounding box of the whole set, not the artboard.
  alignLayers: (ids: string[], alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  // Equalizes the gaps between adjacent layers' bounding boxes along one
  // axis, keeping the first and last (by position) fixed — needs 3+ layers
  // to mean anything, since 2 layers have only a single gap to equalize.
  distributeLayers: (ids: string[], axis: 'horizontal' | 'vertical') => void
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
  addGuide: (axis: 'horizontal' | 'vertical', position: number) => void
  updateGuide: (id: string, position: number) => void
  removeGuide: (id: string) => void
  clearGuides: () => void
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
  guides: state.guides,
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
  guides: [],
  selectedId: null,
  selectedIds: [],
  presetId: DEFAULT_PRESET_ID,
  past: [],
  future: [],
  recentColors: loadRecentColors(),
  lastTransform: null,
  drawMode: 'none',
  drawColor: '#111827',
  drawWidth: 4,

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
      border: { enabled: false, color: '#000000', width: 2 },
      flipX: false,
      flipY: false,
      blendMode: 'source-over',
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
      border: { enabled: false, color: '#000000', width: 2 },
      flipX: false,
      flipY: false,
      blendMode: 'source-over',
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
      border: { enabled: false, color: '#000000', width: 2 },
      flipX: false,
      flipY: false,
      blendMode: 'source-over',
      fill: '#e5e7eb',
      gradient: { enabled: false, type: 'linear', angle: 90, colorStops: ['#2563eb', '#e5e7eb'] },
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

  setDrawMode: (mode) => set({ drawMode: mode }),
  setDrawColor: (color) => set({ drawColor: color }),
  setDrawWidth: (width) => set({ drawWidth: Math.max(1, width) }),

  addPathLayer: (path, geometry, style) => {
    const id = createId()
    const newLayer: PathLayer = {
      id,
      type: 'path',
      name: `그리기 ${get().layers.filter((l) => l.type === 'path').length + 1}`,
      locked: false,
      visible: true,
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      rotation: 0,
      opacity: 1,
      shadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5 },
      border: { enabled: false, color: '#000000', width: 2 },
      flipX: false,
      flipY: false,
      blendMode: 'source-over',
      path,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      fill: '',
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, newLayer],
      selectedId: id,
      selectedIds: [id],
    }))
  },

  updatePathStyle: (id, style) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id && layer.type === 'path' ? { ...layer, ...style } : layer,
      ),
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

  updateLayerBorder: (id, border) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, border: { ...layer.border, ...border } } : layer,
      ),
    }))
  },

  flipLayer: (id, axis) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id
          ? axis === 'horizontal'
            ? { ...layer, flipX: !layer.flipX }
            : { ...layer, flipY: !layer.flipY }
          : layer,
      ),
    }))
  },

  applyCanvasModification: (id, patch) => {
    set((state) => {
      const layer = state.layers.find((l) => l.id === id)
      // Fabric fires object:modified for a finished inline text edit too,
      // where x/y/rotation are read back unchanged — only overwrite
      // lastTransform when something actually moved or rotated, so an
      // unrelated text edit can't silently erase a move/rotate the user is
      // about to repeat with Cmd/Ctrl+D.
      const dx = layer && patch.x !== undefined ? patch.x - layer.x : 0
      const dy = layer && patch.y !== undefined ? patch.y - layer.y : 0
      const dRotation = layer && patch.rotation !== undefined ? patch.rotation - layer.rotation : 0
      const lastTransform =
        dx !== 0 || dy !== 0 || dRotation !== 0 ? { dx, dy, dRotation } : state.lastTransform

      return {
        ...pushHistory(state),
        lastTransform,
        layers: state.layers.map((l) => {
          if (l.id !== id) return l
          const { text, ...transform } = patch
          return l.type === 'text' && text !== undefined ? { ...l, ...transform, text } : { ...l, ...transform }
        }),
      }
    })
  },

  repeatLastTransform: () => {
    set((state) => {
      const { lastTransform, selectedIds } = state
      if (!lastTransform || selectedIds.length === 0) return state
      const idSet = new Set(selectedIds)
      return {
        ...pushHistory(state),
        layers: state.layers.map((l) =>
          idSet.has(l.id)
            ? {
                ...l,
                x: l.x + lastTransform.dx,
                y: l.y + lastTransform.dy,
                rotation: l.rotation + lastTransform.dRotation,
              }
            : l,
        ),
      }
    })
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

  updateShapeGradient: (id, gradient) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((layer) =>
        layer.id === id && layer.type === 'shape'
          ? { ...layer, gradient: { ...layer.gradient, ...gradient } }
          : layer,
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

  replaceLayersWithImage: (ids, image) => {
    if (ids.length === 0) return
    set((state) => {
      const idSet = new Set(ids)
      const merged = state.layers.filter((l) => idSet.has(l.id))
      if (merged.length === 0) return state

      let topmostIndex = -1
      state.layers.forEach((l, i) => {
        if (idSet.has(l.id)) topmostIndex = i
      })
      const remaining = state.layers.filter((l) => !idSet.has(l.id))
      const insertAt = state.layers.slice(0, topmostIndex + 1).filter((l) => !idSet.has(l.id)).length

      const folderIds = new Set(merged.map((l) => l.folderId))
      const folderId = folderIds.size === 1 ? [...folderIds][0] : undefined

      const newId = createId()
      const newLayer: ImageLayer = {
        id: newId,
        type: 'image',
        name: `병합 이미지 ${state.layers.filter((l) => l.type === 'image').length + 1}`,
        locked: false,
        visible: true,
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        rotation: 0,
        opacity: 1,
        shadow: { enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5 },
        border: { enabled: false, color: '#000000', width: 2 },
        flipX: false,
        flipY: false,
        blendMode: 'source-over',
        src: image.src,
        folderId,
      }
      const layers = [...remaining.slice(0, insertAt), newLayer, ...remaining.slice(insertAt)]
      return { ...pushHistory(state), layers, selectedId: newId, selectedIds: [newId] }
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

  setClipMask: (maskId, targetId) => {
    if (maskId === targetId) return
    set((state) => {
      const mask = state.layers.find((l) => l.id === maskId)
      const target = state.layers.find((l) => l.id === targetId)
      // Only text/shape can act as a mask — see the interface comment.
      // Also refuses a direct two-layer cycle (A clips B, B clips A).
      if (!mask || !target || mask.type === 'image' || mask.clipPathId === targetId) return state

      const withoutMask = state.layers.filter((l) => l.id !== maskId)
      const targetIndex = withoutMask.findIndex((l) => l.id === targetId)
      const repositionedMask: EditorLayer = { ...mask, clipPathId: undefined, folderId: target.folderId }
      const layers = [
        ...withoutMask.slice(0, targetIndex + 1),
        repositionedMask,
        ...withoutMask.slice(targetIndex + 1),
      ].map((l) => (l.id === targetId ? { ...l, clipPathId: maskId } : l))

      return { ...pushHistory(state), layers }
    })
  },

  removeClipMask: (targetId) => {
    set((state) => ({
      ...pushHistory(state),
      layers: state.layers.map((l) => (l.id === targetId ? { ...l, clipPathId: undefined } : l)),
    }))
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

  addRecentColor: (color) => {
    set((state) => {
      const next = [color, ...state.recentColors.filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(
        0,
        MAX_RECENT_COLORS,
      )
      saveRecentColors(next)
      return { recentColors: next }
    })
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

  replaceAll: (layers, presetId, folders = []) => {
    set((state) => ({
      ...pushHistory(state),
      layers,
      folders,
      guides: [],
      presetId,
      selectedId: null,
      selectedIds: [],
    }))
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
    })
  },
}))
