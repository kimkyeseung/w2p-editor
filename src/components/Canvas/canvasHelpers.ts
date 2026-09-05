import * as fabric from 'fabric'
import type { EditorLayer, LayerBorder, LayerFolder, LayerShadow } from '../../types/editor'

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
