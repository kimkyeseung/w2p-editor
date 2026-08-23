export type LayerType = 'text' | 'image'

export interface LayerBase {
  id: string
  type: LayerType
  name: string
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
}

export interface ImageLayer extends LayerBase {
  type: 'image'
  src: string
}

export type EditorLayer = TextLayer | ImageLayer

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
  savedAt: string
}
