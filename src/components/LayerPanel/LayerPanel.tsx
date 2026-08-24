import { useEditorStore } from '../../store/editorStore'
import './LayerPanel.css'

export function LayerPanel() {
  const layers = useEditorStore((s) => s.layers)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const toggleSelectLayer = useEditorStore((s) => s.toggleSelectLayer)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const removeLayers = useEditorStore((s) => s.removeLayers)
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer)
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers)
  const toggleLock = useEditorStore((s) => s.toggleLock)
  const toggleVisible = useEditorStore((s) => s.toggleVisible)
  const reorderLayer = useEditorStore((s) => s.reorderLayer)

  // Render front-most (last in array) first, like most design tools.
  const rows = [...layers].reverse()
  const multiSelected = selectedIds.length > 1

  const handleRowClick = (e: React.MouseEvent, id: string) => {
    // Shift/Cmd/Ctrl+click adds to (or removes from) the selection, like
    // Figma/Photoshop's layer panels — a plain click replaces it.
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      toggleSelectLayer(id)
    } else {
      selectLayer(id)
    }
  }

  return (
    <div className="layer-panel">
      <div className="panel-title-row">
        <h2 className="panel-title">
          {multiSelected ? `레이어 (${layers.length}) · ${selectedIds.length}개 선택됨` : `레이어 (${layers.length})`}
        </h2>
        {multiSelected && (
          <span className="panel-title-actions">
            <button type="button" title="선택 복제" onClick={() => duplicateLayers(selectedIds)}>
              ⧉
            </button>
            <button type="button" title="선택 삭제" onClick={() => removeLayers(selectedIds)}>
              🗑
            </button>
          </span>
        )}
      </div>
      {rows.length === 0 && <p className="layer-empty">아직 추가된 레이어가 없습니다.</p>}
      <ul className="layer-list">
        {rows.map((layer) => {
          const visible = layer.visible !== false
          return (
            <li
              key={layer.id}
              className={`layer-row ${selectedIds.includes(layer.id) ? 'is-selected' : ''} ${visible ? '' : 'is-hidden'}`}
              onClick={(e) => handleRowClick(e, layer.id)}
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
      {rows.length > 0 && !multiSelected && (
        <p className="layer-hint">Shift/Cmd+클릭으로 여러 레이어를 선택할 수 있습니다.</p>
      )}
    </div>
  )
}
