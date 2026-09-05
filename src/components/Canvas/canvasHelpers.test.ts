import { describe, expect, it } from 'vitest'
import * as fabric from 'fabric'
import {
  buildBorderProps,
  buildFill,
  buildShadow,
  isLayerLocked,
  isLayerVisible,
  pathScaleBase,
} from './canvasHelpers'
import type { LayerBorder, LayerGradient, LayerShadow, ShapeLayer } from '../../types/editor'

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

describe('buildFill', () => {
  const solidGradient: LayerGradient = { enabled: false, type: 'linear', angle: 90, colorStops: ['#000000', '#ffffff'] }

  it('returns the plain solid fill when the gradient is disabled', () => {
    const layer: Pick<ShapeLayer, 'fill' | 'gradient' | 'shape'> = {
      fill: '#ff6600',
      gradient: solidGradient,
      shape: 'rectangle',
    }
    expect(buildFill(layer)).toBe('#ff6600')
  })

  it('returns an empty string for a line regardless of gradient state', () => {
    const layer: Pick<ShapeLayer, 'fill' | 'gradient' | 'shape'> = {
      fill: '#ff6600',
      gradient: { ...solidGradient, enabled: true },
      shape: 'line',
    }
    expect(buildFill(layer)).toBe('')
  })

  it('builds a linear fabric.Gradient with the stored color stops', () => {
    const layer: Pick<ShapeLayer, 'fill' | 'gradient' | 'shape'> = {
      fill: '#ff6600',
      gradient: { enabled: true, type: 'linear', angle: 90, colorStops: ['#111111', '#eeeeee'] },
      shape: 'rectangle',
    }
    const result = buildFill(layer)
    expect(result).toBeInstanceOf(fabric.Gradient)
    const gradient = result as fabric.Gradient<'linear'>
    expect(gradient.type).toBe('linear')
    expect(gradient.gradientUnits).toBe('percentage')
    expect(gradient.colorStops).toEqual([
      { offset: 0, color: '#111111' },
      { offset: 1, color: '#eeeeee' },
    ])
  })

  it('points a 0deg linear gradient horizontally, left to right', () => {
    const layer: Pick<ShapeLayer, 'fill' | 'gradient' | 'shape'> = {
      fill: '#ff6600',
      gradient: { enabled: true, type: 'linear', angle: 0, colorStops: ['#111111', '#eeeeee'] },
      shape: 'rectangle',
    }
    const gradient = buildFill(layer) as fabric.Gradient<'linear'>
    expect(gradient.coords.y1).toBeCloseTo(gradient.coords.y2)
    expect(gradient.coords.x1).toBeLessThan(gradient.coords.x2)
  })

  it('builds a radial fabric.Gradient centered on the shape', () => {
    const layer: Pick<ShapeLayer, 'fill' | 'gradient' | 'shape'> = {
      fill: '#ff6600',
      gradient: { enabled: true, type: 'radial', angle: 0, colorStops: ['#111111', '#eeeeee'] },
      shape: 'ellipse',
    }
    const result = buildFill(layer)
    expect(result).toBeInstanceOf(fabric.Gradient)
    const gradient = result as fabric.Gradient<'radial'>
    expect(gradient.type).toBe('radial')
    expect(gradient.coords).toEqual({ x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 })
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

describe('pathScaleBase', () => {
  it('adds strokeWidth to both dimensions, matching how Fabric folds it into getScaledWidth/Height', () => {
    expect(pathScaleBase(100, 50, 4)).toEqual({ baseWidth: 104, baseHeight: 54 })
  })

  it('falls back to 1 for a zero-width/height path (e.g. a perfectly straight stroke)', () => {
    expect(pathScaleBase(0, 0, 4)).toEqual({ baseWidth: 5, baseHeight: 5 })
  })

  it('round-trips through a resize with zero drift', () => {
    // Reproduces the bug: scale a path to a target size, then simulate Fabric
    // reading its rendered size back via `(objWidth + strokeWidth) * scale`
    // (its own getScaledWidth/Height formula) — the result must land exactly
    // back on the target, or the next store->canvas sync would compound the
    // mismatch into a runaway growth on every resize/deselect round trip.
    const objWidth = 197
    const objHeight = 41
    const strokeWidth = 4
    const targetWidth = 260
    const targetHeight = 90

    const { baseWidth, baseHeight } = pathScaleBase(objWidth, objHeight, strokeWidth)
    const scaleX = targetWidth / baseWidth
    const scaleY = targetHeight / baseHeight

    const renderedWidth = (objWidth + strokeWidth) * scaleX
    const renderedHeight = (objHeight + strokeWidth) * scaleY

    expect(renderedWidth).toBeCloseTo(targetWidth)
    expect(renderedHeight).toBeCloseTo(targetHeight)
  })
})
