import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { useEditorStore } from '../../store/editorStore'
import { getPresetById, mmToPx } from '../../utils/presets'
import type { EditorGuide, ImageLayer, TextLayer } from '../../types/editor'
import {
  exportCanvasAsPng,
  importProjectFile,
  loadFromLocalStorage,
  saveToLocalStorage,
  exportProjectFile,
} from '../../utils/canvasSerialization'
import {
  applyImageLayer,
  applyPathStyle,
  applyRotateCursor,
  applyShapeStyle,
  applyTextLayer,
  buildFlattenedImage,
  createPathObject,
  createShapeObject,
  createTextObject,
  topLeftFromObject,
} from './fabricObjects'
import { RULER_SIZE, VIEWPORT_PADDING, clampZoom, isTypingTarget, pickTickIntervalMm } from './canvasView'
import { ContextMenu } from '../ContextMenu/ContextMenu'
import { useCanvasContextMenu } from './useCanvasContextMenu'
import './Canvas.css'

export interface CanvasHandle {
  exportPng: () => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => boolean
  exportProjectFile: () => void
  importProjectFile: (file: File) => Promise<void>
  getDesignDataUrl: () => string | null
  flattenSelection: () => Promise<void>
}



export const Canvas = forwardRef<CanvasHandle>((_props, ref) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const zoomFrameRef = useRef<HTMLDivElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const idToObject = useRef(new Map<string, fabric.FabricObject>())
  const objectToId = useRef(new WeakMap<fabric.FabricObject, string>())
  // Snapshot of each layer's x/y as of the last reconciliation pass — used
  // only to detect "a currently-grouped object's stored position just
  // changed" (see the reconciliation effect below). Deliberately a plain
  // diff against our own last-seen values rather than reading Fabric's own
  // geometry APIs, which reflect Fabric's internal group-relative<->absolute
  // conversion and proved unreliable for this specific comparison — using
  // them here caused spurious mismatches while simply building a
  // multi-selection (no position had actually changed), which triggered a
  // discard -> selection:cleared -> store update -> re-render loop.
  const prevPositionsRef = useRef(new Map<string, { x: number; y: number }>())
  const pendingImageIds = useRef(new Set<string>())
  // Font families we've already asked the browser to fetch (see the web-font
  // effect below) — lets that effect skip families it has already kicked
  // off instead of re-requesting them on every layers change.
  const requestedFontsRef = useRef(new Set<string>())
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
  // A guide being dragged out fresh from a ruler (not committed to the store
  // until drop, so canceling — releasing outside the canvas — is free) or an
  // existing guide being repositioned (committed on release; see the
  // handlers below for why this isn't pushed to the store on every pixel of
  // movement the way a normal layer drag isn't either).
  const [pendingGuide, setPendingGuide] = useState<{ axis: 'horizontal' | 'vertical'; position: number } | null>(
    null,
  )
  const [draggingGuide, setDraggingGuide] = useState<{ id: string; position: number } | null>(null)
  const isPanning = panMode || spaceHeld

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const layers = useEditorStore((s) => s.layers)
  const folders = useEditorStore((s) => s.folders)
  const guides = useEditorStore((s) => s.guides)
  const addGuide = useEditorStore((s) => s.addGuide)
  const updateGuide = useEditorStore((s) => s.updateGuide)
  const removeGuide = useEditorStore((s) => s.removeGuide)
  const clearGuides = useEditorStore((s) => s.clearGuides)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const presetId = useEditorStore((s) => s.presetId)
  const selectLayers = useEditorStore((s) => s.selectLayers)
  const applyCanvasModification = useEditorStore((s) => s.applyCanvasModification)
  const replaceAll = useEditorStore((s) => s.replaceAll)
  const markSaved = useEditorStore((s) => s.markSaved)
  const replaceLayersWithImage = useEditorStore((s) => s.replaceLayersWithImage)
  const removeLayers = useEditorStore((s) => s.removeLayers)
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers)
  const copyLayers = useEditorStore((s) => s.copyLayers)
  const pasteLayers = useEditorStore((s) => s.pasteLayers)
  const clipboard = useEditorStore((s) => s.clipboard)
  const groupLayers = useEditorStore((s) => s.groupLayers)
  const ungroupLayer = useEditorStore((s) => s.ungroupLayer)
  const reorderLayer = useEditorStore((s) => s.reorderLayer)
  const drawMode = useEditorStore((s) => s.drawMode)
  const drawColor = useEditorStore((s) => s.drawColor)
  const drawWidth = useEditorStore((s) => s.drawWidth)

  const { contextMenu, handleContextMenu, closeContextMenu, buildContextMenuEntries } = useCanvasContextMenu({
    fabricRef,
    idToObject,
    layers,
    selectedIds,
    selectLayers,
    isPanning,
    clipboard,
    copyLayers,
    pasteLayers,
    removeLayers,
    duplicateLayers,
    groupLayers,
    ungroupLayer,
    reorderLayer,
  })

  // "저장" only ever wrote to localStorage — nothing read it back until the
  // user explicitly clicked "불러오기", so a plain page refresh after saving
  // looked like the work had vanished. Restore automatically once on mount
  // instead; the store always starts empty, so there's nothing of the
  // current session to clobber.
  useEffect(() => {
    const project = loadFromLocalStorage()
    if (project) replaceAll(project.layers, project.presetId, project.folders ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Converts a mouse event's viewport-space (clientX/Y) coordinates into
  // logical canvas-space units (the same units as every layer's x/y and a
  // guide's position), inverting frameRect's placement of the canvas origin.
  const clientToLogical = (clientX: number, clientY: number) => {
    const frame = frameRect(zoom, pan.x, pan.y)
    if (!frame) return { x: 0, y: 0 }
    return { x: (clientX - frame.left) / zoom, y: (clientY - frame.top) / zoom }
  }

  // Ruler tick layout — recomputed every render (cheap: at most a few dozen
  // ticks) so panning/zooming keeps them aligned with the canvas underneath.
  // originX/Y is the canvas's logical (0,0) expressed in canvas-scroll's own
  // local pixels (matches frameRect's math, but relative to the container
  // rather than the viewport, since the ruler strips share that container's
  // coordinate space — see the .ruler-horizontal/.ruler-vertical CSS).
  const rulerContainer = canvasScrollRef.current
  const originX = ((rulerContainer?.clientWidth ?? 0) - totalWidth * zoom) / 2 + pan.x
  const originY = ((rulerContainer?.clientHeight ?? 0) - totalHeight * zoom) / 2 + pan.y
  const tickIntervalMm = pickTickIntervalMm(zoom)
  const totalWidthMm = preset.widthMm + preset.bleedMm * 2
  const totalHeightMm = preset.heightMm + preset.bleedMm * 2
  const horizontalTicks: number[] = []
  for (let mm = 0; mm <= totalWidthMm; mm += tickIntervalMm) horizontalTicks.push(mm)
  const verticalTicks: number[] = []
  for (let mm = 0; mm <= totalHeightMm; mm += tickIntervalMm) verticalTicks.push(mm)

  // Dragging out from a ruler creates a new guide; tracked purely in local
  // state (not committed to the store) until release, so this costs nothing
  // to abandon. Matches Illustrator/Photoshop's "drag a guide off the ruler"
  // convention, minus their "drag it back to cancel" — released anywhere
  // commits it here, and a stray one is one double-click away from gone.
  const handleRulerPointerDown = (axis: 'horizontal' | 'vertical', e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Capture can legitimately fail to acquire (e.g. the pointer was
      // already released) — the drag still works via move/up bubbling to
      // this same element in the common case, just without the "follow
      // across other elements" guarantee capture normally provides.
    }
    const { x, y } = clientToLogical(e.clientX, e.clientY)
    setPendingGuide({ axis, position: Math.round(axis === 'horizontal' ? y : x) })
  }
  const handleRulerPointerMove = (axis: 'horizontal' | 'vertical', e: React.PointerEvent<HTMLDivElement>) => {
    if (!pendingGuide) return
    const { x, y } = clientToLogical(e.clientX, e.clientY)
    setPendingGuide({ axis, position: Math.round(axis === 'horizontal' ? y : x) })
  }
  const handleRulerPointerUp = () => {
    if (pendingGuide) addGuide(pendingGuide.axis, pendingGuide.position)
    setPendingGuide(null)
  }

  const handleGuidePointerDown = (guide: EditorGuide, e: React.PointerEvent<SVGLineElement>) => {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // See the matching comment in handleRulerPointerDown.
    }
    setDraggingGuide({ id: guide.id, position: guide.position })
  }
  const handleGuidePointerMove = (e: React.PointerEvent<SVGLineElement>) => {
    if (!draggingGuide) return
    const guide = guides.find((g) => g.id === draggingGuide.id)
    if (!guide) return
    const { x, y } = clientToLogical(e.clientX, e.clientY)
    setDraggingGuide({ id: guide.id, position: Math.round(guide.axis === 'horizontal' ? y : x) })
  }
  const handleGuidePointerUp = () => {
    if (draggingGuide) updateGuide(draggingGuide.id, draggingGuide.position)
    setDraggingGuide(null)
  }
  const handleGuideDoubleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeGuide(id)
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
      // Fabric defaults to true here, which swallows the native contextmenu
      // event (preventDefault + stopPropagation) before it ever bubbles up
      // to our own onContextMenu on canvas-scroll — right-click silently did
      // nothing. Our handler calls preventDefault itself, so the browser's
      // native menu still never shows.
      stopContextMenu: false,
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
      // Read live rather than closing over `guides` — this handler is wired
      // up once at mount (see this effect's empty dep array), so a closed-
      // over value would go stale the moment a guide is added or moved.
      useEditorStore.getState().guides.forEach((guide) => {
        if (guide.axis === 'vertical') candidatesX.push(guide.position)
        else candidatesY.push(guide.position)
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

    // A finished freehand stroke arrives as a fully-formed Fabric object
    // Fabric already added to the canvas itself — remove that raw one and
    // hand its data to the store instead, so the *next* reconciliation pass
    // creates the "real" object via createPathObject like every other layer
    // (keeping idToObject/objectToId in sync, which this raw object bypassed).
    //
    // Only PencilBrush finishes as an actual fabric.Path — CircleBrush and
    // SprayBrush finish as a fabric.Group of primitive shapes (circles /
    // rects) with no `.path` data at all, which silently produced an empty,
    // invisible PathLayer before this check existed. A Group's dot pattern
    // has no sensible SVG-path representation, so it's rasterized into an
    // image layer instead (same off-screen-canvas technique the "merge
    // selection" flatten feature uses) rather than forced into PathLayer.
    const handlePathCreated = (e: { path?: fabric.FabricObject }) => {
      const created = e.path
      if (!created) return
      const topLeft = topLeftFromObject(created)
      canvas.remove(created)

      if (created instanceof fabric.Path) {
        useEditorStore.getState().addPathLayer(
          created.path,
          {
            x: Math.round(topLeft.x),
            y: Math.round(topLeft.y),
            width: Math.round(topLeft.width),
            height: Math.round(topLeft.height),
          },
          {
            stroke: (created.stroke as string) || useEditorStore.getState().drawColor,
            strokeWidth: created.strokeWidth ?? useEditorStore.getState().drawWidth,
          },
        )
        return
      }

      const width = Math.max(1, Math.round(topLeft.width))
      const height = Math.max(1, Math.round(topLeft.height))
      const temp = new fabric.StaticCanvas(undefined, { width, height })
      created.set({ originX: 'center', originY: 'center', left: width / 2, top: height / 2 })
      temp.add(created)
      temp.renderAll()
      const src = temp.toDataURL({ format: 'png', multiplier: 2 })
      temp.dispose()
      useEditorStore.getState().addImageLayer(src, width, height, {
        x: Math.round(topLeft.x),
        y: Math.round(topLeft.y),
      })
    }

    canvas.on('object:modified', handleModified)
    canvas.on('object:moving', handleObjectMoving)
    canvas.on('mouse:up', clearAlignGuides)
    canvas.on('selection:created', handleSelectionChange)
    canvas.on('selection:updated', handleSelectionChange)
    canvas.on('selection:cleared', handleSelectionCleared)
    canvas.on('path:created', handlePathCreated)

    return () => {
      canvas.dispose()
      fabricRef.current = null
      idToObject.current.clear()
      objectToId.current = new WeakMap()
      pendingImageIds.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drawing-mode toggle and brush settings are ephemeral store state (see
  // the drawMode comment in editorStore.ts) rather than per-layer data, so
  // they're pushed onto the canvas directly here instead of going through
  // the layer reconciliation effect.
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.isDrawingMode = drawMode !== 'none'
    if (drawMode === 'none') return
    const brush =
      drawMode === 'circle'
        ? new fabric.CircleBrush(canvas)
        : drawMode === 'spray'
          ? new fabric.SprayBrush(canvas)
          : new fabric.PencilBrush(canvas)
    brush.color = drawColor
    brush.width = drawWidth
    canvas.freeDrawingBrush = brush
  }, [drawMode, drawColor, drawWidth])

  // Web fonts loaded via <link> in index.html aren't fetched until something
  // actually renders text with them — and unlike DOM text, canvas text draws
  // once with whatever's available *right now* and never repaints itself
  // when the real font finishes loading. A one-time fetch on mount used to
  // cover this, but it missed exactly the case that mattered: picking a
  // sample preset (or loading/importing a project) well after mount adds
  // text in fonts that were never requested, so it stayed on the system
  // fallback until some unrelated interaction (e.g. selecting the layer)
  // forced a re-render. Re-derive the fonts actually in use from `layers`
  // instead, and explicitly kick off (and re-render after) whichever of
  // them haven't been requested yet.
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return
    const families = new Set(
      layers.filter((l): l is TextLayer => l.type === 'text').map((l) => l.fontFamily),
    )
    const toLoad = [...families].filter((family) => !requestedFontsRef.current.has(family))
    if (toLoad.length === 0) return
    toLoad.forEach((family) => requestedFontsRef.current.add(family))
    const loads = toLoad.flatMap((family) => [
      document.fonts.load(`16px "${family}"`).catch(() => {}),
      document.fonts.load(`700 16px "${family}"`).catch(() => {}),
      document.fonts.load(`italic 16px "${family}"`).catch(() => {}),
    ])
    Promise.all(loads).finally(() => {
      fabricRef.current?.requestRenderAll()
    })
  }, [layers])

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

    // A programmatic multi-object edit (Align/Distribute in the properties
    // panel) changes several layers' x/y while they're all still one live
    // Fabric ActiveSelection. applyCommonTransform below skips writing
    // position for grouped objects (see its comment) because Fabric treats
    // left/top as group-relative while grouped, not canvas-absolute — so a
    // blind write would corrupt the transform. That skip is only safe when
    // the object already sits where the layer says it should (e.g. right
    // after a drag, whose new position was itself read back from Fabric).
    // Detect the other case — the store now disagrees with what's on
    // screen — and discard the group first so the per-object writes below
    // apply normally; the selection-sync block further down rebuilds the
    // ActiveSelection from the same `selectedIds` once positions are fixed,
    // so the multi-select box reappears around the moved objects instead of
    // silently dropping the selection.
    const activeObject = canvas.getActiveObject()
    if (activeObject instanceof fabric.ActiveSelection) {
      const isStale = activeObject.getObjects().some((obj) => {
        const id = objectToId.current.get(obj)
        const layer = id ? layers.find((l) => l.id === id) : undefined
        const prev = id ? prevPositionsRef.current.get(id) : undefined
        if (!layer || !prev) return false
        return layer.x !== prev.x || layer.y !== prev.y
      })
      if (isStale) canvas.discardActiveObject()
    }

    // A layer referenced by another layer's clipPathId is consumed purely as
    // a clip shape (see the LayerBase.clipPathId comment) — it never gets an
    // independent canvas object of its own.
    const maskedAwayIds = new Set(
      layers.map((l) => l.clipPathId).filter((id): id is string => id !== undefined),
    )

    const currentIds = new Set(layers.map((l) => l.id))
    for (const [id, obj] of Array.from(idToObject.current.entries())) {
      if (!currentIds.has(id) || maskedAwayIds.has(id)) {
        canvas.remove(obj)
        idToObject.current.delete(id)
        objectToId.current.delete(obj)
      }
    }

    layers.forEach((layer, index) => {
      if (maskedAwayIds.has(layer.id)) return
      const existing = idToObject.current.get(layer.id)
      if (existing) {
        if (layer.type === 'text' && existing instanceof fabric.Textbox) {
          applyTextLayer(existing, layer, folders)
        } else if (layer.type === 'image') {
          applyImageLayer(existing as fabric.FabricImage, layer, folders)
        } else if (layer.type === 'shape') {
          applyShapeStyle(existing, layer, folders)
        } else if (layer.type === 'path') {
          applyPathStyle(existing as fabric.Path, layer, folders)
        }
        // The apply* calls above write left/top/scale/angle directly rather
        // than through Fabric's own interactive transform flow, which is the
        // only other path that keeps an object's cached corner coordinates
        // (oCoords/aCoords — what the selection box's 9 handles are drawn
        // from) in sync. Without this, undoing a resize snaps the object's
        // own rendering back correctly but leaves its still-selected control
        // box stuck at the pre-undo size until the next click.
        existing.setCoords()
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
      } else if (layer.type === 'path') {
        const obj = createPathObject(layer, folders)
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

    // Sync each layer's Fabric clipPath from its own clipPathId, rebuilding
    // the clip shape fresh every pass so editing the mask layer's own
    // position/size (via the properties panel — it has no canvas object of
    // its own to drag) keeps the clip in sync live. absolutePositioned:true
    // means the clip shape's x/y/rotation are read as ordinary canvas-space
    // coordinates, exactly like any other layer, regardless of the target's
    // own transform.
    layers.forEach((layer) => {
      if (maskedAwayIds.has(layer.id)) return
      const obj = idToObject.current.get(layer.id)
      if (!obj) return
      const maskLayer = layer.clipPathId ? layers.find((l) => l.id === layer.clipPathId) : undefined
      if (!maskLayer || maskLayer.type === 'image') {
        if (obj.clipPath) obj.set({ clipPath: undefined })
        return
      }
      const clipObj =
        maskLayer.type === 'text'
          ? createTextObject(maskLayer, folders)
          : maskLayer.type === 'path'
            ? createPathObject(maskLayer, folders)
            : createShapeObject(maskLayer, folders)
      clipObj.absolutePositioned = true
      obj.set({ clipPath: clipObj })
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

    prevPositionsRef.current = new Map(layers.map((l) => [l.id, { x: l.x, y: l.y }]))

    canvas.requestRenderAll()
  }, [layers, folders, selectedIds])

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = fabricRef.current
      if (canvas) exportCanvasAsPng(canvas)
    },
    saveToLocalStorage: () => {
      const canvas = fabricRef.current
      if (canvas) {
        saveToLocalStorage(canvas, layers, presetId, folders)
        markSaved()
      }
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
    flattenSelection: async () => {
      const result = await buildFlattenedImage(selectedIds, layers, folders)
      if (result) replaceLayersWithImage(selectedIds, result)
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
        onContextMenu={handleContextMenu}
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
            {(guides.length > 0 || pendingGuide) && (
              <div className="canvas-user-guides" aria-hidden="true">
                <svg width={totalWidth} height={totalHeight}>
                  {guides.map((guide) => {
                    const g = draggingGuide && draggingGuide.id === guide.id ? { ...guide, ...draggingGuide } : guide
                    const isVertical = g.axis === 'vertical'
                    const x1 = isVertical ? g.position : 0
                    const y1 = isVertical ? 0 : g.position
                    const x2 = isVertical ? g.position : totalWidth
                    const y2 = isVertical ? totalHeight : g.position
                    return (
                      <g key={guide.id}>
                        <line className="user-guide-line" x1={x1} y1={y1} x2={x2} y2={y2} />
                        <line
                          className="user-guide-hit-area"
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          style={{ cursor: isVertical ? 'ew-resize' : 'ns-resize' }}
                          onPointerDown={(e) => handleGuidePointerDown(guide, e)}
                          onPointerMove={handleGuidePointerMove}
                          onPointerUp={handleGuidePointerUp}
                          onPointerCancel={handleGuidePointerUp}
                          onDoubleClick={(e) => handleGuideDoubleClick(guide.id, e)}
                        />
                      </g>
                    )
                  })}
                  {pendingGuide && (
                    <line
                      className="user-guide-line is-pending"
                      x1={pendingGuide.axis === 'vertical' ? pendingGuide.position : 0}
                      y1={pendingGuide.axis === 'horizontal' ? pendingGuide.position : 0}
                      x2={pendingGuide.axis === 'vertical' ? pendingGuide.position : totalWidth}
                      y2={pendingGuide.axis === 'horizontal' ? pendingGuide.position : totalHeight}
                    />
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed-thickness strips overlaying the canvas-scroll edges — dragging
          out from either one creates a new guide (released anywhere commits
          it; there's no "drag back to cancel" in this v1). Ticks are placed
          in viewport pixels derived from the same origin math as frameRect,
          recomputed on every render so they track pan/zoom live. */}
      <div
        className="ruler ruler-horizontal"
        onPointerDown={(e) => handleRulerPointerDown('horizontal', e)}
        onPointerMove={(e) => handleRulerPointerMove('horizontal', e)}
        onPointerUp={handleRulerPointerUp}
        onPointerCancel={handleRulerPointerUp}
      >
        {horizontalTicks.map((mm) => (
          <div key={mm} className="ruler-tick" style={{ left: originX + mmToPx(mm) * zoom - RULER_SIZE }}>
            <span>{mm}</span>
          </div>
        ))}
      </div>
      <div
        className="ruler ruler-vertical"
        onPointerDown={(e) => handleRulerPointerDown('vertical', e)}
        onPointerMove={(e) => handleRulerPointerMove('vertical', e)}
        onPointerUp={handleRulerPointerUp}
        onPointerCancel={handleRulerPointerUp}
      >
        {verticalTicks.map((mm) => (
          <div key={mm} className="ruler-tick" style={{ top: originY + mmToPx(mm) * zoom - RULER_SIZE }}>
            <span>{mm}</span>
          </div>
        ))}
      </div>
      <div className="ruler-corner" onDoubleClick={() => clearGuides()} title="더블클릭: 가이드 모두 지우기" />

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
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={buildContextMenuEntries(contextMenu.targetIds)}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
})

Canvas.displayName = 'Canvas'
