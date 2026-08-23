import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as fabric from 'fabric'
import { useEditorStore } from '../../store/editorStore'
import { getPresetById, mmToPx } from '../../utils/presets'
import type { EditorLayer, ImageLayer, TextLayer } from '../../types/editor'
import {
  exportCanvasAsPng,
  importProjectFile,
  loadFromLocalStorage,
  saveToLocalStorage,
  exportProjectFile,
} from '../../utils/canvasSerialization'
import './Canvas.css'

export interface CanvasHandle {
  exportPng: () => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
  exportProjectFile: () => void
  importProjectFile: (file: File) => Promise<void>
  getDesignDataUrl: () => string | null
}

// Fabric.js v6+ positions objects by their CENTER (originX/originY default to
// 'center'), not their top-left corner. Our EditorLayer model — and the
// properties panel — works in "top-left" coordinates (the usual mental model
// for print/design tools), so every read/write to a Fabric object converts
// between the two. Rotation always pivots around the object's own center,
// which matches standard design-tool UX (Figma/Canva do the same).
const centerFromTopLeft = (layer: Pick<EditorLayer, 'x' | 'y' | 'width' | 'height'>) => ({
  centerX: layer.x + layer.width / 2,
  centerY: layer.y + layer.height / 2,
})

const topLeftFromObject = (obj: fabric.FabricObject) => {
  const center = obj.getCenterPoint()
  const width = obj.getScaledWidth()
  const height = obj.getScaledHeight()
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  }
}

const applyCommonTransform = (obj: fabric.FabricObject, layer: EditorLayer) => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  obj.set({
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    angle: layer.rotation,
    selectable: !layer.locked,
    evented: !layer.locked,
  })
}

const applyTextLayer = (obj: fabric.Textbox, layer: TextLayer) => {
  obj.set({
    text: layer.text,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fill: layer.color,
    textAlign: layer.align,
    width: layer.width,
    scaleX: 1,
  })
  obj.initDimensions()
  const measuredHeight = obj.height || 1
  obj.set('scaleY', layer.height / measuredHeight)
  applyCommonTransform(obj, layer)
}

const createTextObject = (layer: TextLayer): fabric.Textbox => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  const textbox = new fabric.Textbox(layer.text, {
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    width: layer.width,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fill: layer.color,
    textAlign: layer.align,
    angle: layer.rotation,
    selectable: !layer.locked,
    evented: !layer.locked,
  })
  return textbox
}

const applyImageLayer = (obj: fabric.FabricImage, layer: ImageLayer) => {
  const baseWidth = obj.width || 1
  const baseHeight = obj.height || 1
  obj.set({ scaleX: layer.width / baseWidth, scaleY: layer.height / baseHeight })
  applyCommonTransform(obj, layer)
}

export const Canvas = forwardRef<CanvasHandle>((_props, ref) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const idToObject = useRef(new Map<string, fabric.FabricObject>())
  const objectToId = useRef(new WeakMap<fabric.FabricObject, string>())
  const pendingImageIds = useRef(new Set<string>())
  const pinchStateRef = useRef<{ distance: number; zoom: number } | null>(null)

  const layers = useEditorStore((s) => s.layers)
  const selectedId = useEditorStore((s) => s.selectedId)
  const presetId = useEditorStore((s) => s.presetId)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const updateLayerTransform = useEditorStore((s) => s.updateLayerTransform)
  const replaceAll = useEditorStore((s) => s.replaceAll)

  const preset = useMemo(() => getPresetById(presetId), [presetId])
  const bleedPx = mmToPx(preset.bleedMm)
  const safePx = mmToPx(preset.safeMarginMm)
  const trimWidthPx = mmToPx(preset.widthMm)
  const trimHeightPx = mmToPx(preset.heightMm)
  const totalWidth = trimWidthPx + bleedPx * 2
  const totalHeight = trimHeightPx + bleedPx * 2

  // Initialize the Fabric canvas once and wire canvas -> store event sync.
  useEffect(() => {
    if (!canvasElRef.current) return
    const canvas = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    const handleModified = (e: { target?: fabric.FabricObject }) => {
      const target = e.target
      if (!target) return
      const id = objectToId.current.get(target)
      if (!id) return
      const topLeft = topLeftFromObject(target)
      updateLayerTransform(id, {
        x: Math.round(topLeft.x),
        y: Math.round(topLeft.y),
        width: Math.round(topLeft.width),
        height: Math.round(topLeft.height),
        rotation: Math.round(target.angle ?? 0),
      })
    }
    const handleSelectionChange = (e: { selected?: fabric.FabricObject[] }) => {
      const first = e.selected?.[0]
      const id = first ? objectToId.current.get(first) ?? null : null
      selectLayer(id)
    }
    const handleSelectionCleared = () => selectLayer(null)

    canvas.on('object:modified', handleModified)
    canvas.on('selection:created', handleSelectionChange)
    canvas.on('selection:updated', handleSelectionChange)
    canvas.on('selection:cleared', handleSelectionCleared)

    return () => {
      canvas.dispose()
      fabricRef.current = null
      idToObject.current.clear()
      objectToId.current = new WeakMap()
      pendingImageIds.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize the canvas when the print preset changes.
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.setDimensions({ width: totalWidth, height: totalHeight })
    canvas.requestRenderAll()
  }, [totalWidth, totalHeight])

  // Two-finger pinch to zoom the canvas view (mobile touch support).
  useEffect(() => {
    const canvas = fabricRef.current
    const el = canvasElRef.current
    if (!canvas || !el) return

    const distanceOf = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]]
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        pinchStateRef.current = null
        return
      }
      e.preventDefault()
      const distance = distanceOf(e.touches)
      if (!pinchStateRef.current) {
        pinchStateRef.current = { distance, zoom: canvas.getZoom() }
        return
      }
      const scale = distance / pinchStateRef.current.distance
      const nextZoom = Math.min(4, Math.max(0.3, pinchStateRef.current.zoom * scale))
      const rect = el.getBoundingClientRect()
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
      canvas.zoomToPoint(new fabric.Point(midX, midY), nextZoom)
    }
    const handleTouchEnd = () => {
      pinchStateRef.current = null
    }

    const wrapper = canvas.wrapperEl ?? el
    wrapper.addEventListener('touchmove', handleTouchMove, { passive: false })
    wrapper.addEventListener('touchend', handleTouchEnd)
    return () => {
      wrapper.removeEventListener('touchmove', handleTouchMove)
      wrapper.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Reconcile store layers -> Fabric objects (create/update/remove + z-order).
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const currentIds = new Set(layers.map((l) => l.id))
    for (const [id, obj] of Array.from(idToObject.current.entries())) {
      if (!currentIds.has(id)) {
        canvas.remove(obj)
        idToObject.current.delete(id)
        objectToId.current.delete(obj)
      }
    }

    layers.forEach((layer, index) => {
      const existing = idToObject.current.get(layer.id)
      if (existing) {
        if (layer.type === 'text' && existing instanceof fabric.Textbox) {
          applyTextLayer(existing, layer)
        } else if (layer.type === 'image') {
          applyImageLayer(existing as fabric.FabricImage, layer)
        }
        canvas.moveObjectTo(existing, index)
        return
      }

      if (layer.type === 'text') {
        const obj = createTextObject(layer)
        idToObject.current.set(layer.id, obj)
        objectToId.current.set(obj, layer.id)
        canvas.add(obj)
        canvas.moveObjectTo(obj, index)
      } else if (layer.type === 'image' && !pendingImageIds.current.has(layer.id)) {
        pendingImageIds.current.add(layer.id)
        fabric.FabricImage.fromURL(layer.src)
          .then((img) => {
            pendingImageIds.current.delete(layer.id)
            const stillExists = useEditorStore.getState().layers.find((l) => l.id === layer.id)
            if (!stillExists || !fabricRef.current) return
            applyImageLayer(img, stillExists as ImageLayer)
            idToObject.current.set(layer.id, img)
            objectToId.current.set(img, layer.id)
            fabricRef.current.add(img)
            const currentIndex = useEditorStore.getState().layers.findIndex((l) => l.id === layer.id)
            if (currentIndex >= 0) fabricRef.current.moveObjectTo(img, currentIndex)
            if (useEditorStore.getState().selectedId === layer.id) {
              fabricRef.current.setActiveObject(img)
            }
            fabricRef.current.requestRenderAll()
          })
          .catch(() => {
            pendingImageIds.current.delete(layer.id)
          })
      }
    })

    if (selectedId) {
      const obj = idToObject.current.get(selectedId)
      if (obj && canvas.getActiveObject() !== obj) {
        canvas.setActiveObject(obj)
      }
    } else if (canvas.getActiveObject()) {
      canvas.discardActiveObject()
    }

    canvas.requestRenderAll()
  }, [layers, selectedId])

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = fabricRef.current
      if (canvas) exportCanvasAsPng(canvas)
    },
    saveToLocalStorage: () => {
      const canvas = fabricRef.current
      if (canvas) saveToLocalStorage(canvas, layers, presetId)
    },
    loadFromLocalStorage: () => {
      const project = loadFromLocalStorage()
      if (project) replaceAll(project.layers, project.presetId)
    },
    exportProjectFile: () => {
      const canvas = fabricRef.current
      if (canvas) exportProjectFile(canvas, layers, presetId)
    },
    importProjectFile: async (file: File) => {
      const project = await importProjectFile(file)
      replaceAll(project.layers, project.presetId)
    },
    getDesignDataUrl: () => {
      const canvas = fabricRef.current
      if (!canvas || layers.length === 0) return null
      return canvas.toDataURL({ format: 'png', multiplier: 2 })
    },
  }))

  return (
    <div className="canvas-stage" style={{ width: totalWidth, height: totalHeight }}>
      <canvas ref={canvasElRef} width={totalWidth} height={totalHeight} />
      <div className="canvas-guides" aria-hidden="true">
        <svg width={totalWidth} height={totalHeight}>
          <rect
            className="guide-bleed"
            x={0.5}
            y={0.5}
            width={totalWidth - 1}
            height={totalHeight - 1}
          />
          <rect
            className="guide-trim"
            x={bleedPx}
            y={bleedPx}
            width={trimWidthPx}
            height={trimHeightPx}
          />
          <rect
            className="guide-safe"
            x={bleedPx + safePx}
            y={bleedPx + safePx}
            width={Math.max(trimWidthPx - safePx * 2, 0)}
            height={Math.max(trimHeightPx - safePx * 2, 0)}
          />
        </svg>
      </div>
    </div>
  )
})

Canvas.displayName = 'Canvas'
