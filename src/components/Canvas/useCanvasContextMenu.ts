// Right-click menu: hit-testing the cursor against layers, opening the menu
// with the right selection, and building its entries for whatever's
// targeted (empty canvas vs. one layer vs. a multi-selection).
import { useCallback, useState, type RefObject } from 'react'
import type * as fabric from 'fabric'
import type { EditorLayer } from '../../types/editor'
import type { ContextMenuEntry } from '../ContextMenu/ContextMenu'

interface UseCanvasContextMenuOptions {
  fabricRef: RefObject<fabric.Canvas | null>
  idToObject: { current: Map<string, fabric.FabricObject> }
  layers: EditorLayer[]
  selectedIds: string[]
  selectLayers: (ids: string[]) => void
  isPanning: boolean
  clipboard: EditorLayer[]
  copyLayers: (ids: string[]) => void
  pasteLayers: () => void
  removeLayers: (ids: string[]) => void
  duplicateLayers: (ids: string[]) => void
  groupLayers: (ids: string[]) => void
  ungroupLayer: (id: string) => void
  reorderLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
}

export function useCanvasContextMenu({
  fabricRef,
  idToObject,
  layers,
  selectedIds,
  selectLayers,
  isPanning,
  clipboard,
  copyLayers,
  pasteLayers,
  removeLayers,
  duplicateLayers,
  groupLayers,
  ungroupLayer,
  reorderLayer,
}: UseCanvasContextMenuOptions) {
  // `targetIds` is captured at open time rather than re-read from the
  // store's live `selectedIds` while the menu is open, so the actions it
  // renders always match what was actually under the cursor — an empty
  // array means the artboard/background was clicked, not an object, and
  // only shows the canvas-level "붙여넣기" action.
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetIds: string[] } | null>(null)
  // Stable reference so ContextMenu's outside-click/Escape effect doesn't
  // tear down and re-attach its window listeners on every Canvas re-render
  // while the menu is open.
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // Same AABB hit-test the marquee-select in Canvas.tsx uses against
  // idToObject, walked topmost-first (end of the layers array = front of
  // z-order) so a right-click on overlapping objects picks whatever's
  // actually on top.
  const hitTestLayerAt = (clientX: number, clientY: number): string | null => {
    const canvas = fabricRef.current
    if (!canvas) return null
    const canvasRect = canvas.upperCanvasEl.getBoundingClientRect()
    if (canvasRect.width === 0 || canvasRect.height === 0) return null
    const scaleX = canvasRect.width / canvas.getWidth()
    const scaleY = canvasRect.height / canvas.getHeight()
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      const obj = idToObject.current.get(layer.id)
      if (!obj || obj.visible === false) continue
      const b = obj.getBoundingRect()
      const left = canvasRect.left + b.left * scaleX
      const top = canvasRect.top + b.top * scaleY
      if (clientX >= left && clientX <= left + b.width * scaleX && clientY >= top && clientY <= top + b.height * scaleY) {
        return layer.id
      }
    }
    return null
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    // Always suppress the native menu first — Canvas.tsx sets
    // stopContextMenu: false on the Fabric canvas specifically so this
    // handler is the only thing left doing that job. Bailing out on
    // `isPanning` *before* this ran used to let the native menu leak
    // through while panning (space-held or the hand tool).
    e.preventDefault()
    if (isPanning) return
    const hitId = hitTestLayerAt(e.clientX, e.clientY)
    if (!hitId) {
      setContextMenu({ x: e.clientX, y: e.clientY, targetIds: [] })
      return
    }
    const targetIds = selectedIds.length > 1 && selectedIds.includes(hitId) ? selectedIds : [hitId]
    const alreadySelected =
      targetIds.length === selectedIds.length && targetIds.every((id, i) => id === selectedIds[i])
    if (!alreadySelected) selectLayers(targetIds)
    setContextMenu({ x: e.clientX, y: e.clientY, targetIds })
  }

  const buildContextMenuEntries = (targetIds: string[]): ContextMenuEntry[] => {
    const pasteEntry: ContextMenuEntry = {
      label: '붙여넣기',
      shortcut: 'Ctrl/Cmd+V',
      disabled: clipboard.length === 0,
      onSelect: () => pasteLayers(),
    }

    if (targetIds.length === 0) {
      return [pasteEntry]
    }

    const entries: ContextMenuEntry[] = [
      { label: '복사', shortcut: 'Ctrl/Cmd+C', onSelect: () => copyLayers(targetIds) },
      {
        label: '잘라내기',
        shortcut: 'Ctrl/Cmd+X',
        onSelect: () => {
          copyLayers(targetIds)
          removeLayers(targetIds)
        },
      },
      pasteEntry,
      'separator',
      { label: '복제', onSelect: () => duplicateLayers(targetIds) },
    ]

    if (targetIds.length > 1) {
      entries.push({ label: '그룹으로 묶기', onSelect: () => groupLayers(targetIds) })
    } else {
      const [onlyId] = targetIds
      entries.push(
        'separator',
        { label: '맨 앞으로 가져오기', onSelect: () => reorderLayer(onlyId, 'front') },
        { label: '앞으로 가져오기', onSelect: () => reorderLayer(onlyId, 'forward') },
        { label: '뒤로 보내기', onSelect: () => reorderLayer(onlyId, 'backward') },
        { label: '맨 뒤로 보내기', onSelect: () => reorderLayer(onlyId, 'back') },
      )
      const layer = layers.find((l) => l.id === onlyId)
      if (layer?.folderId) {
        entries.push('separator', { label: '폴더에서 빼기', onSelect: () => ungroupLayer(onlyId) })
      }
    }

    entries.push('separator', {
      label: '삭제',
      shortcut: 'Delete',
      danger: true,
      onSelect: () => removeLayers(targetIds),
    })

    return entries
  }

  return { contextMenu, handleContextMenu, closeContextMenu, buildContextMenuEntries }
}
