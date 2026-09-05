export type LayerType = 'text' | 'image' | 'shape'

// Kept as a single required object (rather than an optional `shadow?`) so
// toggling the effect off and back on preserves the last color/blur/offset
// the user dialed in, instead of resetting to defaults each time.
export interface LayerShadow {
  enabled: boolean
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

// Only rendered for text/image layers — shape layers already expose their
// own outline via `stroke`/`strokeWidth` on ShapeLayer, so applying this too
// would fight over Fabric's single stroke/strokeWidth object properties.
export interface LayerBorder {
  enabled: boolean
  color: string
  width: number
}

export interface LayerBase {
  id: string
  type: LayerType
  name: string
  locked: boolean
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
  // 0-1, applies to every layer type (Fabric's own opacity range).
  opacity: number
  shadow: LayerShadow
  border: LayerBorder
  // Layers sharing a folderId are kept contiguous in the layers array (that
  // contiguous run *is* the folder's position in z-order) — a folder has no
  // z-order slot of its own, it's purely a layer-panel grouping concept.
  folderId?: string
}

export interface LayerFolder {
  id: string
  name: string
  locked: boolean
  visible: boolean
  collapsed: boolean
}

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  // Fabric's own units: charSpacing is 1/1000 em (so 100 = +0.1em per
  // character), lineHeight is a unitless multiplier of font size (Fabric's
  // own default is 1.16, not CSS's "normal").
  charSpacing: number
  lineHeight: number
}

export interface ImageLayer extends LayerBase {
  type: 'image'
  src: string
}

export type ShapeKind = 'rectangle' | 'ellipse' | 'triangle' | 'line'

export interface ShapeLayer extends LayerBase {
  type: 'shape'
  shape: ShapeKind
  fill: string
  stroke: string
  strokeWidth: number
}

export type EditorLayer = TextLayer | ImageLayer | ShapeLayer

export interface CanvasPreset {
  id: string
  label: string
  widthMm: number
  heightMm: number
  bleedMm: number
  safeMarginMm: number
}

export interface EditorSnapshot {
  layers: EditorLayer[]
  selectedId: string | null
}

export interface PersistedProject {
  version: 1
  presetId: string
  fabricJson: unknown
  layers: EditorLayer[]
  folders: LayerFolder[]
  savedAt: string
}

// A project as stored by the REST API demo — see src/utils/api.ts and api/projects/.
export interface ApiProject {
  id: string
  name: string
  presetId: string
  layers: EditorLayer[]
  folders: LayerFolder[]
  savedAt: string
}
