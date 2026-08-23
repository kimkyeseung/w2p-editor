import type { CanvasPreset } from '../types/editor'

export const MM_TO_PX = 3.7795275591

export const mmToPx = (mm: number): number => Math.round(mm * MM_TO_PX)

export const CANVAS_PRESETS: CanvasPreset[] = [
  {
    id: 'business-card',
    label: '명함 (90 x 50mm)',
    widthMm: 90,
    heightMm: 50,
    bleedMm: 2,
    safeMarginMm: 3,
  },
  {
    id: 'poster-a4',
    label: '포스터 (A4, 210 x 297mm)',
    widthMm: 210,
    heightMm: 297,
    bleedMm: 3,
    safeMarginMm: 5,
  },
  {
    id: 'square-card',
    label: '정사각 카드 (100 x 100mm)',
    widthMm: 100,
    heightMm: 100,
    bleedMm: 2,
    safeMarginMm: 4,
  },
]

export const DEFAULT_PRESET_ID = CANVAS_PRESETS[0].id

export const getPresetById = (id: string): CanvasPreset =>
  CANVAS_PRESETS.find((preset) => preset.id === id) ?? CANVAS_PRESETS[0]
