import { useEffect, useRef, useState } from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Canvas, type CanvasHandle } from './components/Canvas/Canvas'
import { LayerPanel } from './components/LayerPanel/LayerPanel'
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel'
import { MockupPreview } from './components/MockupPreview/MockupPreview'
import { ProjectList } from './components/ProjectList/ProjectList'
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
  const [projectListOpen, setProjectListOpen] = useState(false)

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(message)
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2000)
  }

  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const removeLayers = useEditorStore((s) => s.removeLayers)
  const repeatLastTransform = useEditorStore((s) => s.repeatLastTransform)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const layers = useEditorStore((s) => s.layers)
  const folders = useEditorStore((s) => s.folders)
  const presetId = useEditorStore((s) => s.presetId)
  const replaceAll = useEditorStore((s) => s.replaceAll)
  const drawMode = useEditorStore((s) => s.drawMode)
  const setDrawMode = useEditorStore((s) => s.setDrawMode)

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
      // Cmd/Ctrl+D is the browser's "bookmark this page" shortcut — always
      // prevent it here regardless of whether there's anything to repeat,
      // so it never leaks through to the browser while editing.
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        repeatLastTransform()
        return
      }
      if (e.key === 'Escape' && drawMode !== 'none') {
        setDrawMode('none')
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault()
        removeLayers(selectedIds)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, removeLayers, repeatLastTransform, selectedIds, drawMode, setDrawMode])

  const handleOpenMockup = () => {
    const dataUrl = canvasHandleRef.current?.getDesignDataUrl()
    if (!dataUrl) {
      window.alert('먼저 캔버스에 텍스트나 이미지를 추가해주세요.')
      return
    }
    setMockupDataUrl(dataUrl)
  }

  const handleFlattenSelection = async () => {
    await canvasHandleRef.current?.flattenSelection()
    showToast('선택한 레이어를 하나의 이미지로 병합했습니다.')
  }

  return (
    <div className="app">
      <Toolbar
        canvasHandleRef={canvasHandleRef}
        onOpenMockup={handleOpenMockup}
        onOpenProjectList={() => setProjectListOpen(true)}
        onToast={showToast}
      />
      <div className="workspace">
        <aside className={`side-panel layer-panel-wrap ${mobileTab === 'layers' ? 'is-active' : ''}`}>
          <LayerPanel onFlattenSelection={handleFlattenSelection} />
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
        <MockupPreview
          designDataUrl={mockupDataUrl}
          presetId={presetId}
          onClose={() => setMockupDataUrl(null)}
        />
      )}
      {projectListOpen && (
        <ProjectList
          currentPresetId={presetId}
          currentLayers={layers}
          currentFolders={folders}
          onLoad={(loadedPresetId, loadedLayers, loadedFolders) =>
            replaceAll(loadedLayers, loadedPresetId, loadedFolders)
          }
          onClose={() => setProjectListOpen(false)}
        />
      )}
      <Toast message={toastMessage} />
    </div>
  )
}

export default App
