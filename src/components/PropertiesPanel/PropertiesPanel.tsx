import { useEditorStore } from '../../store/editorStore'
import { NumberField } from '../common/NumberField'
import type { ShapeLayer, TextLayer } from '../../types/editor'
import './PropertiesPanel.css'

const FONT_OPTIONS = [
  'Noto Sans KR',
  'Nanum Gothic',
  'Nanum Myeongjo',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New',
]

export function PropertiesPanel() {
  const layers = useEditorStore((s) => s.layers)
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateLayerTransform = useEditorStore((s) => s.updateLayerTransform)
  const updateTextStyle = useEditorStore((s) => s.updateTextStyle)
  const updateShapeStyle = useEditorStore((s) => s.updateShapeStyle)
  const renameLayer = useEditorStore((s) => s.renameLayer)
  const alignLayer = useEditorStore((s) => s.alignLayer)

  const layer = layers.find((l) => l.id === selectedId)

  if (selectedIds.length > 1) {
    return (
      <div className="properties-panel">
        <h2 className="panel-title">속성</h2>
        <p className="prop-empty">
          {selectedIds.length}개 오브젝트가 선택되었습니다.
          <br />
          함께 드래그해서 이동하거나, 레이어 패널에서 일괄 복제/삭제할 수 있습니다.
        </p>
      </div>
    )
  }

  if (!layer) {
    return (
      <div className="properties-panel">
        <h2 className="panel-title">속성</h2>
        <p className="prop-empty">캔버스 또는 레이어 목록에서 객체를 선택하세요.</p>
      </div>
    )
  }

  const textLayer = layer.type === 'text' ? (layer as TextLayer) : null
  const shapeLayer = layer.type === 'shape' ? (layer as ShapeLayer) : null

  return (
    <div className="properties-panel">
      <h2 className="panel-title">속성</h2>

      <label className="prop-field">
        <span>이름</span>
        <input
          type="text"
          value={layer.name}
          onChange={(e) => renameLayer(layer.id, e.target.value)}
        />
      </label>

      <div className="prop-grid">
        <NumberField label="X" value={layer.x} onCommit={(v) => updateLayerTransform(layer.id, { x: v })} />
        <NumberField label="Y" value={layer.y} onCommit={(v) => updateLayerTransform(layer.id, { y: v })} />
        <NumberField
          label="W"
          value={layer.width}
          onCommit={(v) => updateLayerTransform(layer.id, { width: Math.max(1, v) })}
        />
        <NumberField
          label="H"
          value={layer.height}
          onCommit={(v) => updateLayerTransform(layer.id, { height: Math.max(1, v) })}
        />
        <NumberField
          label="회전"
          value={layer.rotation}
          suffix="°"
          onCommit={(v) => updateLayerTransform(layer.id, { rotation: v })}
        />
      </div>

      <div className="prop-section">
        <span className="prop-section-title">정렬 (캔버스 기준)</span>
        <div className="prop-align-grid">
          <button type="button" onClick={() => alignLayer(layer.id, 'left')}>
            좌측
          </button>
          <button type="button" onClick={() => alignLayer(layer.id, 'center-x')}>
            가로 중앙
          </button>
          <button type="button" onClick={() => alignLayer(layer.id, 'right')}>
            우측
          </button>
          <button type="button" onClick={() => alignLayer(layer.id, 'top')}>
            상단
          </button>
          <button type="button" onClick={() => alignLayer(layer.id, 'center-y')}>
            세로 중앙
          </button>
          <button type="button" onClick={() => alignLayer(layer.id, 'bottom')}>
            하단
          </button>
        </div>
      </div>

      {textLayer && (
        <div className="prop-section">
          <span className="prop-section-title">텍스트</span>
          <label className="prop-field">
            <span>내용</span>
            <textarea
              rows={3}
              value={textLayer.text}
              onChange={(e) => updateTextStyle(textLayer.id, { text: e.target.value })}
            />
          </label>
          <label className="prop-field">
            <span>폰트</span>
            <select
              value={textLayer.fontFamily}
              onChange={(e) => updateTextStyle(textLayer.id, { fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="크기"
            value={textLayer.fontSize}
            onCommit={(v) => updateTextStyle(textLayer.id, { fontSize: Math.max(1, v) })}
          />
          <label className="prop-field">
            <span>색상</span>
            <input
              type="color"
              value={textLayer.color}
              onChange={(e) => updateTextStyle(textLayer.id, { color: e.target.value })}
            />
          </label>
          <div className="prop-align-grid prop-align-text">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                className={textLayer.align === align ? 'is-active' : ''}
                onClick={() => updateTextStyle(textLayer.id, { align })}
              >
                {align === 'left' ? '왼쪽' : align === 'center' ? '가운데' : '오른쪽'}
              </button>
            ))}
          </div>
        </div>
      )}

      {shapeLayer && (
        <div className="prop-section">
          <span className="prop-section-title">도형</span>
          {shapeLayer.shape !== 'line' && (
            <label className="prop-field">
              <span>채우기</span>
              <input
                type="color"
                value={shapeLayer.fill}
                onChange={(e) => updateShapeStyle(shapeLayer.id, { fill: e.target.value })}
              />
            </label>
          )}
          <label className="prop-field">
            <span>선 색상</span>
            <input
              type="color"
              value={shapeLayer.stroke}
              onChange={(e) => updateShapeStyle(shapeLayer.id, { stroke: e.target.value })}
            />
          </label>
          <NumberField
            label="선 굵기"
            value={shapeLayer.strokeWidth}
            onCommit={(v) => updateShapeStyle(shapeLayer.id, { strokeWidth: Math.max(0, v) })}
          />
        </div>
      )}
    </div>
  )
}
