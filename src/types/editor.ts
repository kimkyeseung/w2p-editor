export type LayerType = 'text' | 'image' | 'shape'

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
