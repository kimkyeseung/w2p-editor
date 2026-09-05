import { describe, expect, it } from 'vitest'
import * as fabric from 'fabric'
import { buildBorderProps, buildShadow, isLayerLocked, isLayerVisible } from './canvasHelpers'
import type { LayerBorder, LayerShadow } from '../../types/editor'

describe('buildShadow', () => {
  it('returns null when the shadow is disabled', () => {
    const shadow: LayerShadow = { enabled: false, color: '#ff0000', blur: 20, offsetX: 5, offsetY: 5 }
    expect(buildShadow(shadow)).toBeNull()
  })

  it('builds a fabric.Shadow with the stored color/blur/offset when enabled', () => {
    const shadow: LayerShadow = { enabled: true, color: '#ff0000', blur: 20, offsetX: 8, offsetY: 3 }
    const result = buildShadow(shadow)
    expect(result).toBeInstanceOf(fabric.Shadow)
    expect(result?.color).toBe('#ff0000')
    expect(result?.blur).toBe(20)
    expect(result?.offsetX).toBe(8)
    expect(result?.offsetY).toBe(3)
  })
})

describe('buildBorderProps', () => {
  it('clears stroke/strokeWidth when the border is disabled', () => {
    const border: LayerBorder = { enabled: false, color: '#ff0000', width: 6 }
    expect(buildBorderProps(border)).toEqual({ stroke: '', strokeWidth: 0 })
  })

  it('applies the stored color/width when enabled', () => {
    const border: LayerBorder = { enabled: true, color: '#00ff00', width: 6 }
    expect(buildBorderProps(border)).toEqual({ stroke: '#00ff00', strokeWidth: 6 })
  })
})

describe('isLayerVisible', () => {
  it('is visible by default with no folder', () => {
    expect(isLayerVisible({ visible: true, folderId: undefined }, [])).toBe(true)
  })

  it('is hidden when its own flag is explicitly false, regardless of folder state', () => {
    expect(isLayerVisible({ visible: false, folderId: undefined }, [])).toBe(false)
  })

  it('is hidden when its folder is hidden, even if the layer itself is visible', () => {
    const folders = [{ id: 'f1', name: 'Folder', locked: false, visible: false, collapsed: false }]
    expect(isLayerVisible({ visible: true, folderId: 'f1' }, folders)).toBe(false)
  })

  it('is visible when its folder is visible again, without needing its own flag touched', () => {
    const folders = [{ id: 'f1', name: 'Folder', locked: false, visible: true, collapsed: false }]
    expect(isLayerVisible({ visible: true, folderId: 'f1' }, folders)).toBe(true)
  })
})

describe('isLayerLocked', () => {
  it('is locked when its own flag is set', () => {
    expect(isLayerLocked({ locked: true, folderId: undefined }, [])).toBe(true)
  })

  it('is locked when its folder is locked, even if the layer itself is not', () => {
    const folders = [{ id: 'f1', name: 'Folder', locked: true, visible: true, collapsed: false }]
    expect(isLayerLocked({ locked: false, folderId: 'f1' }, folders)).toBe(true)
  })

  it('is unlocked when neither the layer nor its folder is locked', () => {
    const folders = [{ id: 'f1', name: 'Folder', locked: false, visible: true, collapsed: false }]
    expect(isLayerLocked({ locked: false, folderId: 'f1' }, folders)).toBe(false)
  })
})
