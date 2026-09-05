import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../../store/editorStore'
import { CANVAS_PRESETS } from '../../utils/presets'
import { readImageFile } from '../../utils/canvasSerialization'
import { SAMPLE_PROJECTS } from '../../utils/sampleProjects'
import {
  ChevronDownIcon,
  CloudIcon,
  DownloadIcon,
  EllipseShapeIcon,
  FileExportIcon,
  FileImportIcon,
  FolderMenuIcon,
  FolderOpenIcon,
  ImageIcon,
  LineShapeIcon,
  MockupIcon,
  RectangleShapeIcon,
  RedoIcon,
  SaveIcon,
  TextToolIcon,
  TriangleShapeIcon,
  UndoIcon,
} from '../common/icons'
import type { CanvasHandle } from '../Canvas/Canvas'
import type { ShapeKind } from '../../types/editor'
import './Toolbar.css'

const SHAPE_BUTTONS: { kind: ShapeKind; label: string; Icon: typeof RectangleShapeIcon }[] = [
  { kind: 'rectangle', label: '사각형', Icon: RectangleShapeIcon },
  { kind: 'ellipse', label: '타원', Icon: EllipseShapeIcon },
  { kind: 'triangle', label: '삼각형', Icon: TriangleShapeIcon },
  { kind: 'line', label: '선', Icon: LineShapeIcon },
]

const MAX_INITIAL_IMAGE_WIDTH = 320

interface ToolbarProps {
  canvasHandleRef: RefObject<CanvasHandle | null>
  onOpenMockup: () => void
  onOpenProjectList: () => void
  onToast: (message: string) => void
}

export function Toolbar({ canvasHandleRef, onOpenMockup, onOpenProjectList, onToast }: ToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const fileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const fileMenuPanelRef = useRef<HTMLDivElement>(null)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  // The panel renders through a portal (see below) so it can escape the
  // toolbar's clipping box, so its screen position has to be computed from
  // the trigger button rather than expressed as ordinary relative/absolute
  // CSS.
  const [fileMenuPos, setFileMenuPos] = useState({ top: 0, right: 0 })

  const presetId = useEditorStore((s) => s.presetId)
  const setPreset = useEditorStore((s) => s.setPreset)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)
  const addImageLayer = useEditorStore((s) => s.addImageLayer)
  const addShapeLayer = useEditorStore((s) => s.addShapeLayer)
  const replaceAll = useEditorStore((s) => s.replaceAll)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)

  // Closes the "파일" menu on an outside click, Escape, or the toolbar's own
  // horizontal scroll/resize (which would otherwise leave the portal-rendered
  // panel floating over the wrong spot), matching the usual dropdown
  // convention so it never lingers open over the canvas.
  useEffect(() => {
    if (!fileMenuOpen) return
    const isOutside = (target: Node) =>
      !fileMenuTriggerRef.current?.contains(target) && !fileMenuPanelRef.current?.contains(target)
    const handlePointerDown = (e: PointerEvent) => {
      if (isOutside(e.target as Node)) setFileMenuOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileMenuOpen(false)
    }
    const handleReflow = () => setFileMenuOpen(false)
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
  }, [fileMenuOpen])

  const toggleFileMenu = () => {
    if (!fileMenuOpen && fileMenuTriggerRef.current) {
      const rect = fileMenuTriggerRef.current.getBoundingClientRect()
      setFileMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setFileMenuOpen((open) => !open)
  }

  const runFileAction = (action: () => void) => {
    action()
    setFileMenuOpen(false)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    try {
      const { src, width, height } = await readImageFile(file)
      const scale = Math.min(1, MAX_INITIAL_IMAGE_WIDTH / width)
      addImageLayer(src, Math.round(width * scale), Math.round(height * scale))
    } catch {
      window.alert('이미지를 불러오지 못했습니다.')
    }
  }

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await canvasHandleRef.current?.importProjectFile(file)
      onToast('파일을 불러왔습니다.')
    } catch {
      window.alert('프로젝트 파일을 불러오지 못했습니다.')
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <img src="/favicon.svg" alt="" width={20} height={20} />
        <span>W2P Editor</span>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <select
          id="preset-select"
          className="toolbar-select"
          aria-label="템플릿"
          value={presetId}
          onChange={(e) => setPreset(e.target.value)}
        >
          {CANVAS_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <div className="toolbar-select-caret">
          <ChevronDownIcon />
        </div>
      </div>

      <div className="toolbar-group toolbar-group-pills">
        {SAMPLE_PROJECTS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className="toolbar-pill"
            onClick={() => {
              replaceAll(sample.layers, sample.presetId)
              onToast(`${sample.label} 불러왔습니다.`)
            }}
          >
            {sample.label}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-segment">
        <button type="button" className="toolbar-icon-btn" title="텍스트 추가" onClick={addTextLayer}>
          <TextToolIcon />
        </button>
        <button
          type="button"
          className="toolbar-icon-btn"
          title="이미지 추가"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon />
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
        <span className="toolbar-segment-divider" />
        {SHAPE_BUTTONS.map(({ kind, label, Icon }) => (
          <button
            key={kind}
            type="button"
            className="toolbar-icon-btn"
            title={`${label} 추가`}
            onClick={() => addShapeLayer(kind)}
          >
            <Icon />
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-segment">
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={undo}
          disabled={!canUndo}
          title="실행 취소 (Ctrl/Cmd+Z)"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={redo}
          disabled={!canRedo}
          title="다시 실행 (Shift+Ctrl/Cmd+Z)"
        >
          <RedoIcon />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <div className="toolbar-menu">
          <button
            ref={fileMenuTriggerRef}
            type="button"
            className={`toolbar-menu-trigger ${fileMenuOpen ? 'is-open' : ''}`}
            onClick={toggleFileMenu}
            aria-haspopup="true"
            aria-expanded={fileMenuOpen}
          >
            <FolderMenuIcon />
            <span>파일</span>
            <ChevronDownIcon className="toolbar-menu-chevron" />
          </button>
          {fileMenuOpen &&
            createPortal(
              <div
                ref={fileMenuPanelRef}
                className="toolbar-menu-panel"
                role="menu"
                style={{ top: fileMenuPos.top, right: fileMenuPos.right }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runFileAction(() => {
                      canvasHandleRef.current?.saveToLocalStorage()
                      onToast('저장되었습니다.')
                    })
                  }
                >
                  <SaveIcon />
                  <span>저장</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runFileAction(() => {
                      const loaded = canvasHandleRef.current?.loadFromLocalStorage()
                      onToast(loaded ? '불러왔습니다.' : '저장된 프로젝트가 없습니다.')
                    })
                  }
                >
                  <FolderOpenIcon />
                  <span>불러오기</span>
                </button>
                <div className="toolbar-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runFileAction(() => {
                      canvasHandleRef.current?.exportProjectFile()
                      onToast('파일로 내보냈습니다.')
                    })
                  }
                >
                  <FileExportIcon />
                  <span>파일로 내보내기</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runFileAction(() => projectInputRef.current?.click())}
                >
                  <FileImportIcon />
                  <span>파일 불러오기</span>
                </button>
              </div>,
              document.body,
            )}
        </div>
        <input
          ref={projectInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleProjectFileChange}
        />

        <button
          type="button"
          className="toolbar-icon-btn"
          title="목업 미리보기"
          onClick={onOpenMockup}
        >
          <MockupIcon />
        </button>
        <button
          type="button"
          className="toolbar-icon-btn"
          title="프로젝트 목록 (API)"
          onClick={onOpenProjectList}
        >
          <CloudIcon />
        </button>

        <button
          type="button"
          className="toolbar-primary"
          onClick={() => {
            canvasHandleRef.current?.exportPng()
            onToast('PNG로 내보냈습니다.')
          }}
        >
          <DownloadIcon />
          <span>PNG 내보내기</span>
        </button>
      </div>
    </header>
  )
}
