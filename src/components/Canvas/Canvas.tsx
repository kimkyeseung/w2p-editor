import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

// The zoom/pan view state below is a pure presentation concern (how much of
// the artwork is visible and at what scale) — it never touches Fabric's own
// coordinate system, so it can't disturb the center/top-left conversion above.
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
const VIEWPORT_PADDING = 64 // matches .canvas-wrap's CSS padding (2rem each side)

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

interface ZoomAnchor {
  containerX: number
  containerY: number
  clientX: number
  clientY: number
  prevZoom: number
}

export const Canvas = forwardRef<CanvasHandle>((_props, ref) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const zoomFrameRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const idToObject = useRef(new Map<string, fabric.FabricObject>())
  const objectToId = useRef(new WeakMap<fabric.FabricObject, string>())
  const pendingImageIds = useRef(new Set<string>())
  const pinchStateRef = useRef<{ distance: number; zoom: number } | null>(null)
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null)
  const panDragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [panMode, setPanMode] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const isPanning = panMode || spaceHeld

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

  // Zoom centered on a viewport (client) point, keeping that point visually
  // fixed under the cursor — same UX as Figma/Photoshop's ctrl/cmd+wheel zoom.
  const applyZoomAtPoint = (nextZoomRaw: number, clientX: number, clientY: number) => {
    const container = zoomFrameRef.current?.parentElement
    const nextZoom = clampZoom(nextZoomRaw)
    if (!container) {
      setZoom(nextZoom)
      return
    }
    const rect = container.getBoundingClientRect()
    zoomAnchorRef.current = {
      containerX: container.scrollLeft + (clientX - rect.left),
      containerY: container.scrollTop + (clientY - rect.top),
      clientX,
      clientY,
      prevZoom: zoom,
    }
    setZoom(nextZoom)
  }

  const zoomByFactor = (factor: number) => {
    const container = zoomFrameRef.current?.parentElement
    if (!container) {
      setZoom((z) => clampZoom(z * factor))
      return
    }
    const rect = container.getBoundingClientRect()
    applyZoomAtPoint(zoom * factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  const fitToScreen = () => {
    const container = zoomFrameRef.current?.parentElement
    if (!container) return
    const availW = container.clientWidth - VIEWPORT_PADDING
    const availH = container.clientHeight - VIEWPORT_PADDING
    const fit = Math.min(availW / totalWidth, availH / totalHeight)
    if (Number.isFinite(fit) && fit > 0) setZoom(clampZoom(fit))
  }

  // After the zoom-driven re-render, restore the anchor point under the cursor.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const container = zoomFrameRef.current?.parentElement
    if (!anchor || !container) return
    zoomAnchorRef.current = null
    const rect = container.getBoundingClientRect()
    const ratio = zoom / anchor.prevZoom
    container.scrollLeft = anchor.containerX * ratio - (anchor.clientX - rect.left)
    container.scrollTop = anchor.containerY * ratio - (anchor.clientY - rect.top)
  }, [zoom])

  // Ctrl/Cmd + wheel to zoom, anchored at the cursor.
  useEffect(() => {
    const container = zoomFrameRef.current?.parentElement
    if (!container) return
    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      applyZoomAtPoint(zoom * factor, e.clientX, e.clientY)
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  // Hold Space for a temporary hand tool, Photoshop/Figma-style.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return
      // Browsers auto-repeat keydown while a key is held, and Space's
      // default action is "scroll the page down" — without preventDefault
      // on every repeat (not just the first press), holding Space scrolls
      // the canvas to the bottom instead of just toggling the hand tool.
      e.preventDefault()
      setSpaceHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handlePanPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = zoomFrameRef.current?.parentElement
    if (!container) return
    panDragRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current
    const container = zoomFrameRef.current?.parentElement
    if (!drag || !container) return
    container.scrollLeft = drag.scrollLeft - (e.clientX - drag.x)
    container.scrollTop = drag.scrollTop - (e.clientY - drag.y)
  }
  const handlePanPointerUp = () => {
    panDragRef.current = null
  }

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

  // Resize the canvas when the print preset changes, and auto-fit the view
  // so a large preset (e.g. an A4 poster) is never taller/wider than the
  // visible workspace by default (fixes the top edge being hidden under the
  // toolbar on preset switch).
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.setDimensions({ width: totalWidth, height: totalHeight })
    canvas.requestRenderAll()

    const container = zoomFrameRef.current?.parentElement
    if (container) {
      const availW = container.clientWidth - VIEWPORT_PADDING
      const availH = container.clientHeight - VIEWPORT_PADDING
      const fit = Math.min(availW / totalWidth, availH / totalHeight, 1)
      if (Number.isFinite(fit) && fit > 0) setZoom(clampZoom(fit))
    }
  }, [totalWidth, totalHeight])

  // Two-finger pinch to zoom the canvas view (mobile touch support), sharing
  // the same CSS-scale zoom state as the desktop controls above.
  useEffect(() => {
    const el = zoomFrameRef.current
    if (!el) return

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
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      if (!pinchStateRef.current) {
        pinchStateRef.current = { distance, zoom }
        return
      }
      const scale = distance / pinchStateRef.current.distance
      applyZoomAtPoint(pinchStateRef.current.zoom * scale, midX, midY)
    }
    const handleTouchEnd = () => {
      pinchStateRef.current = null
    }

    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    return () => {
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

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
    <div className="canvas-viewport">
      {/* This scroll container is what zoomFrameRef.parentElement refers to
          throughout this component. The view controls below live outside it
          (as a sibling) specifically so they stay pinned to the viewport
          corner instead of scrolling away with the zoomed/panned content. */}
      <div className="canvas-scroll">
        <div
          ref={zoomFrameRef}
          className="canvas-zoom-frame"
          style={{ width: totalWidth * zoom, height: totalHeight * zoom }}
        >
          <div
            className="canvas-stage"
            style={{ width: totalWidth, height: totalHeight, transform: `scale(${zoom})` }}
          >
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
        </div>
      </div>

      {/* Sized to the whole viewport (not just the paper) so the hand
          cursor and drag capture keep working over the gray margin too —
          it sits above canvas-scroll but below canvas-view-controls (see
          z-index) so the toolbar buttons stay clickable while panning. */}
      {isPanning && (
        <div
          className="pan-overlay"
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={handlePanPointerUp}
          onPointerCancel={handlePanPointerUp}
        />
      )}

      <div className="canvas-view-controls">
        <button
          type="button"
          className={panMode ? 'is-active' : ''}
          onClick={() => setPanMode((v) => !v)}
          title="손 도구 (누르는 동안 켜기: 스페이스바)"
        >
          ✋
        </button>
        <button type="button" onClick={() => zoomByFactor(1 / 1.2)} title="축소">
          −
        </button>
        <button
          type="button"
          className="zoom-readout"
          onClick={() => setZoom(1)}
          title="클릭하면 100%로 초기화"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => zoomByFactor(1.2)} title="확대">
          +
        </button>
        <button type="button" onClick={fitToScreen} title="화면에 맞추기">
          ⤢
        </button>
      </div>
    </div>
  )
})

Canvas.displayName = 'Canvas'
