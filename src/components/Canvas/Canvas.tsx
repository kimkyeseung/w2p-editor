import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { useEditorStore } from '../../store/editorStore'
import { getPresetById, mmToPx } from '../../utils/presets'
import { ROTATE_CURSOR } from '../../utils/cursors'
import type {
  EditorLayer,
  ImageLayer,
  LayerBorder,
  LayerFolder,
  LayerShadow,
  ShapeLayer,
  TextLayer,
} from '../../types/editor'
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
  loadFromLocalStorage: () => boolean
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

const buildShadow = (shadow: LayerShadow): fabric.Shadow | null =>
  shadow.enabled
    ? new fabric.Shadow({
        color: shadow.color,
        blur: shadow.blur,
        offsetX: shadow.offsetX,
        offsetY: shadow.offsetY,
      })
    : null

// Only meaningful for text/image layers — shape layers already own
// stroke/strokeWidth via ShapeLayer.stroke and apply it themselves in
// applyShapeStyle/createShapeObject, so applying this too would fight over
// Fabric's single stroke/strokeWidth properties on the same object.
const buildBorderProps = (border: LayerBorder) => ({
  stroke: border.enabled ? border.color : '',
  strokeWidth: border.enabled ? border.width : 0,
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

// `visible` was added after the first release, so projects saved before it
// existed don't have the field — treat only an explicit `false` as hidden.
// A layer's own visible/locked flag is independent of its folder's — a
// folder being hidden/locked masks its members without touching their own
// flags, matching Photoshop's group behavior (unhide the folder and each
// child is back to whatever it was individually set to).
const folderOf = (layer: Pick<EditorLayer, 'folderId'>, folders: LayerFolder[]) =>
  layer.folderId ? folders.find((f) => f.id === layer.folderId) : undefined

const isLayerVisible = (layer: Pick<EditorLayer, 'visible' | 'folderId'>, folders: LayerFolder[]) => {
  if (layer.visible === false) return false
  const folder = folderOf(layer, folders)
  return !folder || folder.visible !== false
}

const isLayerLocked = (layer: Pick<EditorLayer, 'locked' | 'folderId'>, folders: LayerFolder[]) => {
  if (layer.locked) return true
  const folder = folderOf(layer, folders)
  return !!folder?.locked
}

const applyCommonTransform = (obj: fabric.FabricObject, layer: EditorLayer, folders: LayerFolder[]) => {
  const visible = isLayerVisible(layer, folders)
  const locked = isLayerLocked(layer, folders)
  obj.set({
    visible,
    opacity: layer.opacity,
    shadow: buildShadow(layer.shadow),
    ...(layer.type === 'shape' ? {} : buildBorderProps(layer.border)),
    flipX: layer.flipX,
    flipY: layer.flipY,
    globalCompositeOperation: layer.blendMode,
    selectable: !locked && visible,
    evented: !locked && visible,
  })
  // While the object is part of a live multi-selection (ActiveSelection),
  // Fabric reinterprets left/top as relative to the group, not absolute
  // canvas coordinates — writing our absolute x/y here corrupts its
  // transform and renders it far outside the visible selection box (looks
  // like the text vanished). The object already reflects any in-progress
  // group drag, and Fabric bakes its position back to absolute coordinates
  // the instant it leaves the group (deselect), so it's safe to skip this
  // and let a later reconciliation pick it back up once ungrouped.
  if (obj.group) return
  const { centerX, centerY } = centerFromTopLeft(layer)
  obj.set({ originX: 'center', originY: 'center', left: centerX, top: centerY, angle: layer.rotation })
}

const applyTextLayer = (obj: fabric.Textbox, layer: TextLayer, folders: LayerFolder[]) => {
  obj.set({
    text: layer.text,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    charSpacing: layer.charSpacing,
    lineHeight: layer.lineHeight,
    fill: layer.color,
    textAlign: layer.align,
    width: layer.width,
    scaleX: 1,
  })
  obj.initDimensions()
  const measuredHeight = obj.height || 1
  obj.set('scaleY', layer.height / measuredHeight)
  applyCommonTransform(obj, layer, folders)
}

const createTextObject = (layer: TextLayer, folders: LayerFolder[]): fabric.Textbox => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  const visible = isLayerVisible(layer, folders)
  const locked = isLayerLocked(layer, folders)
  const textbox = new fabric.Textbox(layer.text, {
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    width: layer.width,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    charSpacing: layer.charSpacing,
    lineHeight: layer.lineHeight,
    fill: layer.color,
    textAlign: layer.align,
    angle: layer.rotation,
    opacity: layer.opacity,
    shadow: buildShadow(layer.shadow),
    ...buildBorderProps(layer.border),
    flipX: layer.flipX,
    flipY: layer.flipY,
    globalCompositeOperation: layer.blendMode,
    visible,
    selectable: !locked && visible,
    evented: !locked && visible,
  })
  applyRotateCursor(textbox)
  return textbox
}

const applyRotateCursor = (obj: fabric.FabricObject) => {
  if (obj.controls.mtr) obj.controls.mtr.cursorStyle = ROTATE_CURSOR
}

const applyImageLayer = (obj: fabric.FabricImage, layer: ImageLayer, folders: LayerFolder[]) => {
  const baseWidth = obj.width || 1
  const baseHeight = obj.height || 1
  obj.set({ scaleX: layer.width / baseWidth, scaleY: layer.height / baseHeight })
  applyCommonTransform(obj, layer, folders)
}

// A line has no fillable area — the stored `fill` is kept on the layer (in
// case it's ever reused for something else) but never applied to the object.
const applyShapeStyle = (obj: fabric.Object, layer: ShapeLayer, folders: LayerFolder[]) => {
  if (layer.shape === 'ellipse') {
    ;(obj as fabric.Ellipse).set({ rx: layer.width / 2, ry: layer.height / 2 })
  } else if (layer.shape === 'line') {
    ;(obj as fabric.Line).set({ x1: 0, y1: 0, x2: layer.width, y2: layer.height })
  } else {
    obj.set({ width: layer.width, height: layer.height })
  }
  obj.set({
    fill: layer.shape === 'line' ? '' : layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
  })
  applyCommonTransform(obj, layer, folders)
}

const createShapeObject = (layer: ShapeLayer, folders: LayerFolder[]): fabric.Object => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  const visible = isLayerVisible(layer, folders)
  const locked = isLayerLocked(layer, folders)
  const common = {
    originX: 'center' as const,
    originY: 'center' as const,
    left: centerX,
    top: centerY,
    angle: layer.rotation,
    fill: layer.shape === 'line' ? '' : layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    opacity: layer.opacity,
    shadow: buildShadow(layer.shadow),
    flipX: layer.flipX,
    flipY: layer.flipY,
    globalCompositeOperation: layer.blendMode,
    visible,
    selectable: !locked && visible,
    evented: !locked && visible,
  }
  let obj: fabric.Object
  switch (layer.shape) {
    case 'ellipse':
      obj = new fabric.Ellipse({ ...common, rx: layer.width / 2, ry: layer.height / 2 })
      break
    case 'triangle':
      obj = new fabric.Triangle({ ...common, width: layer.width, height: layer.height })
      break
    case 'line':
      obj = new fabric.Line([0, 0, layer.width, layer.height], common)
      break
    default:
      obj = new fabric.Rect({ ...common, width: layer.width, height: layer.height })
  }
  applyRotateCursor(obj)
  return obj
}

// The zoom/pan view state below is a pure presentation concern (how much of
// the artwork is visible and at what scale) — it never touches Fabric's own
// coordinate system, so it can't disturb the center/top-left conversion above.
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
const VIEWPORT_PADDING = 64 // matches .canvas-wrap's CSS padding (2rem each side)

// Web fonts loaded via <link> in index.html aren't fetched until something
// actually renders text with them — and unlike DOM text, Fabric's canvas
// text draws once with whatever's available *right now* and never repaints
// itself when the real font finishes loading. We kick the download off
// explicitly and force one re-render once it's ready, so Korean text isn't
// stuck on the system fallback font.
const WEB_FONT_FAMILIES = ['Noto Sans KR', 'Nanum Gothic', 'Nanum Myeongjo']

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export const Canvas = forwardRef<CanvasHandle>((_props, ref) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const zoomFrameRef = useRef<HTMLDivElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const idToObject = useRef(new Map<string, fabric.FabricObject>())
  const objectToId = useRef(new WeakMap<fabric.FabricObject, string>())
  const pendingImageIds = useRef(new Set<string>())
  const pinchStateRef = useRef<{ distance: number; zoom: number } | null>(null)
  const panDragRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const zoomRef = useRef(1)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panMode, setPanMode] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [showGuides, setShowGuides] = useState(true)
  const [alignGuides, setAlignGuides] = useState<{ vertical: number[]; horizontal: number[] }>({
    vertical: [],
    horizontal: [],
  })
  const isPanning = panMode || spaceHeld

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const layers = useEditorStore((s) => s.layers)
  const folders = useEditorStore((s) => s.folders)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const presetId = useEditorStore((s) => s.presetId)
  const selectLayers = useEditorStore((s) => s.selectLayers)
  const applyCanvasModification = useEditorStore((s) => s.applyCanvasModification)
  const replaceAll = useEditorStore((s) => s.replaceAll)

  const preset = useMemo(() => getPresetById(presetId), [presetId])
  const bleedPx = mmToPx(preset.bleedMm)
  const safePx = mmToPx(preset.safeMarginMm)
  const trimWidthPx = mmToPx(preset.widthMm)
  const trimHeightPx = mmToPx(preset.heightMm)
  const totalWidth = trimWidthPx + bleedPx * 2
  const totalHeight = trimHeightPx + bleedPx * 2

  // The zoom-frame is centered in canvas-scroll by flexbox, then shifted by
  // `pan` on top of that centered baseline (translate, not scroll) — so,
  // like Photoshop CS4+, dragging with the hand tool always moves the canvas
  // regardless of zoom level, even when it's fully visible and there's
  // nothing to natively scroll.
  const frameRect = (zoomLevel: number, panX: number, panY: number) => {
    const container = canvasScrollRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const frameWidth = totalWidth * zoomLevel
    const frameHeight = totalHeight * zoomLevel
    return {
      left: rect.left + (rect.width - frameWidth) / 2 + panX,
      top: rect.top + (rect.height - frameHeight) / 2 + panY,
      containerRect: rect,
    }
  }

  // Zoom centered on a viewport (client) point, keeping that point visually
  // fixed under the cursor — same UX as Figma/Photoshop's ctrl/cmd+wheel zoom.
  const applyZoomAtPoint = (nextZoomRaw: number, clientX: number, clientY: number) => {
    const nextZoom = clampZoom(nextZoomRaw)
    const before = frameRect(zoom, pan.x, pan.y)
    if (!before) {
      setZoom(nextZoom)
      return
    }
    const ratio = nextZoom / zoom
    // Content-space point under the cursor (old zoom's pixels) stays put:
    // scale it into the new frame and re-derive the pan that keeps its
    // screen position unchanged.
    const contentX = (clientX - before.left) * ratio
    const contentY = (clientY - before.top) * ratio
    const frameWidthNew = totalWidth * nextZoom
    const frameHeightNew = totalHeight * nextZoom
    const { containerRect } = before
    const nextPanX = clientX - contentX - containerRect.left - (containerRect.width - frameWidthNew) / 2
    const nextPanY = clientY - contentY - containerRect.top - (containerRect.height - frameHeightNew) / 2
    setZoom(nextZoom)
    setPan({ x: nextPanX, y: nextPanY })
  }

  const zoomByFactor = (factor: number) => {
    const container = canvasScrollRef.current
    if (!container) {
      setZoom((z) => clampZoom(z * factor))
      return
    }
    const rect = container.getBoundingClientRect()
    applyZoomAtPoint(zoom * factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  const fitToScreen = () => {
    const container = canvasScrollRef.current
    if (!container) return
    const availW = container.clientWidth - VIEWPORT_PADDING
    const availH = container.clientHeight - VIEWPORT_PADDING
    const fit = Math.min(availW / totalWidth, availH / totalHeight)
    if (Number.isFinite(fit) && fit > 0) {
      setZoom(clampZoom(fit))
      setPan({ x: 0, y: 0 })
    }
  }

  // Ctrl/Cmd + wheel to zoom, anchored at the cursor.
  useEffect(() => {
    const container = canvasScrollRef.current
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
  }, [zoom, pan])

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
    panDragRef.current = { x: e.clientX, y: e.clientY, startPanX: pan.x, startPanY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current
    if (!drag) return
    setPan({
      x: drag.startPanX + (e.clientX - drag.x),
      y: drag.startPanY + (e.clientY - drag.y),
    })
  }
  const handlePanPointerUp = () => {
    panDragRef.current = null
  }

  // Fabric's own canvas element is sized exactly to the artboard, so a drag
  // starting in the gray margin around it never reaches Fabric at all — there's
  // nothing listening there. This reimplements marquee-select for that area:
  // capture the pointer on canvas-scroll's own background (guarded so it never
  // fires for a bubbled click on the artboard/an object, which Fabric already
  // handles) so the drag keeps working even if it crosses onto the artboard,
  // then select whatever objects' bounding boxes the drag rectangle overlaps.
  const handleBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.button !== 0) return
    marqueeStartRef.current = { x: e.clientX, y: e.clientY }
    setMarqueeBox({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Capture can legitimately fail to acquire (e.g. the pointer was
      // already released); the drag still works via document-level move/up
      // bubbling in that case, just without the "follow across other
      // elements" guarantee capture normally provides.
    }
  }
  const handleBackgroundPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = marqueeStartRef.current
    if (!start) return
    setMarqueeBox({
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      w: Math.abs(e.clientX - start.x),
      h: Math.abs(e.clientY - start.y),
    })
  }
  const handleBackgroundPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = marqueeStartRef.current
    marqueeStartRef.current = null
    setMarqueeBox(null)
    if (!start) return

    const canvas = fabricRef.current
    if (!canvas) return
    const canvasRect = canvas.upperCanvasEl.getBoundingClientRect()
    if (canvasRect.width === 0 || canvasRect.height === 0) return
    const scaleX = canvasRect.width / canvas.getWidth()
    const scaleY = canvasRect.height / canvas.getHeight()

    const dragLeft = Math.min(start.x, e.clientX)
    const dragTop = Math.min(start.y, e.clientY)
    const dragRight = Math.max(start.x, e.clientX)
    const dragBottom = Math.max(start.y, e.clientY)

    const ids: string[] = []
    for (const [id, obj] of idToObject.current.entries()) {
      if (obj.visible === false) continue
      const b = obj.getBoundingRect()
      const objLeft = canvasRect.left + b.left * scaleX
      const objTop = canvasRect.top + b.top * scaleY
      const objRight = objLeft + b.width * scaleX
      const objBottom = objTop + b.height * scaleY
      if (objLeft < dragRight && objRight > dragLeft && objTop < dragBottom && objBottom > dragTop) {
        ids.push(id)
      }
    }
    selectLayers(ids)
  }

  // Initialize the Fabric canvas once and wire canvas -> store event sync.
  useEffect(() => {
    if (!canvasElRef.current) return
    const canvas = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    const applyModifiedTarget = (target: fabric.FabricObject) => {
      const id = objectToId.current.get(target)
      if (!id) return
      const topLeft = topLeftFromObject(target)
      // Fabric also fires `object:modified` when the user finishes editing
      // text inline on the canvas (double-click). If we only write the
      // transform back here, the next store->canvas sync re-applies the
      // *old* text from the (now stale) layer and silently reverts the
      // edit — so text content rides along in the same update.
      applyCanvasModification(id, {
        x: Math.round(topLeft.x),
        y: Math.round(topLeft.y),
        width: Math.round(topLeft.width),
        height: Math.round(topLeft.height),
        rotation: Math.round(target.angle ?? 0),
        ...(target instanceof fabric.Textbox ? { text: target.text ?? '' } : {}),
      })
    }

    const handleModified = (e: { target?: fabric.FabricObject }) => {
      const target = e.target
      if (!target) return
      // Dragging/transforming a multi-selection fires one `object:modified`
      // for the whole ActiveSelection group — write each child's own new
      // position back individually so the store stays the source of truth
      // per layer (an ActiveSelection is a transient Fabric wrapper, not a
      // tracked layer, so objectToId has no entry for it).
      if (target instanceof fabric.ActiveSelection) {
        target.getObjects().forEach(applyModifiedTarget)
      } else {
        applyModifiedTarget(target)
      }
      setAlignGuides({ vertical: [], horizontal: [] })
    }

    // Figma/Illustrator-style smart guides: snap the dragged object's edges
    // and center to the canvas center/edges and to other objects' edges and
    // center, within a screen-space threshold (scaled by zoom so it feels
    // consistent at any zoom level), and surface the matched lines for the
    // SVG overlay to draw. Reads canvas.width/height (Fabric's own tracked
    // dimensions, always current) rather than the totalWidth/totalHeight
    // closure variables, since this effect only runs once on mount.
    const handleObjectMoving = (e: { target?: fabric.FabricObject }) => {
      const target = e.target
      if (!target) return
      const threshold = 8 / zoomRef.current
      const canvasWidth = canvas.width ?? 0
      const canvasHeight = canvas.height ?? 0

      const width = target.getScaledWidth()
      const height = target.getScaledHeight()
      const centerX = target.left ?? 0
      const centerY = target.top ?? 0
      const left = centerX - width / 2
      const right = centerX + width / 2
      const top = centerY - height / 2
      const bottom = centerY + height / 2

      const candidatesX = [0, canvasWidth / 2, canvasWidth]
      const candidatesY = [0, canvasHeight / 2, canvasHeight]
      canvas.getObjects().forEach((obj) => {
        if (obj === target || obj.visible === false) return
        const c = obj.getCenterPoint()
        const w = obj.getScaledWidth()
        const h = obj.getScaledHeight()
        candidatesX.push(c.x - w / 2, c.x, c.x + w / 2)
        candidatesY.push(c.y - h / 2, c.y, c.y + h / 2)
      })

      let bestDx: number | null = null
      for (const edge of [left, centerX, right]) {
        for (const candidate of candidatesX) {
          const dx = candidate - edge
          if (Math.abs(dx) <= threshold && (bestDx === null || Math.abs(dx) < Math.abs(bestDx))) {
            bestDx = dx
          }
        }
      }
      let matchedX: number[] = []
      if (bestDx !== null) {
        const snapped = [left + bestDx, centerX + bestDx, right + bestDx]
        matchedX = [...new Set(candidatesX.filter((c) => snapped.some((s) => Math.abs(c - s) < 0.5)))]
        target.set('left', centerX + bestDx)
      }

      let bestDy: number | null = null
      for (const edge of [top, centerY, bottom]) {
        for (const candidate of candidatesY) {
          const dy = candidate - edge
          if (Math.abs(dy) <= threshold && (bestDy === null || Math.abs(dy) < Math.abs(bestDy))) {
            bestDy = dy
          }
        }
      }
      let matchedY: number[] = []
      if (bestDy !== null) {
        const snapped = [top + bestDy, centerY + bestDy, bottom + bestDy]
        matchedY = [...new Set(candidatesY.filter((c) => snapped.some((s) => Math.abs(c - s) < 0.5)))]
        target.set('top', centerY + bestDy)
      }

      target.setCoords()
      setAlignGuides({ vertical: matchedX, horizontal: matchedY })
    }
    const clearAlignGuides = () => setAlignGuides({ vertical: [], horizontal: [] })

    // Fabric's selection:created/updated events carry `selected`/`deselected`
    // as the *delta* for that specific transition, not the full current
    // selection (e.g. going from 1 to 2 active objects fires with
    // `selected` containing only the newly-added one). Using that directly
    // silently truncated multi-select down to whatever just changed —
    // canvas.getActiveObjects() is the actual full current selection.
    const handleSelectionChange = () => {
      const ids = canvas
        .getActiveObjects()
        .map((obj) => objectToId.current.get(obj))
        .filter((id): id is string => id !== undefined)
      selectLayers(ids)
    }
    const handleSelectionCleared = () => selectLayers([])

    canvas.on('object:modified', handleModified)
    canvas.on('object:moving', handleObjectMoving)
    canvas.on('mouse:up', clearAlignGuides)
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

  // Explicitly trigger the Korean web fonts to download, then force one
  // re-render once they land (see WEB_FONT_FAMILIES comment above).
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return
    const loads = WEB_FONT_FAMILIES.flatMap((family) => [
      document.fonts.load(`16px "${family}"`).catch(() => {}),
      document.fonts.load(`700 16px "${family}"`).catch(() => {}),
    ])
    Promise.all(loads).finally(() => {
      fabricRef.current?.requestRenderAll()
    })
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

    const container = canvasScrollRef.current
    if (container) {
      const availW = container.clientWidth - VIEWPORT_PADDING
      const availH = container.clientHeight - VIEWPORT_PADDING
      const fit = Math.min(availW / totalWidth, availH / totalHeight, 1)
      if (Number.isFinite(fit) && fit > 0) setZoom(clampZoom(fit))
    }
    setPan({ x: 0, y: 0 })
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
          applyTextLayer(existing, layer, folders)
        } else if (layer.type === 'image') {
          applyImageLayer(existing as fabric.FabricImage, layer, folders)
        } else if (layer.type === 'shape') {
          applyShapeStyle(existing, layer, folders)
        }
        canvas.moveObjectTo(existing, index)
        return
      }

      if (layer.type === 'text') {
        const obj = createTextObject(layer, folders)
        idToObject.current.set(layer.id, obj)
        objectToId.current.set(obj, layer.id)
        canvas.add(obj)
        canvas.moveObjectTo(obj, index)
      } else if (layer.type === 'shape') {
        const obj = createShapeObject(layer, folders)
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
            applyImageLayer(img, stillExists as ImageLayer, useEditorStore.getState().folders)
            applyRotateCursor(img)
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

    if (selectedIds.length === 0) {
      if (canvas.getActiveObject()) canvas.discardActiveObject()
    } else if (selectedIds.length === 1) {
      const obj = idToObject.current.get(selectedIds[0])
      if (obj && canvas.getActiveObject() !== obj) {
        canvas.setActiveObject(obj)
      }
    } else {
      const objs = selectedIds
        .map((id) => idToObject.current.get(id))
        .filter((o): o is fabric.FabricObject => o !== undefined)
      if (objs.length > 1) {
        const current = canvas.getActiveObject()
        const alreadyMatches =
          current instanceof fabric.ActiveSelection &&
          current.size() === objs.length &&
          objs.every((o) => current.getObjects().includes(o))
        if (!alreadyMatches) {
          const selection = new fabric.ActiveSelection(objs, { canvas })
          applyRotateCursor(selection)
          canvas.setActiveObject(selection)
        }
      }
    }

    canvas.requestRenderAll()
  }, [layers, folders, selectedIds])

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = fabricRef.current
      if (canvas) exportCanvasAsPng(canvas)
    },
    saveToLocalStorage: () => {
      const canvas = fabricRef.current
      if (canvas) saveToLocalStorage(canvas, layers, presetId, folders)
    },
    loadFromLocalStorage: () => {
      const project = loadFromLocalStorage()
      if (!project) return false
      replaceAll(project.layers, project.presetId, project.folders ?? [])
      return true
    },
    exportProjectFile: () => {
      const canvas = fabricRef.current
      if (canvas) exportProjectFile(canvas, layers, presetId, folders)
    },
    importProjectFile: async (file: File) => {
      const project = await importProjectFile(file)
      replaceAll(project.layers, project.presetId, project.folders ?? [])
    },
    getDesignDataUrl: () => {
      const canvas = fabricRef.current
      if (!canvas || layers.length === 0) return null
      return canvas.toDataURL({ format: 'png', multiplier: 2 })
    },
  }))

  return (
    <div className="canvas-viewport">
      {/* canvas-scroll only centers the frame as a baseline now — panning is
          a `pan` state translate on top of that, not native scrolling, so
          the hand tool can move the canvas freely at any zoom level (even
          zoomed out with nothing to "scroll"), like Photoshop's canvas pan.
          The view controls below live outside this div (as a sibling) so
          they stay pinned to the viewport corner instead of panning away
          with the content. */}
      <div
        className="canvas-scroll"
        ref={canvasScrollRef}
        onPointerDown={isPanning ? undefined : handleBackgroundPointerDown}
        onPointerMove={isPanning ? undefined : handleBackgroundPointerMove}
        onPointerUp={isPanning ? undefined : handleBackgroundPointerUp}
        onPointerCancel={isPanning ? undefined : handleBackgroundPointerUp}
      >
        <div
          ref={zoomFrameRef}
          className="canvas-zoom-frame"
          style={{
            width: totalWidth * zoom,
            height: totalHeight * zoom,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <div
            className="canvas-stage"
            style={{ width: totalWidth, height: totalHeight, transform: `scale(${zoom})` }}
          >
            <canvas ref={canvasElRef} width={totalWidth} height={totalHeight} />
            {showGuides && (
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
            )}
            {(alignGuides.vertical.length > 0 || alignGuides.horizontal.length > 0) && (
              <div className="canvas-align-guides" aria-hidden="true">
                <svg width={totalWidth} height={totalHeight}>
                  {alignGuides.vertical.map((x) => (
                    <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={totalHeight} />
                  ))}
                  {alignGuides.horizontal.map((y) => (
                    <line key={`h-${y}`} x1={0} y1={y} x2={totalWidth} y2={y} />
                  ))}
                </svg>
              </div>
            )}
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

      {marqueeBox && (
        <div
          className="marquee-select-box"
          style={{ left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.w, height: marqueeBox.h }}
        />
      )}

      <div className="canvas-view-controls">
        <button
          type="button"
          className={showGuides ? 'is-active' : ''}
          onClick={() => setShowGuides((v) => !v)}
          title="재단선/안전영역 가이드 표시 전환"
        >
          {showGuides ? '▦' : '▢'}
        </button>
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
