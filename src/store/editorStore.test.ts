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
      selectedId: null,
      selectedIds: [],
      presetId: DEFAULT_PRESET_ID,
      past: [],
      future: [],
      recentColors: [],
    },
    true,
  )
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
