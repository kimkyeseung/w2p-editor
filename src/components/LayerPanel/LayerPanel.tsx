import { useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { EditorLayer, LayerFolder } from '../../types/editor'
import {
  BringFrontIcon,
  ChevronRightIcon,
  DuplicateIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  FolderPlusIcon,
  ImageIcon,
  LockIcon,
  SendBackIcon,
  TrashIcon,
  UnlockIcon,
} from '../common/icons'
import './LayerPanel.css'

type PanelRow =
  | { kind: 'folder'; folder: LayerFolder; members: EditorLayer[] }
  | { kind: 'layer'; layer: EditorLayer }

// Layers sharing a folderId are kept contiguous in the store's z-order array
// (see the folderId comment on LayerBase), so a front-to-back walk collecting
// runs of the same folderId reconstructs each folder's full member list and
// panel position in one pass. Folders with no members yet (nothing anchors
// their position) are shown at the very top.
const buildPanelRows = (layers: EditorLayer[], folders: LayerFolder[]): PanelRow[] => {
  const reversed = [...layers].reverse()
  const rows: PanelRow[] = []
  const emitted = new Set<string>()
  let i = 0
  while (i < reversed.length) {
    const layer = reversed[i]
    const folder = layer.folderId ? folders.find((f) => f.id === layer.folderId) : undefined
    if (folder && !emitted.has(folder.id)) {
      const members: EditorLayer[] = []
      let j = i
      while (j < reversed.length && reversed[j].folderId === folder.id) {
        members.push(reversed[j])
        j++
      }
      rows.push({ kind: 'folder', folder, members })
      emitted.add(folder.id)
      i = j
      continue
    }
    if (!folder || emitted.has(folder.id)) {
      rows.push({ kind: 'layer', layer })
    }
    i++
  }
  const emptyFolders = folders
    .filter((f) => !emitted.has(f.id))
    .map((folder) => ({ kind: 'folder' as const, folder, members: [] }))
  return [...emptyFolders, ...rows]
}

interface LayerRowProps {
  layer: EditorLayer
  indented: boolean
  showReorder: boolean
}

function LayerRow({ layer, indented, showReorder }: LayerRowProps) {
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const toggleSelectLayer = useEditorStore((s) => s.toggleSelectLayer)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer)
  const toggleLock = useEditorStore((s) => s.toggleLock)
  const toggleVisible = useEditorStore((s) => s.toggleVisible)
  const reorderLayer = useEditorStore((s) => s.reorderLayer)
  const ungroupLayer = useEditorStore((s) => s.ungroupLayer)

  const visible = layer.visible !== false
  const isSelected = selectedIds.includes(layer.id)

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelectLayer(layer.id)
    else selectLayer(layer.id)
  }

  return (
    <li
      className={`layer-row ${isSelected ? 'is-selected' : ''} ${visible ? '' : 'is-hidden'} ${indented ? 'is-indented' : ''}`}
      onClick={handleClick}
    >
      <span className="layer-type-icon" aria-hidden="true">
        {layer.type === 'text' ? 'T' : <ImageIcon />}
      </span>
      <span className="layer-name" title={layer.name}>
        {layer.name}
      </span>
      <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="layer-action-always"
          title={visible ? '숨기기' : '보이기'}
          onClick={() => toggleVisible(layer.id)}
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        {showReorder && (
          <>
            <button type="button" title="맨 앞으로" onClick={() => reorderLayer(layer.id, 'front')}>
              <BringFrontIcon />
            </button>
            <button type="button" title="맨 뒤로" onClick={() => reorderLayer(layer.id, 'back')}>
              <SendBackIcon />
            </button>
          </>
        )}
        <button
          type="button"
          title={layer.locked ? '잠금 해제' : '잠금'}
          className={layer.locked ? 'is-active' : ''}
          onClick={() => toggleLock(layer.id)}
        >
          {layer.locked ? <LockIcon /> : <UnlockIcon />}
        </button>
        <button type="button" title="복제" onClick={() => duplicateLayer(layer.id)}>
          <DuplicateIcon />
        </button>
        {indented && (
          <button type="button" title="폴더에서 빼기" onClick={() => ungroupLayer(layer.id)}>
            <FolderPlusIcon />
          </button>
        )}
        <button type="button" title="삭제" onClick={() => removeLayer(layer.id)}>
          <TrashIcon />
        </button>
      </span>
    </li>
  )
}

interface FolderRowProps {
  folder: LayerFolder
  members: EditorLayer[]
}

function FolderRow({ folder, members }: FolderRowProps) {
  const renameFolder = useEditorStore((s) => s.renameFolder)
  const removeFolder = useEditorStore((s) => s.removeFolder)
  const toggleFolderVisible = useEditorStore((s) => s.toggleFolderVisible)
  const toggleFolderLock = useEditorStore((s) => s.toggleFolderLock)
  const toggleFolderCollapsed = useEditorStore((s) => s.toggleFolderCollapsed)
  const reorderFolder = useEditorStore((s) => s.reorderFolder)

  const visible = folder.visible !== false

  return (
    <li className={`layer-folder ${visible ? '' : 'is-hidden'}`}>
      <div className="layer-row layer-folder-row">
        <button
          type="button"
          className={`folder-collapse-toggle ${folder.collapsed ? '' : 'is-expanded'}`}
          onClick={() => toggleFolderCollapsed(folder.id)}
          title={folder.collapsed ? '펼치기' : '접기'}
          disabled={members.length === 0}
        >
          <ChevronRightIcon />
        </button>
        <span className="layer-type-icon" aria-hidden="true">
          <FolderIcon />
        </span>
        <input
          className="layer-folder-name"
          value={folder.name}
          onChange={(e) => renameFolder(folder.id, e.target.value)}
          title={folder.name}
        />
        <span className="layer-folder-count">{members.length}</span>
        <span className="layer-actions">
          <button
            type="button"
            className="layer-action-always"
            title={visible ? '숨기기' : '보이기'}
            onClick={() => toggleFolderVisible(folder.id)}
          >
            {visible ? <EyeIcon /> : <EyeOffIcon />}
          </button>
          <button type="button" title="맨 앞으로" onClick={() => reorderFolder(folder.id, 'front')}>
            <BringFrontIcon />
          </button>
          <button type="button" title="맨 뒤로" onClick={() => reorderFolder(folder.id, 'back')}>
            <SendBackIcon />
          </button>
          <button
            type="button"
            title={folder.locked ? '잠금 해제' : '잠금'}
            className={folder.locked ? 'is-active' : ''}
            onClick={() => toggleFolderLock(folder.id)}
          >
            {folder.locked ? <LockIcon /> : <UnlockIcon />}
          </button>
          <button type="button" title="폴더 해제 (레이어는 유지)" onClick={() => removeFolder(folder.id)}>
            <TrashIcon />
          </button>
        </span>
      </div>
      {!folder.collapsed && members.length > 0 && (
        <ul className="layer-folder-members">
          {members.map((layer) => (
            <LayerRow key={layer.id} layer={layer} indented showReorder={false} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function LayerPanel() {
  const layers = useEditorStore((s) => s.layers)
  const folders = useEditorStore((s) => s.folders)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const removeLayers = useEditorStore((s) => s.removeLayers)
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers)
  const groupLayers = useEditorStore((s) => s.groupLayers)

  const rows = useMemo(() => buildPanelRows(layers, folders), [layers, folders])
  const multiSelected = selectedIds.length > 1

  return (
    <div className="layer-panel">
      <div className="panel-title-row">
        <h2 className="panel-title">
          {multiSelected ? `레이어 (${layers.length}) · ${selectedIds.length}개 선택됨` : `레이어 (${layers.length})`}
        </h2>
        <span className="panel-title-actions">
          {multiSelected && (
            <>
              <button type="button" title="선택 항목 폴더로 묶기" onClick={() => groupLayers(selectedIds)}>
                <FolderPlusIcon />
              </button>
              <button type="button" title="선택 복제" onClick={() => duplicateLayers(selectedIds)}>
                <DuplicateIcon />
              </button>
              <button type="button" title="선택 삭제" onClick={() => removeLayers(selectedIds)}>
                <TrashIcon />
              </button>
            </>
          )}
        </span>
      </div>
      {rows.length === 0 && <p className="layer-empty">아직 추가된 레이어가 없습니다.</p>}
      <ul className="layer-list">
        {rows.map((row) =>
          row.kind === 'folder' ? (
            <FolderRow key={row.folder.id} folder={row.folder} members={row.members} />
          ) : (
            <LayerRow key={row.layer.id} layer={row.layer} indented={false} showReorder />
          ),
        )}
      </ul>
      {rows.length > 0 && !multiSelected && (
        <p className="layer-hint">Shift/Cmd+클릭으로 여러 레이어를 선택하고, 폴더 아이콘으로 묶을 수 있습니다.</p>
      )}
    </div>
  )
}
