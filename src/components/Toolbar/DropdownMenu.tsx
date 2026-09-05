import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, type IconProps } from '../common/icons'

interface DropdownMenuProps {
  label: string
  icon: (props: IconProps) => React.ReactElement
  // Render-prop so menu items can close the menu after running their own
  // action, without each call site re-implementing that plumbing.
  children: (close: () => void) => ReactNode
}

// Shared by every toolbar dropdown (파일, 샘플, ...). The panel renders
// through a portal into document.body — see the note on .toolbar-menu-panel
// in Toolbar.css for why: .toolbar's overflow-x:auto (needed for its
// horizontal-scroll-on-mobile fallback) forces overflow-y to clip too, per
// spec, even though it's declared `visible`, which would otherwise cut the
// panel off wherever it dropped below the bar. Its screen position is
// therefore computed from the trigger's own bounding rect rather than
// expressed as ordinary relative/absolute CSS.
export function DropdownMenu({ label, icon: Icon, children }: DropdownMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!open) return
    const isOutside = (target: Node) =>
      !triggerRef.current?.contains(target) && !panelRef.current?.contains(target)
    const handlePointerDown = (e: PointerEvent) => {
      if (isOutside(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Closes on the toolbar's own horizontal scroll/resize too, which would
    // otherwise leave the portal-rendered panel floating over the wrong spot.
    const handleReflow = () => setOpen(false)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReflow)
    window.addEventListener('scroll', handleReflow, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReflow)
      window.removeEventListener('scroll', handleReflow, true)
    }
  }, [open])

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="toolbar-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`toolbar-menu-trigger ${open ? 'is-open' : ''}`}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon />
        <span>{label}</span>
        <ChevronDownIcon className="toolbar-menu-chevron" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="toolbar-menu-panel"
            role="menu"
            style={{ top: pos.top, right: pos.right }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  )
}
