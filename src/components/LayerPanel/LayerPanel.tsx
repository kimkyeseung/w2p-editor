import { useEditorStore } from '../../store/editorStore'
import './LayerPanel.css'

export function LayerPanel() {
  const layers = useEditorStore((s) => s.layers)
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer)
  const toggleLock = useEditorStore((s) => s.toggleLock)
  const toggleVisible = useEditorStore((s) => s.toggleVisible)
  const reorderLayer = useEditorStore((s) => s.reorderLayer)

  // Render front-most (last in array) first, like most design tools.
  const rows = [...layers].reverse()

  return (
    <div className="layer-panel">
      <h2 className="panel-title">레이어 ({layers.length})</h2>
      {rows.length === 0 && <p className="layer-empty">아직 추가된 레이어가 없습니다.</p>}
      <ul className="layer-list">
        {rows.map((layer) => {
          const visible = layer.visible !== false
          return (
            <li
              key={layer.id}
              className={`layer-row ${layer.id === selectedId ? 'is-selected' : ''} ${visible ? '' : 'is-hidden'}`}
              onClick={() => selectLayer(layer.id)}
            >
              <span className="layer-type-icon" aria-hidden="true">
                {layer.type === 'text' ? 'T' : '🖼'}
              </span>
              <span className="layer-name">{layer.name}</span>
              <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  title={visible ? '숨기기' : '보이기'}
                  onClick={() => toggleVisible(layer.id)}
                >
                  {visible ? '👁' : '‒'}
                </button>
                <button
                  type="button"
                  title="맨 앞으로"
                  onClick={() => reorderLayer(layer.id, 'front')}
                >
                  ⤒
                </button>
                <button
                  type="button"
                  title="맨 뒤로"
                  onClick={() => reorderLayer(layer.id, 'back')}
                >
                  ⤓
                </button>
                <button
                  type="button"
                  title={layer.locked ? '잠금 해제' : '잠금'}
                  className={layer.locked ? 'is-active' : ''}
                  onClick={() => toggleLock(layer.id)}
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>
                <button type="button" title="복제" onClick={() => duplicateLayer(layer.id)}>
                  ⧉
                </button>
                <button type="button" title="삭제" onClick={() => removeLayer(layer.id)}>
                  🗑
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
