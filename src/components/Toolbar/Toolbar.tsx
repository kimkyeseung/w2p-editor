import { useRef, type RefObject } from 'react'
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
  LayoutGridIcon,
  LineShapeIcon,
  MockupIcon,
  RectangleShapeIcon,
  RedoIcon,
  RepeatTransformIcon,
  SaveIcon,
  TextToolIcon,
  TriangleShapeIcon,
  UndoIcon,
} from '../common/icons'
import { DropdownMenu } from './DropdownMenu'
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
  const repeatLastTransform = useEditorStore((s) => s.repeatLastTransform)
  const canRepeatTransform = useEditorStore((s) => s.lastTransform !== null && s.selectedIds.length > 0)

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

      <DropdownMenu label="샘플" icon={LayoutGridIcon}>
        {(close) => (
          <>
            {SAMPLE_PROJECTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  replaceAll(sample.layers, sample.presetId)
                  onToast(`${sample.label} 불러왔습니다.`)
                  close()
                }}
              >
                <span>{sample.label}</span>
              </button>
            ))}
          </>
        )}
      </DropdownMenu>

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
        <span className="toolbar-segment-divider" />
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={repeatLastTransform}
          disabled={!canRepeatTransform}
          title="변형 반복 (Ctrl/Cmd+D)"
        >
          <RepeatTransformIcon />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <DropdownMenu label="파일" icon={FolderMenuIcon}>
          {(close) => (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  canvasHandleRef.current?.saveToLocalStorage()
                  onToast('저장되었습니다.')
                  close()
                }}
              >
                <SaveIcon />
                <span>저장</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const loaded = canvasHandleRef.current?.loadFromLocalStorage()
                  onToast(loaded ? '불러왔습니다.' : '저장된 프로젝트가 없습니다.')
                  close()
                }}
              >
                <FolderOpenIcon />
                <span>불러오기</span>
              </button>
              <div className="toolbar-menu-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  canvasHandleRef.current?.exportProjectFile()
                  onToast('파일로 내보냈습니다.')
                  close()
                }}
              >
                <FileExportIcon />
                <span>파일로 내보내기</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  projectInputRef.current?.click()
                  close()
                }}
              >
                <FileImportIcon />
                <span>파일 불러오기</span>
              </button>
            </>
          )}
        </DropdownMenu>
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
