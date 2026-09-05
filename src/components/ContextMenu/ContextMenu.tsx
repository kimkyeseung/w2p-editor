import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'

export interface ContextMenuAction {
  label: string
  shortcut?: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

export type ContextMenuEntry = ContextMenuAction | 'separator'

interface ContextMenuProps {
  x: number
  y: number
  entries: ContextMenuEntry[]
  onClose: () => void
}

// Generic right-click menu, positioned at the triggering pointer event and
// rendered through a portal so it can float above everything (canvas,
// panels, toolbar) regardless of where in the tree it's used from.
export function ContextMenu({ x, y, entries, onClose }: ContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // Clamp to the viewport once the panel's real size is known — opening near
  // an edge would otherwise push part of the menu off-screen.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const margin = 8
    const left = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin))
    const top = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    // Capture phase: a click/right-click anywhere else (including one that
    // opens a *new* context menu elsewhere) should dismiss this one before
    // that other handler runs.
    const handlePointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return createPortal(
    <div ref={panelRef} className="context-menu" role="menu" style={{ left: pos.left, top: pos.top }}>
      {entries.map((entry, index) =>
        entry === 'separator' ? (
          <div key={index} className="context-menu-divider" role="separator" />
        ) : (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            className={entry.danger ? 'is-danger' : ''}
            disabled={entry.disabled}
            onClick={() => {
              entry.onSelect()
              onClose()
            }}
          >
            <span>{entry.label}</span>
            {entry.shortcut && <span className="context-menu-shortcut">{entry.shortcut}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
