import { useEditorStore } from '../../store/editorStore'
import { NumberField } from '../common/NumberField'
import { ColorField } from '../common/ColorField'
import type { PathLayer, ShapeLayer, TextLayer } from '../../types/editor'
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

const BLEND_MODE_OPTIONS: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'source-over', label: '표준' },
  { value: 'multiply', label: '곱하기' },
  { value: 'screen', label: '스크린' },
  { value: 'overlay', label: '오버레이' },
  { value: 'darken', label: '어둡게' },
  { value: 'lighten', label: '밝게' },
  { value: 'color-dodge', label: '색상 닷지' },
  { value: 'color-burn', label: '색상 번' },
  { value: 'hard-light', label: '하드 라이트' },
  { value: 'soft-light', label: '소프트 라이트' },
  { value: 'difference', label: '차이' },
  { value: 'exclusion', label: '제외' },
  { value: 'hue', label: '색조' },
  { value: 'saturation', label: '채도' },
  { value: 'color', label: '색상' },
  { value: 'luminosity', label: '광도' },
]

export function PropertiesPanel() {
  const layers = useEditorStore((s) => s.layers)
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateLayerTransform = useEditorStore((s) => s.updateLayerTransform)
  const updateLayerShadow = useEditorStore((s) => s.updateLayerShadow)
  const updateLayerBorder = useEditorStore((s) => s.updateLayerBorder)
  const flipLayer = useEditorStore((s) => s.flipLayer)
  const updateTextStyle = useEditorStore((s) => s.updateTextStyle)
  const updateShapeStyle = useEditorStore((s) => s.updateShapeStyle)
  const updateShapeGradient = useEditorStore((s) => s.updateShapeGradient)
  const updatePathStyle = useEditorStore((s) => s.updatePathStyle)
  const renameLayer = useEditorStore((s) => s.renameLayer)
  const alignLayer = useEditorStore((s) => s.alignLayer)
  const alignLayers = useEditorStore((s) => s.alignLayers)
  const alignLayersToCanvas = useEditorStore((s) => s.alignLayersToCanvas)
  const distributeLayers = useEditorStore((s) => s.distributeLayers)

  const layer = layers.find((l) => l.id === selectedId)

  if (selectedIds.length > 1) {
    return (
      <div className="properties-panel">
        <h2 className="panel-title">속성</h2>
        <p className="prop-empty">{selectedIds.length}개 오브젝트가 선택되었습니다.</p>

        <div className="prop-section">
          <span className="prop-section-title">정렬 (선택 항목 기준)</span>
          <div className="prop-align-grid">
            <button type="button" onClick={() => alignLayers(selectedIds, 'left')}>
              좌측
            </button>
            <button type="button" onClick={() => alignLayers(selectedIds, 'center-x')}>
              가로 중앙
            </button>
            <button type="button" onClick={() => alignLayers(selectedIds, 'right')}>
              우측
            </button>
            <button type="button" onClick={() => alignLayers(selectedIds, 'top')}>
              상단
            </button>
            <button type="button" onClick={() => alignLayers(selectedIds, 'center-y')}>
              세로 중앙
            </button>
            <button type="button" onClick={() => alignLayers(selectedIds, 'bottom')}>
              하단
            </button>
          </div>
        </div>

        <div className="prop-section">
          <span className="prop-section-title">정렬 (캔버스 기준)</span>
          <div className="prop-align-grid">
            <button type="button" onClick={() => alignLayersToCanvas(selectedIds, 'left')}>
              좌측
            </button>
            <button type="button" onClick={() => alignLayersToCanvas(selectedIds, 'center-x')}>
              가로 중앙
            </button>
            <button type="button" onClick={() => alignLayersToCanvas(selectedIds, 'right')}>
              우측
            </button>
            <button type="button" onClick={() => alignLayersToCanvas(selectedIds, 'top')}>
              상단
            </button>
            <button type="button" onClick={() => alignLayersToCanvas(selectedIds, 'center-y')}>
              세로 중앙
            </button>
            <button type="button" onClick={() => alignLayersToCanvas(selectedIds, 'bottom')}>
              하단
            </button>
          </div>
        </div>

        {selectedIds.length >= 3 && (
          <div className="prop-section">
            <span className="prop-section-title">균등 분포</span>
            <div className="prop-align-grid prop-cols-2">
              <button type="button" onClick={() => distributeLayers(selectedIds, 'horizontal')}>
                가로 분포
              </button>
              <button type="button" onClick={() => distributeLayers(selectedIds, 'vertical')}>
                세로 분포
              </button>
            </div>
          </div>
        )}

        <p className="prop-empty">함께 드래그해서 이동하거나, 레이어 패널에서 일괄 복제/삭제할 수 있습니다.</p>
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
  const pathLayer = layer.type === 'path' ? (layer as PathLayer) : null

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
        <NumberField
          label="불투명도"
          value={layer.opacity * 100}
          suffix="%"
          onCommit={(v) => updateLayerTransform(layer.id, { opacity: Math.min(1, Math.max(0, v / 100)) })}
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

      <div className="prop-section">
        <span className="prop-section-title">반전</span>
        <div className="prop-align-grid prop-align-text prop-cols-2">
          <button
            type="button"
            className={layer.flipX ? 'is-active' : ''}
            onClick={() => flipLayer(layer.id, 'horizontal')}
          >
            가로 반전
          </button>
          <button
            type="button"
            className={layer.flipY ? 'is-active' : ''}
            onClick={() => flipLayer(layer.id, 'vertical')}
          >
            세로 반전
          </button>
        </div>
        <label className="prop-field">
          <span>블렌드 모드</span>
          <select
            value={layer.blendMode}
            onChange={(e) =>
              updateLayerTransform(layer.id, { blendMode: e.target.value as GlobalCompositeOperation })
            }
          >
            {BLEND_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="prop-section">
        <label className="prop-field prop-field-checkbox">
          <input
            type="checkbox"
            checked={layer.shadow.enabled}
            onChange={(e) => updateLayerShadow(layer.id, { enabled: e.target.checked })}
          />
          <span>그림자 효과</span>
        </label>
        {layer.shadow.enabled && (
          <>
            <ColorField
              label="그림자 색상"
              value={layer.shadow.color}
              onChange={(color) => updateLayerShadow(layer.id, { color })}
            />
            <NumberField
              label="흐림 정도"
              value={layer.shadow.blur}
              onCommit={(v) => updateLayerShadow(layer.id, { blur: Math.max(0, v) })}
            />
            <div className="prop-grid">
              <NumberField
                label="X 오프셋"
                value={layer.shadow.offsetX}
                onCommit={(v) => updateLayerShadow(layer.id, { offsetX: v })}
              />
              <NumberField
                label="Y 오프셋"
                value={layer.shadow.offsetY}
                onCommit={(v) => updateLayerShadow(layer.id, { offsetY: v })}
              />
            </div>
          </>
        )}
      </div>

      {!shapeLayer && !pathLayer && (
        <div className="prop-section">
          <label className="prop-field prop-field-checkbox">
            <input
              type="checkbox"
              checked={layer.border.enabled}
              onChange={(e) => updateLayerBorder(layer.id, { enabled: e.target.checked })}
            />
            <span>테두리</span>
          </label>
          {layer.border.enabled && (
            <>
              <ColorField
                label="테두리 색상"
                value={layer.border.color}
                onChange={(color) => updateLayerBorder(layer.id, { color })}
              />
              <NumberField
                label="테두리 굵기"
                value={layer.border.width}
                onCommit={(v) => updateLayerBorder(layer.id, { width: Math.max(0, v) })}
              />
            </>
          )}
        </div>
      )}

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
          <div className="prop-align-grid prop-align-text prop-cols-2">
            <button
              type="button"
              className={textLayer.fontWeight === 'bold' ? 'is-active' : ''}
              style={{ fontWeight: 'bold' }}
              onClick={() =>
                updateTextStyle(textLayer.id, {
                  fontWeight: textLayer.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
            >
              굵게
            </button>
            <button
              type="button"
              className={textLayer.fontStyle === 'italic' ? 'is-active' : ''}
              style={{ fontStyle: 'italic' }}
              onClick={() =>
                updateTextStyle(textLayer.id, {
                  fontStyle: textLayer.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
            >
              기울임
            </button>
          </div>
          <div className="prop-grid">
            <NumberField
              label="자간"
              value={textLayer.charSpacing}
              onCommit={(v) => updateTextStyle(textLayer.id, { charSpacing: v })}
            />
            <NumberField
              label="행간"
              value={textLayer.lineHeight}
              step={0.1}
              onCommit={(v) => updateTextStyle(textLayer.id, { lineHeight: Math.max(0.1, v) })}
            />
          </div>
          <ColorField
            label="색상"
            value={textLayer.color}
            onChange={(color) => updateTextStyle(textLayer.id, { color })}
          />
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
            <>
              {!shapeLayer.gradient.enabled && (
                <ColorField
                  label="채우기"
                  value={shapeLayer.fill}
                  onChange={(color) => updateShapeStyle(shapeLayer.id, { fill: color })}
                />
              )}
              <label className="prop-field prop-field-checkbox">
                <input
                  type="checkbox"
                  checked={shapeLayer.gradient.enabled}
                  onChange={(e) => updateShapeGradient(shapeLayer.id, { enabled: e.target.checked })}
                />
                <span>그라디언트</span>
              </label>
              {shapeLayer.gradient.enabled && (
                <>
                  <div className="prop-align-grid prop-align-text prop-cols-2">
                    <button
                      type="button"
                      className={shapeLayer.gradient.type === 'linear' ? 'is-active' : ''}
                      onClick={() => updateShapeGradient(shapeLayer.id, { type: 'linear' })}
                    >
                      선형
                    </button>
                    <button
                      type="button"
                      className={shapeLayer.gradient.type === 'radial' ? 'is-active' : ''}
                      onClick={() => updateShapeGradient(shapeLayer.id, { type: 'radial' })}
                    >
                      방사형
                    </button>
                  </div>
                  {shapeLayer.gradient.type === 'linear' && (
                    <NumberField
                      label="각도"
                      value={shapeLayer.gradient.angle}
                      suffix="°"
                      onCommit={(v) => updateShapeGradient(shapeLayer.id, { angle: v })}
                    />
                  )}
                  <div className="prop-grid">
                    <ColorField
                      label="시작 색상"
                      value={shapeLayer.gradient.colorStops[0]}
                      onChange={(color) =>
                        updateShapeGradient(shapeLayer.id, {
                          colorStops: [color, shapeLayer.gradient.colorStops[1]],
                        })
                      }
                    />
                    <ColorField
                      label="끝 색상"
                      value={shapeLayer.gradient.colorStops[1]}
                      onChange={(color) =>
                        updateShapeGradient(shapeLayer.id, {
                          colorStops: [shapeLayer.gradient.colorStops[0], color],
                        })
                      }
                    />
                  </div>
                </>
              )}
            </>
          )}
          <ColorField
            label="선 색상"
            value={shapeLayer.stroke}
            onChange={(color) => updateShapeStyle(shapeLayer.id, { stroke: color })}
          />
          <NumberField
            label="선 굵기"
            value={shapeLayer.strokeWidth}
            onCommit={(v) => updateShapeStyle(shapeLayer.id, { strokeWidth: Math.max(0, v) })}
          />
        </div>
      )}

      {pathLayer && (
        <div className="prop-section">
          <span className="prop-section-title">그리기</span>
          <ColorField
            label="선 색상"
            value={pathLayer.stroke}
            onChange={(color) => updatePathStyle(pathLayer.id, { stroke: color })}
          />
          <NumberField
            label="선 굵기"
            value={pathLayer.strokeWidth}
            onCommit={(v) => updatePathStyle(pathLayer.id, { strokeWidth: Math.max(0, v) })}
          />
        </div>
      )}
    </div>
  )
}
