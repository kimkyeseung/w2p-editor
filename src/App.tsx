import { useEffect, useRef, useState } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Canvas, type CanvasHandle } from './components/Canvas/Canvas'
import { LayerPanel } from './components/LayerPanel/LayerPanel'
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel'
import { MockupPreview } from './components/MockupPreview/MockupPreview'
import { Toast } from './components/Toast/Toast'
import { useEditorStore } from './store/editorStore'
import './App.css'

type MobileTab = 'layers' | 'properties'

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

function App() {
  const canvasHandleRef = useRef<CanvasHandle>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('layers')
  const [mockupDataUrl, setMockupDataUrl] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(message)
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2000)
  }

  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const selectedId = useEditorStore((s) => s.selectedId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        removeLayer(selectedId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, removeLayer, selectedId])

  const handleOpenMockup = () => {
    const dataUrl = canvasHandleRef.current?.getDesignDataUrl()
    if (!dataUrl) {
      window.alert('먼저 캔버스에 텍스트나 이미지를 추가해주세요.')
      return
    }
    setMockupDataUrl(dataUrl)
  }

  return (
    <div className="app">
      <Toolbar canvasHandleRef={canvasHandleRef} onOpenMockup={handleOpenMockup} onToast={showToast} />
      <div className="workspace">
        <aside className={`side-panel layer-panel-wrap ${mobileTab === 'layers' ? 'is-active' : ''}`}>
          <LayerPanel />
        </aside>
        <main className="canvas-wrap">
          <Canvas ref={canvasHandleRef} />
        </main>
        <aside
          className={`side-panel properties-panel-wrap ${mobileTab === 'properties' ? 'is-active' : ''}`}
        >
          <PropertiesPanel />
        </aside>
      </div>
      <nav className="mobile-tabs">
        <button
          type="button"
          className={mobileTab === 'layers' ? 'is-active' : ''}
          onClick={() => setMobileTab('layers')}
        >
          레이어
        </button>
        <button
          type="button"
          className={mobileTab === 'properties' ? 'is-active' : ''}
          onClick={() => setMobileTab('properties')}
        >
          속성
        </button>
      </nav>

      {mockupDataUrl && (
        <MockupPreview designDataUrl={mockupDataUrl} onClose={() => setMockupDataUrl(null)} />
      )}
      <Toast message={toastMessage} />
    </div>
  )
}

export default App
