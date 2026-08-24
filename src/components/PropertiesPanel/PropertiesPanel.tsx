import { useEffect, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { TextLayer } from '../../types/editor'
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

interface NumberFieldProps {
  label: string
  value: number
  suffix?: string
  onCommit: (value: number) => void
}

function NumberField({ label, value, suffix, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(Math.round(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(Math.round(value)))
  }, [value, focused])

  const commit = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) {
      onCommit(parsed)
    } else {
      setDraft(String(Math.round(value)))
    }
  }

  return (
    <label className="prop-field prop-field-number">
      <span>{label}</span>
      <div className="prop-input-wrap">
        <input
          type="number"
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {suffix && <span className="prop-suffix">{suffix}</span>}
      </div>
    </label>
  )
}

export function PropertiesPanel() {
  const layers = useEditorStore((s) => s.layers)
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateLayerTransform = useEditorStore((s) => s.updateLayerTransform)
  const updateTextStyle = useEditorStore((s) => s.updateTextStyle)
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
    </div>
  )
}
