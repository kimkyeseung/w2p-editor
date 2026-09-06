// Layer lifecycle: create, delete, duplicate, copy/paste, rename, and the
// flatten-to-image merge. See layerStyleSlice for mutating an *existing*
// layer's properties instead of its existence.
import type { StoreApi } from 'zustand'
import type { EditorLayer, ImageLayer, PathLayer, ShapeKind, ShapeLayer, TextLayer } from '../../types/editor'
import type { EditorState } from '../types'
import { createId, pushHistory } from '../historyHelpers'

type Set = StoreApi<EditorState>['setState']
type Get = StoreApi<EditorState>['getState']

export type LayerCrudSlice = Pick<
  EditorState,
  | 'clipboard'
  | 'pasteCount'
  | 'addTextLayer'
  | 'addImageLayer'
  | 'addShapeLayer'
  | 'addPathLayer'
  | 'renameLayer'
  | 'removeLayer'
  | 'removeLayers'
  | 'duplicateLayer'
  | 'duplicateLayers'
  | 'copyLayers'
  | 'pasteLayers'
  | 'replaceLayersWithImage'
>

export const createLayerCrudSlice = (set: Set, get: Get): LayerCrudSlice => ({
  clipboard: [],
  pasteCount: 0,

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
      width: 203,
      height: 27,
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

  addImageLayer: (src, width, height, position) => {
    const id = createId()
    const newLayer: ImageLayer = {
      id,
      type: 'image',
      name: `이미지 ${get().layers.filter((l) => l.type === 'image').length + 1}`,
      locked: false,
      visible: true,
      x: position?.x ?? 40,
      y: position?.y ?? 40,
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

  renameLayer: (id, name) => {
    // Fires on every keystroke of the name field, so it deliberately skips
    // pushHistory (one undo step per character would be unusable) — but the
    // name is still real, persisted document content, so `dirty` still
    // needs to flip or a rename-only edit won't trigger the unsaved-changes
    // warning on close.
    set((state) => ({
      dirty: true,
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

  copyLayers: (ids) => {
    if (ids.length === 0) return
    set((state) => {
      const idSet = new Set(ids)
      const clipboard = state.layers.filter((layer) => idSet.has(layer.id))
      if (clipboard.length === 0) return state
      return { clipboard, pasteCount: 0 }
    })
  },

  pasteLayers: () => {
    set((state) => {
      if (state.clipboard.length === 0) return state
      const offset = 16 * (state.pasteCount + 1)
      const newIds: string[] = []
      const folderIds = new Set(state.folders.map((f) => f.id))
      const layers = [...state.layers]
      // Insert each clone right after its copied folder's current last
      // member — same "stay inside the folder's contiguous block" rule
      // duplicateLayer/duplicateLayers follow — instead of always appending
      // at the end, which broke that invariant whenever the copied layer
      // belonged to a folder. Drops the folderId if that folder no longer
      // exists (e.g. deleted, or copied from an since-replaced document).
      for (const source of state.clipboard) {
        const newId = createId()
        newIds.push(newId)
        const folderId = source.folderId && folderIds.has(source.folderId) ? source.folderId : undefined
        const clone = {
          ...source,
          id: newId,
          folderId,
          name: `${source.name} 사본`,
          x: source.x + offset,
          y: source.y + offset,
        }
        let lastIndex = -1
        if (folderId) {
          layers.forEach((l, i) => {
            if (l.folderId === folderId) lastIndex = i
          })
        }
        if (lastIndex === -1) layers.push(clone)
        else layers.splice(lastIndex + 1, 0, clone)
      }
      return {
        ...pushHistory(state),
        layers,
        selectedId: newIds.length === 1 ? newIds[0] : null,
        selectedIds: newIds,
        pasteCount: state.pasteCount + 1,
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
})
