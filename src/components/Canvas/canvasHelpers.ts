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

// A path layer is sized purely via scale (see createPathObject/
// applyPathStyle in Canvas.tsx) rather than by touching its path data, and
// is rendered with `strokeUniform: true` so resizing stretches the drawn
// line, not the pen width. With strokeUniform, Fabric's own dimension
// formula is additive rather than multiplicative — `getScaledWidth()`
// returns `rawWidth * scaleX + strokeWidth`, not `(rawWidth + strokeWidth)
// * scaleX` — so the scale needed to reach a given on-canvas `targetSize`
// is `(targetSize - strokeWidth) / rawSize`. Solving it this way (rather
// than against the bare raw size) keeps every read-back of the object's
// size after a resize landing exactly back on what was stored, with zero
// drift on repeated round trips.
//
// `rawSize` is legitimately 0 for a perfectly horizontal or vertical
// freehand stroke (the path's own bounding box has no extent on that axis).
// Without strokeUniform this made a resize balloon the *stroke itself* by
// whatever huge factor was needed to fake a nonzero height out of a
// zero-height shape — turning a thin line into a solid black block, since
// canvas stroke rendering scales anisotropically with a non-uniform
// transform. With strokeUniform, `0 * scale` is still unconditionally 0, so
// there is no scale value that changes the rendered size on that axis at
// all — matching the real constraint (a flat line can't gain height by
// scaling alone, only its position/width can move) rather than distorting
// the stroke to fake it. The scale value returned in that case is
// unobservable (any value renders identically), so 1 is as good as any.
// Floor rather than 0/negative: a target smaller than the stroke itself
// (shrinking a thick brush stroke down small) would otherwise solve to a
// negative scale, which Fabric renders as a mirror-flip — a second, subtler
// version of the same "resize does something visually nonsensical" bug this
// function exists to prevent.
const MIN_PATH_SCALE = 0.01

export const pathScale = (rawSize: number, strokeWidth: number, targetSize: number) =>
  rawSize > 0 ? Math.max((targetSize - strokeWidth) / rawSize, MIN_PATH_SCALE) : 1

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

// The layer's actual on-canvas footprint — its unrotated x/y/width/height is
// only its bounding box when rotation is 0; anything else needs its four
// corners rotated around the center and re-bounded.
export const layerBoundingBox = (layer: Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>) => {
  const { centerX, centerY } = centerFromTopLeft(layer)
  if (layer.rotation % 360 === 0) {
    return { minX: layer.x, minY: layer.y, maxX: layer.x + layer.width, maxY: layer.y + layer.height }
  }
  const rad = (layer.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hw = layer.width / 2
  const hh = layer.height / 2
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => ({ x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos }))
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

// The combined footprint of a whole set of layers — e.g. for flattening a
// multi-layer selection down to a single image sized to fit all of them.
export const unionBoundingBox = (layers: Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>[]) => {
  const boxes = layers.map(layerBoundingBox)
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  }
}
