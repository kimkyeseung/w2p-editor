// Mutating an *existing* layer's transform/style/visibility/z-order/mask —
// see layerCrudSlice for creating/deleting/duplicating layers instead.
import type { StoreApi } from 'zustand'
import type { EditorLayer } from '../../types/editor'
import type { EditorState } from '../types'
import { pushHistory } from '../historyHelpers'

type Set = StoreApi<EditorState>['setState']

export type LayerStyleSlice = Pick<
  EditorState,
  | 'lastTransform'
  | 'updatePathStyle'
  | 'updateLayerTransform'
  | 'updateLayerShadow'
  | 'updateLayerBorder'
  | 'flipLayer'
  | 'applyCanvasModification'
  | 'repeatLastTransform'
  | 'updateTextStyle'
  | 'updateShapeStyle'
  | 'updateShapeGradient'
  | 'toggleLock'
  | 'toggleVisible'
  | 'reorderLayer'
  | 'setClipMask'
  | 'removeClipMask'
>

export const createLayerStyleSlice = (set: Set): LayerStyleSlice => ({
  lastTransform: null,

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
})
