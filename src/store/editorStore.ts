import { create } from 'zustand'
import type { EditorLayer, ImageLayer, TextLayer } from '../types/editor'
import { DEFAULT_PRESET_ID, getPresetById, mmToPx } from '../utils/presets'

interface HistoryEntry {
  layers: EditorLayer[]
  selectedId: string | null
  presetId: string
}

interface EditorState {
  layers: EditorLayer[]
  selectedId: string | null
  presetId: string
  past: HistoryEntry[]
  future: HistoryEntry[]

  setPreset: (presetId: string) => void
  addTextLayer: () => void
  addImageLayer: (src: string, width: number, height: number) => void
  updateLayerTransform: (
    id: string,
    transform: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>>,
  ) => void
  updateTextStyle: (id: string, style: Partial<Omit<TextLayer, keyof EditorLayer | 'type'>>) => void
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
  duplicateLayer: (id: string) => void
  toggleLock: (id: string) => void
  toggleVisible: (id: string) => void
  reorderLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
  alignLayer: (id: string, alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  selectLayer: (id: string | null) => void
  replaceAll: (layers: EditorLayer[], presetId: string) => void
  undo: () => void
  redo: () => void
}

const MAX_HISTORY = 50

const createId = () =>
  `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const snapshotOf = (state: EditorState): HistoryEntry => ({
  layers: state.layers,
  selectedId: state.selectedId,
  presetId: state.presetId,
})

const pushHistory = (state: EditorState): Pick<EditorState, 'past' | 'future'> => ({
  past: [...state.past, snapshotOf(state)].slice(-MAX_HISTORY),
  future: [],
})

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: [],
  selectedId: null,
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
      text: '텍스트를 입력하세요',
      fontFamily: 'Noto Sans KR',
      fontSize: 24,
      color: '#111111',
      align: 'left',
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, newLayer],
      selectedId: id,
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
      src,
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, newLayer],
      selectedId: id,
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
    }))
  },

  duplicateLayer: (id) => {
    const source = get().layers.find((layer) => layer.id === id)
    if (!source) return
    const newId = createId()
    const clone: EditorLayer = {
      ...source,
      id: newId,
      name: `${source.name} 사본`,
      x: source.x + 16,
      y: source.y + 16,
    }
    set((state) => ({
      ...pushHistory(state),
      layers: [...state.layers, clone],
      selectedId: newId,
    }))
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
      return {
        ...pushHistory(state),
        layers: state.layers.map((l) => (l.id === id ? { ...l, visible: nextVisible } : l)),
        selectedId: !nextVisible && state.selectedId === id ? null : state.selectedId,
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
    set({ selectedId: id })
  },

  replaceAll: (layers, presetId) => {
    set((state) => ({
      ...pushHistory(state),
      layers,
      presetId,
      selectedId: null,
    }))
  },

  undo: () => {
    const { past, layers, selectedId, presetId, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      layers: previous.layers,
      selectedId: previous.selectedId,
      presetId: previous.presetId,
      past: past.slice(0, -1),
      future: [{ layers, selectedId, presetId }, ...future].slice(0, MAX_HISTORY),
    })
  },

  redo: () => {
    const { future, layers, selectedId, presetId, past } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      layers: next.layers,
      selectedId: next.selectedId,
      presetId: next.presetId,
      future: future.slice(1),
      past: [...past, { layers, selectedId, presetId }].slice(-MAX_HISTORY),
    })
  },
}))
