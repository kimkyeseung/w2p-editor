import { describe, expect, it } from 'vitest'
import * as fabric from 'fabric'
import {
  buildBorderProps,
  buildFill,
  buildShadow,
  isLayerLocked,
  isLayerVisible,
  pathScale,
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

describe('pathScale', () => {
  it('round-trips through a resize with zero drift (strokeUniform additive formula)', () => {
    // With strokeUniform: true, Fabric's own getScaledWidth/Height formula is
    // `rawSize * scale + strokeWidth` — simulate that read-back after scaling
    // to a target size and confirm it lands exactly on the target, or the
    // next store->canvas sync would compound the mismatch into runaway
    // growth on every resize/deselect round trip.
    const rawWidth = 197
    const rawHeight = 41
    const strokeWidth = 4
    const targetWidth = 260
    const targetHeight = 90

    const scaleX = pathScale(rawWidth, strokeWidth, targetWidth)
    const scaleY = pathScale(rawHeight, strokeWidth, targetHeight)

    expect(rawWidth * scaleX + strokeWidth).toBeCloseTo(targetWidth)
    expect(rawHeight * scaleY + strokeWidth).toBeCloseTo(targetHeight)
  })

  it('returns a scale of exactly 1 for a zero-extent axis (a perfectly straight stroke)', () => {
    // A path's raw bounding box is legitimately 0 along one axis for a
    // perfectly horizontal/vertical freehand stroke. No scale value can make
    // `0 * scale` anything but 0, so the target size is unreachable on that
    // axis regardless — the returned value is unobservable (every scale
    // renders identically), so 1 is as good as any and avoids propagating a
    // divide-by-zero (Infinity/NaN) into Fabric's transform.
    expect(pathScale(0, 4, 90)).toBe(1)
    expect(pathScale(0, 50, 500)).toBe(1)
  })

  it('regression: dragging a flat stroke taller never balloons it past its own stroke width', () => {
    // This is the exact bug report — a perfectly horizontal freehand line
    // (raw height 0) dragged via its bottom-middle resize handle rendered as
    // a solid black block instead of staying a thin line. With strokeUniform
    // and this formula, the *rendered* height on a zero-extent axis is
    // strokeWidth no matter what target was requested, because the geometry
    // contributes exactly 0 regardless of scale — only the object's
    // position/other axis can visibly change from that drag.
    const rawHeight = 0
    const strokeWidth = 4
    const scaleY = pathScale(rawHeight, strokeWidth, 200) // user drags for a 200px-tall result
    // Mirrors Fabric's own getScaledHeight() formula: rawHeight * scaleY + strokeWidth.
    const renderedHeight = rawHeight * scaleY + strokeWidth
    expect(renderedHeight).toBe(strokeWidth)
  })

  it('never returns a non-positive scale, even when the target is smaller than the stroke itself', () => {
    // A target smaller than strokeWidth solves to a negative raw value here
    // — clamped to a small positive floor instead, since Fabric renders a
    // negative scale as a mirror-flip (a second, subtler flavor of "resize
    // does something visually nonsensical" that this function exists to
    // rule out). A floor of exactly 0 wouldn't be safe either — Fabric
    // treats a 0 scale as effectively invisible/degenerate.
    expect(pathScale(100, 20, 5)).toBeGreaterThan(0)
    expect(pathScale(100, 20, 0)).toBeGreaterThan(0)
    expect(pathScale(100, 20, -50)).toBeGreaterThan(0)
  })
})
