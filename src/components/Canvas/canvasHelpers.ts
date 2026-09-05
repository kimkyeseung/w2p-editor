import * as fabric from 'fabric'
import type { EditorLayer, LayerBorder, LayerFolder, LayerShadow, ShapeLayer } from '../../types/editor'

// Fabric.js v6+ positions objects by their CENTER (originX/originY default to
// 'center'), not their top-left corner. Our EditorLayer model — and the
// properties panel — works in "top-left" coordinates (the usual mental model
// for print/design tools), so every read/write to a Fabric object converts
// between the two. Rotation always pivots around the object's own center,
// which matches standard design-tool UX (Figma/Canva do the same).
export const centerFromTopLeft = (layer: Pick<EditorLayer, 'x' | 'y' | 'width' | 'height'>) => ({
  centerX: layer.x + layer.width / 2,
  centerY: layer.y + layer.height / 2,
})

export const buildShadow = (shadow: LayerShadow): fabric.Shadow | null =>
  shadow.enabled
    ? new fabric.Shadow({
        color: shadow.color,
        blur: shadow.blur,
        offsetX: shadow.offsetX,
        offsetY: shadow.offsetY,
      })
    : null

// Falls back to the shape's plain solid `fill` when the gradient is off —
// the two are mutually exclusive on ShapeLayer, never layered together.
// Coordinates use gradientUnits: 'percentage' (0-1 as a fraction of the
// object's own bounding box) rather than pixels, so the gradient scales
// automatically with the shape and never needs to know its actual size.
export const buildFill = (
  layer: Pick<ShapeLayer, 'fill' | 'gradient' | 'shape'>,
): string | fabric.Gradient<'linear'> | fabric.Gradient<'radial'> => {
  // A line has no fillable area — `fill`/`gradient` are kept on the layer
  // (in case they're ever reused) but never applied to the object.
  if (layer.shape === 'line') return ''
  if (!layer.gradient.enabled) return layer.fill
  const [start, end] = layer.gradient.colorStops
  const colorStops = [
    { offset: 0, color: start },
    { offset: 1, color: end },
  ]
  if (layer.gradient.type === 'radial') {
    return new fabric.Gradient({
      type: 'radial',
      gradientUnits: 'percentage',
      coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
      colorStops,
    })
  }
  const rad = (layer.gradient.angle * Math.PI) / 180
  return new fabric.Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: {
      x1: 0.5 - 0.5 * Math.cos(rad),
      y1: 0.5 - 0.5 * Math.sin(rad),
      x2: 0.5 + 0.5 * Math.cos(rad),
      y2: 0.5 + 0.5 * Math.sin(rad),
    },
    colorStops,
  })
}

// Only meaningful for text/image layers — shape layers already own
// stroke/strokeWidth via ShapeLayer.stroke and apply it themselves in
// applyShapeStyle/createShapeObject, so applying this too would fight over
// Fabric's single stroke/strokeWidth properties on the same object.
export const buildBorderProps = (border: LayerBorder) => ({
  stroke: border.enabled ? border.color : '',
  strokeWidth: border.enabled ? border.width : 0,
})

// `visible` was added after the first release, so projects saved before it
// existed don't have the field — treat only an explicit `false` as hidden.
// A layer's own visible/locked flag is independent of its folder's — a
// folder being hidden/locked masks its members without touching their own
// flags, matching Photoshop's group behavior (unhide the folder and each
// child is back to whatever it was individually set to).
const folderOf = (layer: Pick<EditorLayer, 'folderId'>, folders: LayerFolder[]) =>
  layer.folderId ? folders.find((f) => f.id === layer.folderId) : undefined

export const isLayerVisible = (layer: Pick<EditorLayer, 'visible' | 'folderId'>, folders: LayerFolder[]) => {
  if (layer.visible === false) return false
  const folder = folderOf(layer, folders)
  return !folder || folder.visible !== false
}

export const isLayerLocked = (layer: Pick<EditorLayer, 'locked' | 'folderId'>, folders: LayerFolder[]) => {
  if (layer.locked) return true
  const folder = folderOf(layer, folders)
  return !!folder?.locked
}
