// Pure Fabric object factory/apply functions — building and updating the
// on-canvas fabric.Object for each layer type from its EditorLayer data.
// No React, no refs into the live component: everything here takes the
// layer/folders/object explicitly, so Canvas.tsx's reconciliation effect
// (store -> canvas sync) and buildFlattenedImage (below) can both call the
// same code paths.
import * as fabric from 'fabric'
import type { TComplexPathData } from 'fabric'
import type { EditorLayer, ImageLayer, LayerFolder, PathLayer, ShapeLayer, TextLayer } from '../../types/editor'
import { ROTATE_CURSOR } from '../../utils/cursors'
import {
  buildBorderProps,
  buildFill,
  buildShadow,
  centerFromTopLeft,
  isLayerLocked,
  isLayerVisible,
  pathScale,
  unionBoundingBox,
} from './canvasHelpers'

export const topLeftFromObject = (obj: fabric.FabricObject) => {
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

export const applyCommonTransform = (obj: fabric.FabricObject, layer: EditorLayer, folders: LayerFolder[]) => {
  const visible = isLayerVisible(layer, folders)
  const locked = isLayerLocked(layer, folders)
  obj.set({
    visible,
    opacity: layer.opacity,
    shadow: buildShadow(layer.shadow),
    ...(layer.type === 'shape' || layer.type === 'path' ? {} : buildBorderProps(layer.border)),
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

export const applyTextLayer = (obj: fabric.Textbox, layer: TextLayer, folders: LayerFolder[]) => {
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

export const applyRotateCursor = (obj: fabric.FabricObject) => {
  if (obj.controls.mtr) obj.controls.mtr.cursorStyle = ROTATE_CURSOR
}

export const createTextObject = (layer: TextLayer, folders: LayerFolder[]): fabric.Textbox => {
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

export const applyImageLayer = (obj: fabric.FabricImage, layer: ImageLayer, folders: LayerFolder[]) => {
  const baseWidth = obj.width || 1
  const baseHeight = obj.height || 1
  obj.set({ scaleX: layer.width / baseWidth, scaleY: layer.height / baseHeight })
  applyCommonTransform(obj, layer, folders)
}

export const applyShapeStyle = (obj: fabric.Object, layer: ShapeLayer, folders: LayerFolder[]) => {
  if (layer.shape === 'ellipse') {
    ;(obj as fabric.Ellipse).set({ rx: layer.width / 2, ry: layer.height / 2 })
  } else if (layer.shape === 'line') {
    ;(obj as fabric.Line).set({ x1: 0, y1: 0, x2: layer.width, y2: layer.height })
  } else {
    obj.set({ width: layer.width, height: layer.height })
  }
  obj.set({
    fill: buildFill(layer),
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
  })
  applyCommonTransform(obj, layer, folders)
}

export const createShapeObject = (layer: ShapeLayer, folders: LayerFolder[]): fabric.Object => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  const visible = isLayerVisible(layer, folders)
  const locked = isLayerLocked(layer, folders)
  const common = {
    originX: 'center' as const,
    originY: 'center' as const,
    left: centerX,
    top: centerY,
    angle: layer.rotation,
    fill: buildFill(layer),
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

// A path's own `width`/`height` come from its command data's bounding box
// and never change after the stroke is drawn — so, like an image's natural
// pixel size, matching the stored layer.width/height is purely a matter of
// scale, not of touching the path data itself (see pathScale for the formula
// and why strokeUniform matters here).
export const applyPathStyle = (obj: fabric.Path, layer: PathLayer, folders: LayerFolder[]) => {
  obj.set({
    scaleX: pathScale(obj.width, layer.strokeWidth, layer.width),
    scaleY: pathScale(obj.height, layer.strokeWidth, layer.height),
    fill: layer.fill || '',
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    strokeUniform: true,
  })
  applyCommonTransform(obj, layer, folders)
}

export const createPathObject = (layer: PathLayer, folders: LayerFolder[]): fabric.Path => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  const visible = isLayerVisible(layer, folders)
  const locked = isLayerLocked(layer, folders)
  const obj = new fabric.Path(layer.path as TComplexPathData, {
    originX: 'center',
    originY: 'center',
    left: centerX,
    top: centerY,
    angle: layer.rotation,
    fill: layer.fill || '',
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    strokeUniform: true,
    opacity: layer.opacity,
    shadow: buildShadow(layer.shadow),
    flipX: layer.flipX,
    flipY: layer.flipY,
    globalCompositeOperation: layer.blendMode,
    visible,
    selectable: !locked && visible,
    evented: !locked && visible,
  })
  obj.set({
    scaleX: pathScale(obj.width, layer.strokeWidth, layer.width),
    scaleY: pathScale(obj.height, layer.strokeWidth, layer.height),
  })
  applyRotateCursor(obj)
  return obj
}

// Renders the given layers (in their original z-order) onto a detached,
// off-DOM canvas sized to their combined bounding box, then exports that as
// a single PNG data URL — the raw material for "flatten selection". Reuses
// the exact same object-builders as the live canvas, so shadow/border/
// gradient/opacity/blend-mode/flip/rotation and even clip-mask relationships
// come along for free; multiplier: 2 matches exportCanvasAsPng's own
// convention for crisp (retina-ish) raster output.
export const buildFlattenedImage = async (
  selectedIds: string[],
  layers: EditorLayer[],
  folders: LayerFolder[],
): Promise<{ src: string; x: number; y: number; width: number; height: number } | null> => {
  const idSet = new Set(selectedIds)
  const selected = layers.filter((l) => idSet.has(l.id))
  if (selected.length === 0) return null

  const box = unionBoundingBox(selected)
  const width = Math.max(1, Math.round(box.maxX - box.minX))
  const height = Math.max(1, Math.round(box.maxY - box.minY))
  const temp = new fabric.StaticCanvas(undefined, { width, height })

  // A layer used as a clip mask by another layer *in this same selection*
  // shouldn't also render independently here, matching how the main canvas
  // treats masks (see maskedAwayIds in the reconciliation effect below). A
  // mask whose target isn't part of this selection is left to render
  // normally — an unusual case not worth extra bookkeeping to special-case.
  const maskedAwayIds = new Set(
    selected.map((l) => l.clipPathId).filter((id): id is string => id !== undefined && idSet.has(id)),
  )

  for (const layer of layers) {
    if (!idSet.has(layer.id) || maskedAwayIds.has(layer.id) || !isLayerVisible(layer, folders)) continue

    let obj: fabric.Object | null = null
    if (layer.type === 'text') {
      obj = createTextObject(layer, folders)
    } else if (layer.type === 'shape') {
      obj = createShapeObject(layer, folders)
    } else if (layer.type === 'path') {
      obj = createPathObject(layer, folders)
    } else {
      try {
        const img = await fabric.FabricImage.fromURL(layer.src)
        applyImageLayer(img, layer, folders)
        obj = img
      } catch {
        continue
      }
    }

    // Shift from the original (whole-canvas) coordinate space into this
    // temp canvas's local space, whose (0,0) is the selection box's corner.
    obj.set({ left: (obj.left ?? 0) - box.minX, top: (obj.top ?? 0) - box.minY })

    const maskLayer = layer.clipPathId ? layers.find((l) => l.id === layer.clipPathId) : undefined
    if (maskLayer && maskLayer.type !== 'image') {
      const clipObj =
        maskLayer.type === 'text'
          ? createTextObject(maskLayer, folders)
          : maskLayer.type === 'path'
            ? createPathObject(maskLayer, folders)
            : createShapeObject(maskLayer, folders)
      clipObj.absolutePositioned = true
      clipObj.set({ left: (clipObj.left ?? 0) - box.minX, top: (clipObj.top ?? 0) - box.minY })
      obj.set({ clipPath: clipObj })
    }

    temp.add(obj)
  }

  temp.renderAll()
  const src = temp.toDataURL({ format: 'png', multiplier: 2 })
  temp.dispose()

  return { src, x: box.minX, y: box.minY, width, height }
}
