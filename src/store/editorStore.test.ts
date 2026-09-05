import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editorStore'
import { DEFAULT_PRESET_ID } from '../utils/presets'
import type { ShapeLayer, TextLayer } from '../types/editor'

const initialState = useEditorStore.getState()

beforeEach(() => {
  localStorage.clear()
  useEditorStore.setState(
    {
      ...initialState,
      layers: [],
      folders: [],
      guides: [],
      selectedId: null,
      selectedIds: [],
      presetId: DEFAULT_PRESET_ID,
      past: [],
      future: [],
      recentColors: [],
      drawMode: 'none',
      drawColor: '#111827',
      drawWidth: 4,
    },
    true,
  )
})

describe('addImageLayer', () => {
  it('defaults to x=40, y=40 when no position is given', () => {
    useEditorStore.getState().addImageLayer('/x.png', 100, 80)
    const layer = useEditorStore.getState().layers[0]
    expect(layer).toMatchObject({ type: 'image', x: 40, y: 40, width: 100, height: 80 })
  })

  it('places the layer at the given position when provided', () => {
    useEditorStore.getState().addImageLayer('/x.png', 100, 80, { x: 12, y: 34 })
    const layer = useEditorStore.getState().layers[0]
    expect(layer).toMatchObject({ x: 12, y: 34 })
  })
})

describe('addShapeLayer', () => {
  it('creates a shape layer with sensible per-kind defaults', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const layer = useEditorStore.getState().layers[0] as ShapeLayer
    expect(layer.type).toBe('shape')
    expect(layer.shape).toBe('ellipse')
    expect(layer.width).toBe(120)
    expect(layer.height).toBe(120)
    expect(layer.fill).toBe('#e5e7eb')
    expect(layer.stroke).toBe('#111827')
    expect(layer.strokeWidth).toBe(2)
  })

  it('numbers same-kind shapes sequentially in their name', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    useEditorStore.getState().addShapeLayer('ellipse')
    useEditorStore.getState().addShapeLayer('rectangle')
    const names = useEditorStore.getState().layers.map((l) => l.name)
    expect(names).toEqual(['사각형 1', '타원 1', '사각형 2'])
  })

  it('gives every new layer the generic LayerBase defaults', () => {
    useEditorStore.getState().addShapeLayer('triangle')
    const layer = useEditorStore.getState().layers[0]
    expect(layer.opacity).toBe(1)
    expect(layer.shadow).toEqual({ enabled: false, color: '#000000', blur: 10, offsetX: 5, offsetY: 5 })
    expect(layer.border).toEqual({ enabled: false, color: '#000000', width: 2 })
    expect(layer.flipX).toBe(false)
    expect(layer.flipY).toBe(false)
    expect(layer.blendMode).toBe('source-over')
  })
})

describe('updateTextStyle', () => {
  const addAndGetText = () => {
    useEditorStore.getState().addTextLayer()
    return useEditorStore.getState().layers[0] as TextLayer
  }

  it('toggles fontWeight independently of fontStyle', () => {
    const text = addAndGetText()
    useEditorStore.getState().updateTextStyle(text.id, { fontWeight: 'bold' })
    let updated = useEditorStore.getState().layers[0] as TextLayer
    expect(updated.fontWeight).toBe('bold')
    expect(updated.fontStyle).toBe('normal')

    useEditorStore.getState().updateTextStyle(text.id, { fontStyle: 'italic' })
    updated = useEditorStore.getState().layers[0] as TextLayer
    expect(updated.fontWeight).toBe('bold')
    expect(updated.fontStyle).toBe('italic')
  })

  it('updates charSpacing and lineHeight independently', () => {
    const text = addAndGetText()
    useEditorStore.getState().updateTextStyle(text.id, { charSpacing: 150 })
    useEditorStore.getState().updateTextStyle(text.id, { lineHeight: 1.5 })
    const updated = useEditorStore.getState().layers[0] as TextLayer
    expect(updated.charSpacing).toBe(150)
    expect(updated.lineHeight).toBe(1.5)
  })

  it('never touches a non-text layer even when ids collide in theory', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const shapeId = useEditorStore.getState().layers[0].id
    // updateTextStyle guards on layer.type === 'text', so calling it on a
    // shape id must be a no-op rather than throwing or corrupting the shape.
    useEditorStore.getState().updateTextStyle(shapeId, { fontWeight: 'bold' } as never)
    expect(useEditorStore.getState().layers[0]).toEqual(
      expect.objectContaining({ id: shapeId, type: 'shape' }),
    )
  })
})

describe('updateLayerTransform (opacity + blendMode)', () => {
  it('updates opacity without disturbing other fields', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateLayerTransform(id, { opacity: 0.5 })
    const layer = useEditorStore.getState().layers[0]
    expect(layer.opacity).toBe(0.5)
    expect(layer.blendMode).toBe('source-over')
  })

  it('updates blendMode independently of opacity', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateLayerTransform(id, { blendMode: 'multiply' })
    const layer = useEditorStore.getState().layers[0]
    expect(layer.blendMode).toBe('multiply')
    expect(layer.opacity).toBe(1)
  })
})

describe('updateLayerShadow', () => {
  it('merges a partial shadow patch, preserving untouched fields', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateLayerShadow(id, { enabled: true, blur: 25 })
    const shadow = useEditorStore.getState().layers[0].shadow
    expect(shadow).toEqual({ enabled: true, color: '#000000', blur: 25, offsetX: 5, offsetY: 5 })
  })

  it('preserves the last color/blur/offset across a disable/re-enable cycle', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateLayerShadow(id, { enabled: true, color: '#ff0000', blur: 30 })
    useEditorStore.getState().updateLayerShadow(id, { enabled: false })
    useEditorStore.getState().updateLayerShadow(id, { enabled: true })
    const shadow = useEditorStore.getState().layers[0].shadow
    expect(shadow).toEqual({ enabled: true, color: '#ff0000', blur: 30, offsetX: 5, offsetY: 5 })
  })
})

describe('updateLayerBorder', () => {
  it('merges a partial border patch, preserving untouched fields', () => {
    useEditorStore.getState().addTextLayer()
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateLayerBorder(id, { enabled: true, width: 8 })
    const border = useEditorStore.getState().layers[0].border
    expect(border).toEqual({ enabled: true, color: '#000000', width: 8 })
  })
})

describe('flipLayer', () => {
  it('toggles flipX and flipY independently', () => {
    useEditorStore.getState().addImageLayer('/x.png', 100, 100)
    const id = useEditorStore.getState().layers[0].id

    useEditorStore.getState().flipLayer(id, 'horizontal')
    let layer = useEditorStore.getState().layers[0]
    expect(layer.flipX).toBe(true)
    expect(layer.flipY).toBe(false)

    useEditorStore.getState().flipLayer(id, 'vertical')
    layer = useEditorStore.getState().layers[0]
    expect(layer.flipX).toBe(true)
    expect(layer.flipY).toBe(true)

    useEditorStore.getState().flipLayer(id, 'horizontal')
    layer = useEditorStore.getState().layers[0]
    expect(layer.flipX).toBe(false)
    expect(layer.flipY).toBe(true)
  })
})

describe('addRecentColor', () => {
  it('prepends a newly used color', () => {
    useEditorStore.getState().addRecentColor('#ff0000')
    useEditorStore.getState().addRecentColor('#00ff00')
    expect(useEditorStore.getState().recentColors).toEqual(['#00ff00', '#ff0000'])
  })

  it('dedupes case-insensitively by moving the existing entry to the front', () => {
    useEditorStore.getState().addRecentColor('#ff0000')
    useEditorStore.getState().addRecentColor('#00ff00')
    useEditorStore.getState().addRecentColor('#FF0000')
    expect(useEditorStore.getState().recentColors).toEqual(['#FF0000', '#00ff00'])
  })

  it('caps the list at 12 entries', () => {
    for (let i = 0; i < 15; i++) {
      useEditorStore.getState().addRecentColor(`#${i.toString(16).padStart(6, '0')}`)
    }
    expect(useEditorStore.getState().recentColors).toHaveLength(12)
  })

  it('persists to localStorage', () => {
    useEditorStore.getState().addRecentColor('#123456')
    expect(JSON.parse(localStorage.getItem('w2p-recent-colors') ?? '[]')).toEqual(['#123456'])
  })

  it('is not part of undo history', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const pastLengthBefore = useEditorStore.getState().past.length
    useEditorStore.getState().addRecentColor('#123456')
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('undo/redo for the new layer-style actions', () => {
  it('undoes an opacity change back to the previous value', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateLayerTransform(id, { opacity: 0.3 })
    expect(useEditorStore.getState().layers[0].opacity).toBe(0.3)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().layers[0].opacity).toBe(1)

    useEditorStore.getState().redo()
    expect(useEditorStore.getState().layers[0].opacity).toBe(0.3)
  })

  it('undoes a flip back to its previous state', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().flipLayer(id, 'horizontal')
    expect(useEditorStore.getState().layers[0].flipX).toBe(true)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().layers[0].flipX).toBe(false)
  })
})

// Adds a rectangle at an explicit x/y/width/height, sidestepping
// addShapeLayer's fixed (40, 40) default so tests can set up layers at
// distinct, known positions.
const addRectAt = (x: number, y: number, width = 100, height = 50) => {
  useEditorStore.getState().addShapeLayer('rectangle')
  const layers = useEditorStore.getState().layers
  const id = layers[layers.length - 1].id
  useEditorStore.getState().updateLayerTransform(id, { x, y, width, height })
  return id
}

const xyOf = (id: string) => {
  const layer = useEditorStore.getState().layers.find((l) => l.id === id)!
  return { x: layer.x, y: layer.y }
}

describe('alignLayers', () => {
  it('is a no-op with fewer than 2 ids', () => {
    const id = addRectAt(10, 10)
    useEditorStore.getState().alignLayers([id], 'left')
    expect(xyOf(id).x).toBe(10)
  })

  it('aligns left to the minimum x among the selection, not the canvas', () => {
    const idA = addRectAt(50, 0)
    const idB = addRectAt(200, 0)
    useEditorStore.getState().alignLayers([idA, idB], 'left')
    expect(xyOf(idA).x).toBe(50)
    expect(xyOf(idB).x).toBe(50)
  })

  it('centers horizontally on the selection bounding box', () => {
    const idA = addRectAt(0, 0, 100, 50) // spans 0-100
    const idB = addRectAt(300, 0, 100, 50) // spans 300-400 -> bbox center 200
    useEditorStore.getState().alignLayers([idA, idB], 'center-x')
    expect(xyOf(idA).x).toBe(150)
    expect(xyOf(idB).x).toBe(150)
  })

  it('aligns bottom to the lowest bottom edge among the selection', () => {
    const idA = addRectAt(0, 0, 100, 50) // bottom edge 50
    const idB = addRectAt(0, 200, 100, 100) // bottom edge 300
    useEditorStore.getState().alignLayers([idA, idB], 'bottom')
    expect(xyOf(idA).y).toBe(250) // 300 - 50
    expect(xyOf(idB).y).toBe(200) // unchanged, it already set the max
  })
})

describe('distributeLayers', () => {
  it('is a no-op with fewer than 3 ids', () => {
    const idA = addRectAt(0, 0)
    const idB = addRectAt(500, 0)
    useEditorStore.getState().distributeLayers([idA, idB], 'horizontal')
    expect(xyOf(idA).x).toBe(0)
    expect(xyOf(idB).x).toBe(500)
  })

  it('equalizes horizontal gaps between edges, keeping the ends fixed', () => {
    // Three 100-wide boxes with very uneven spacing (close, then far).
    const idA = addRectAt(0, 0, 100, 50)
    const idB = addRectAt(120, 0, 100, 50)
    const idC = addRectAt(500, 0, 100, 50)
    useEditorStore.getState().distributeLayers([idA, idB, idC], 'horizontal')
    const a = xyOf(idA)
    const b = xyOf(idB)
    const c = xyOf(idC)
    expect(a.x).toBe(0)
    expect(c.x).toBe(500)
    expect(b.x).toBe(250)
    expect(b.x - (a.x + 100)).toBe(c.x - (b.x + 100))
  })

  it('equalizes vertical gaps the same way', () => {
    const idA = addRectAt(0, 0, 50, 100)
    const idB = addRectAt(0, 120, 50, 100)
    const idC = addRectAt(0, 500, 50, 100)
    useEditorStore.getState().distributeLayers([idA, idB, idC], 'vertical')
    expect(xyOf(idA).y).toBe(0)
    expect(xyOf(idC).y).toBe(500)
    const b = xyOf(idB).y
    expect(b - (xyOf(idA).y + 100)).toBe(xyOf(idC).y - (b + 100))
  })

  it('sorts by position first, so passing ids out of spatial order still works', () => {
    const idA = addRectAt(0, 0, 100, 50)
    const idB = addRectAt(120, 0, 100, 50)
    const idC = addRectAt(500, 0, 100, 50)
    useEditorStore.getState().distributeLayers([idC, idA, idB], 'horizontal')
    expect(xyOf(idA).x).toBe(0)
    expect(xyOf(idC).x).toBe(500)
  })
})

describe('applyCanvasModification (Transform Again delta capture)', () => {
  it('records a move delta', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { x: 50, y: 30 })
    expect(useEditorStore.getState().lastTransform).toEqual({ dx: 50, dy: 30, dRotation: 0 })
  })

  it('records a rotation delta independently of position', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { rotation: 45 })
    expect(useEditorStore.getState().lastTransform).toEqual({ dx: 0, dy: 0, dRotation: 45 })
  })

  it('does not overwrite the last transform with a no-op modification (e.g. a finished text edit that moved nothing)', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { x: 50, y: 30 })
    useEditorStore.getState().applyCanvasModification(idA, { x: 50, y: 30 })
    expect(useEditorStore.getState().lastTransform).toEqual({ dx: 50, dy: 30, dRotation: 0 })
  })
})

describe('repeatLastTransform', () => {
  it('is a no-op with nothing recorded yet', () => {
    const id = addRectAt(10, 10)
    useEditorStore.getState().selectLayer(id)
    useEditorStore.getState().repeatLastTransform()
    expect(xyOf(id)).toEqual({ x: 10, y: 10 })
  })

  it('is a no-op with nothing selected', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { x: 20, y: 20 })
    useEditorStore.getState().selectLayer(null)
    useEditorStore.getState().repeatLastTransform()
    expect(xyOf(idA)).toEqual({ x: 20, y: 20 })
  })

  it('reapplies a recorded move delta to a different, currently selected layer', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { x: 50, y: 30 })

    const idB = addRectAt(100, 100)
    useEditorStore.getState().selectLayer(idB)
    useEditorStore.getState().repeatLastTransform()
    expect(xyOf(idB)).toEqual({ x: 150, y: 130 })
  })

  it('adds the recorded rotation delta to the target layer\'s own existing rotation', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { rotation: 30 })

    const idB = addRectAt(50, 50)
    useEditorStore.getState().updateLayerTransform(idB, { rotation: 10 })
    useEditorStore.getState().selectLayer(idB)
    useEditorStore.getState().repeatLastTransform()
    expect(useEditorStore.getState().layers.find((l) => l.id === idB)!.rotation).toBe(40)
  })

  it('keeps applying the same delta on repeated calls (Cmd+D pressed multiple times)', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { x: 10, y: 5 })

    const idB = addRectAt(0, 0)
    useEditorStore.getState().selectLayer(idB)
    useEditorStore.getState().repeatLastTransform()
    useEditorStore.getState().repeatLastTransform()
    expect(xyOf(idB)).toEqual({ x: 20, y: 10 })
  })

  it('is undoable in a single step', () => {
    const idA = addRectAt(0, 0)
    useEditorStore.getState().applyCanvasModification(idA, { x: 10, y: 5 })

    const idB = addRectAt(0, 0)
    useEditorStore.getState().selectLayer(idB)
    useEditorStore.getState().repeatLastTransform()
    expect(xyOf(idB)).toEqual({ x: 10, y: 5 })

    useEditorStore.getState().undo()
    expect(xyOf(idB)).toEqual({ x: 0, y: 0 })
  })
})

describe('updateShapeGradient', () => {
  it('defaults to a disabled linear gradient on a new shape layer', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const layer = useEditorStore.getState().layers[0] as ShapeLayer
    expect(layer.gradient).toEqual({
      enabled: false,
      type: 'linear',
      angle: 90,
      colorStops: ['#2563eb', '#e5e7eb'],
    })
  })

  it('merges a partial gradient patch, preserving untouched fields', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateShapeGradient(id, { enabled: true, type: 'radial' })
    const gradient = (useEditorStore.getState().layers[0] as ShapeLayer).gradient
    expect(gradient).toEqual({ enabled: true, type: 'radial', angle: 90, colorStops: ['#2563eb', '#e5e7eb'] })
  })

  it('preserves the last color stops/angle across a disable/re-enable cycle', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().updateShapeGradient(id, {
      enabled: true,
      angle: 45,
      colorStops: ['#ff0000', '#00ff00'],
    })
    useEditorStore.getState().updateShapeGradient(id, { enabled: false })
    useEditorStore.getState().updateShapeGradient(id, { enabled: true })
    const gradient = (useEditorStore.getState().layers[0] as ShapeLayer).gradient
    expect(gradient).toEqual({ enabled: true, type: 'linear', angle: 45, colorStops: ['#ff0000', '#00ff00'] })
  })

  it('is a no-op on a non-shape layer', () => {
    useEditorStore.getState().addTextLayer()
    const id = useEditorStore.getState().layers[0].id
    const before = useEditorStore.getState().layers[0]
    useEditorStore.getState().updateShapeGradient(id, { enabled: true } as never)
    expect(useEditorStore.getState().layers[0]).toEqual(before)
  })
})

describe('setClipMask / removeClipMask', () => {
  it('sets clipPathId on the target to the mask id', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const maskId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const targetId = useEditorStore.getState().layers[1].id

    useEditorStore.getState().setClipMask(maskId, targetId)
    expect(useEditorStore.getState().layers.find((l) => l.id === targetId)!.clipPathId).toBe(maskId)
  })

  it('repositions the mask to sit directly above the target in z-order', () => {
    useEditorStore.getState().addShapeLayer('rectangle') // index 0: target
    const targetId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('ellipse') // index 1: mask (starts far from target)
    const maskId = useEditorStore.getState().layers[1].id
    useEditorStore.getState().addShapeLayer('triangle') // index 2: unrelated, should stay put
    const otherId = useEditorStore.getState().layers[2].id

    useEditorStore.getState().setClipMask(maskId, targetId)
    const ids = useEditorStore.getState().layers.map((l) => l.id)
    const targetIndex = ids.indexOf(targetId)
    expect(ids[targetIndex + 1]).toBe(maskId)
    expect(ids).toContain(otherId)
    expect(ids).toHaveLength(3)
  })

  it('is a no-op when asked to mask a layer with itself', () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const id = useEditorStore.getState().layers[0].id
    useEditorStore.getState().setClipMask(id, id)
    expect(useEditorStore.getState().layers[0].clipPathId).toBeUndefined()
  })

  it('refuses an image layer as a mask source', () => {
    useEditorStore.getState().addImageLayer('/x.png', 100, 100)
    const maskId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const targetId = useEditorStore.getState().layers[1].id

    useEditorStore.getState().setClipMask(maskId, targetId)
    expect(useEditorStore.getState().layers.find((l) => l.id === targetId)!.clipPathId).toBeUndefined()
  })

  it('refuses a direct two-layer cycle (A clips B, B clips A)', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const aId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const bId = useEditorStore.getState().layers[1].id

    useEditorStore.getState().setClipMask(aId, bId) // A clips B
    useEditorStore.getState().setClipMask(bId, aId) // attempt B clips A — refused
    expect(useEditorStore.getState().layers.find((l) => l.id === aId)!.clipPathId).toBeUndefined()
    expect(useEditorStore.getState().layers.find((l) => l.id === bId)!.clipPathId).toBe(aId)
  })

  it("joins the target's folder to preserve its contiguous-run invariant", () => {
    useEditorStore.getState().addShapeLayer('rectangle')
    const targetId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('triangle')
    const folderMateId = useEditorStore.getState().layers[1].id
    useEditorStore.getState().groupLayers([targetId, folderMateId])
    const folderId = useEditorStore.getState().layers.find((l) => l.id === targetId)!.folderId

    useEditorStore.getState().addShapeLayer('ellipse')
    const maskId = useEditorStore.getState().layers[useEditorStore.getState().layers.length - 1].id
    useEditorStore.getState().setClipMask(maskId, targetId)

    expect(useEditorStore.getState().layers.find((l) => l.id === maskId)!.folderId).toBe(folderId)
  })

  it('removeClipMask clears the relationship', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const maskId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const targetId = useEditorStore.getState().layers[1].id
    useEditorStore.getState().setClipMask(maskId, targetId)

    useEditorStore.getState().removeClipMask(targetId)
    expect(useEditorStore.getState().layers.find((l) => l.id === targetId)!.clipPathId).toBeUndefined()
  })

  it('is undoable in a single step', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const maskId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const targetId = useEditorStore.getState().layers[1].id

    useEditorStore.getState().setClipMask(maskId, targetId)
    expect(useEditorStore.getState().layers.find((l) => l.id === targetId)!.clipPathId).toBe(maskId)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().layers.find((l) => l.id === targetId)!.clipPathId).toBeUndefined()
  })
})

describe('addGuide / updateGuide / removeGuide / clearGuides', () => {
  it('adds a guide with the given axis and position', () => {
    useEditorStore.getState().addGuide('vertical', 42)
    expect(useEditorStore.getState().guides).toEqual([
      expect.objectContaining({ axis: 'vertical', position: 42 }),
    ])
  })

  it('assigns each guide a unique id', () => {
    useEditorStore.getState().addGuide('horizontal', 10)
    useEditorStore.getState().addGuide('horizontal', 20)
    const [a, b] = useEditorStore.getState().guides
    expect(a.id).not.toBe(b.id)
  })

  it('updateGuide repositions a guide by id without touching others', () => {
    useEditorStore.getState().addGuide('vertical', 10)
    useEditorStore.getState().addGuide('vertical', 20)
    const [first, second] = useEditorStore.getState().guides
    useEditorStore.getState().updateGuide(first.id, 99)
    const guides = useEditorStore.getState().guides
    expect(guides.find((g) => g.id === first.id)!.position).toBe(99)
    expect(guides.find((g) => g.id === second.id)!.position).toBe(20)
  })

  it('removeGuide deletes only the targeted guide', () => {
    useEditorStore.getState().addGuide('horizontal', 10)
    useEditorStore.getState().addGuide('horizontal', 20)
    const [first, second] = useEditorStore.getState().guides
    useEditorStore.getState().removeGuide(first.id)
    const guides = useEditorStore.getState().guides
    expect(guides).toHaveLength(1)
    expect(guides[0].id).toBe(second.id)
  })

  it('clearGuides removes every guide', () => {
    useEditorStore.getState().addGuide('horizontal', 10)
    useEditorStore.getState().addGuide('vertical', 20)
    useEditorStore.getState().clearGuides()
    expect(useEditorStore.getState().guides).toEqual([])
  })

  it('is undoable in a single step', () => {
    useEditorStore.getState().addGuide('vertical', 42)
    expect(useEditorStore.getState().guides).toHaveLength(1)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().guides).toHaveLength(0)
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().guides).toHaveLength(1)
  })

  it('replaceAll resets guides — session-only scaffolding, not tied to a loaded project', () => {
    useEditorStore.getState().addGuide('vertical', 42)
    useEditorStore.getState().replaceAll([], DEFAULT_PRESET_ID)
    expect(useEditorStore.getState().guides).toEqual([])
  })
})

describe('replaceLayersWithImage', () => {
  it('replaces the given layers with a single image layer using the given geometry', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const aId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const bId = useEditorStore.getState().layers[1].id

    useEditorStore.getState().replaceLayersWithImage([aId, bId], {
      src: 'data:image/png;base64,x',
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    })

    const { layers } = useEditorStore.getState()
    expect(layers).toHaveLength(1)
    expect(layers[0].type).toBe('image')
    expect(layers[0]).toMatchObject({ x: 10, y: 20, width: 300, height: 200 })
  })

  it('positions the new layer at the topmost z-order of the merged layers', () => {
    useEditorStore.getState().addShapeLayer('ellipse') // A
    const aId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle') // B — stays, in between
    const bId = useEditorStore.getState().layers[1].id
    useEditorStore.getState().addShapeLayer('triangle') // C
    const cId = useEditorStore.getState().layers[2].id

    useEditorStore.getState().replaceLayersWithImage([aId, cId], {
      src: 'x',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })

    const { layers } = useEditorStore.getState()
    expect(layers.map((l) => l.id)).toEqual([bId, layers[1].id])
    expect(layers[1].type).toBe('image')
  })

  it("joins the merged layers' folder when they all share the same one", () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const aId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle')
    const bId = useEditorStore.getState().layers[1].id
    useEditorStore.getState().groupLayers([aId, bId])
    const folderId = useEditorStore.getState().layers.find((l) => l.id === aId)!.folderId

    useEditorStore.getState().replaceLayersWithImage([aId, bId], {
      src: 'x',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })

    expect(useEditorStore.getState().layers[0].folderId).toBe(folderId)
  })

  it('leaves the new layer without a folder when the merged layers span different folders', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const aId = useEditorStore.getState().layers[0].id
    useEditorStore.getState().addShapeLayer('rectangle') // ungrouped

    useEditorStore.getState().replaceLayersWithImage([aId, useEditorStore.getState().layers[1].id], {
      src: 'x',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })

    expect(useEditorStore.getState().layers[0].folderId).toBeUndefined()
  })

  it('selects the new image layer', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const aId = useEditorStore.getState().layers[0].id

    useEditorStore.getState().replaceLayersWithImage([aId], { src: 'x', x: 0, y: 0, width: 10, height: 10 })

    const newId = useEditorStore.getState().layers[0].id
    expect(useEditorStore.getState().selectedId).toBe(newId)
    expect(useEditorStore.getState().selectedIds).toEqual([newId])
  })

  it('is undoable in a single step', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    useEditorStore.getState().addShapeLayer('rectangle')

    const ids = useEditorStore.getState().layers.map((l) => l.id)
    useEditorStore.getState().replaceLayersWithImage(ids, { src: 'x', x: 0, y: 0, width: 10, height: 10 })
    expect(useEditorStore.getState().layers).toHaveLength(1)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().layers.map((l) => l.id)).toEqual(ids)
  })

  it('is a no-op for an empty id list', () => {
    useEditorStore.getState().addShapeLayer('ellipse')
    const before = useEditorStore.getState().layers

    useEditorStore.getState().replaceLayersWithImage([], { src: 'x', x: 0, y: 0, width: 10, height: 10 })

    expect(useEditorStore.getState().layers).toBe(before)
  })
})

describe('drawMode / drawColor / drawWidth', () => {
  it('setDrawMode switches the active brush', () => {
    useEditorStore.getState().setDrawMode('circle')
    expect(useEditorStore.getState().drawMode).toBe('circle')
  })

  it('setDrawWidth clamps to a minimum of 1', () => {
    useEditorStore.getState().setDrawWidth(-5)
    expect(useEditorStore.getState().drawWidth).toBe(1)
  })

  it('is not undoable — a tool setting, not document content', () => {
    useEditorStore.getState().setDrawMode('spray')
    useEditorStore.getState().setDrawColor('#ff0000')
    expect(useEditorStore.getState().past).toHaveLength(0)
  })
})

describe('addPathLayer / updatePathStyle', () => {
  const SAMPLE_PATH = [
    ['M', 0, 0],
    ['L', 10, 10],
  ]

  it('creates a path layer with the given command data, geometry and style', () => {
    useEditorStore.getState().addPathLayer(
      SAMPLE_PATH,
      { x: 5, y: 6, width: 100, height: 80 },
      { stroke: '#111827', strokeWidth: 4 },
    )

    const layer = useEditorStore.getState().layers[0]
    expect(layer).toMatchObject({
      type: 'path',
      path: SAMPLE_PATH,
      x: 5,
      y: 6,
      width: 100,
      height: 80,
      stroke: '#111827',
      strokeWidth: 4,
      fill: '',
    })
  })

  it('selects the new path layer', () => {
    useEditorStore
      .getState()
      .addPathLayer(SAMPLE_PATH, { x: 0, y: 0, width: 10, height: 10 }, { stroke: '#000', strokeWidth: 1 })

    const id = useEditorStore.getState().layers[0].id
    expect(useEditorStore.getState().selectedId).toBe(id)
  })

  it('is undoable in a single step', () => {
    useEditorStore
      .getState()
      .addPathLayer(SAMPLE_PATH, { x: 0, y: 0, width: 10, height: 10 }, { stroke: '#000', strokeWidth: 1 })
    expect(useEditorStore.getState().layers).toHaveLength(1)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().layers).toHaveLength(0)
  })

  it('updatePathStyle changes stroke/strokeWidth/fill on the target path layer only', () => {
    useEditorStore
      .getState()
      .addPathLayer(SAMPLE_PATH, { x: 0, y: 0, width: 10, height: 10 }, { stroke: '#000', strokeWidth: 1 })
    const id = useEditorStore.getState().layers[0].id

    useEditorStore.getState().updatePathStyle(id, { stroke: '#e11d48', strokeWidth: 6 })

    const layer = useEditorStore.getState().layers.find((l) => l.id === id)
    expect(layer).toMatchObject({ stroke: '#e11d48', strokeWidth: 6 })
  })
})
