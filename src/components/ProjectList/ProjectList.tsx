import { useEffect, useState } from 'react'
import { createProject, deleteProject, fetchProjects } from '../../utils/api'
import type { ApiProject, EditorLayer } from '../../types/editor'
import './ProjectList.css'

interface ProjectListProps {
  currentPresetId: string
  currentLayers: EditorLayer[]
  onLoad: (presetId: string, layers: EditorLayer[]) => void
  onClose: () => void
}

type Status = 'loading' | 'ready' | 'error'

export function ProjectList({ currentPresetId, currentLayers, onLoad, onClose }: ProjectListProps) {
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    setStatus('loading')
    try {
      const list = await fetchProjects()
      setProjects(list)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleSave = async () => {
    const name = saveName.trim() || `프로젝트 ${new Date().toLocaleString('ko-KR')}`
    setSaving(true)
    try {
      await createProject(name, currentPresetId, currentLayers)
      setSaveName('')
      await refresh()
    } catch {
      window.alert('저장하지 못했습니다. API 서버 연결을 확인해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
      await refresh()
    } catch {
      window.alert('삭제하지 못했습니다.')
    }
  }

  return (
    <div className="mockup-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="project-list-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mockup-header">
          <h2>프로젝트 목록 (REST API 데모)</h2>
          <button type="button" className="mockup-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="project-save-row">
          <input
            type="text"
            placeholder="새 프로젝트 이름"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button type="button" onClick={handleSave} disabled={saving}>
            현재 디자인 저장
          </button>
        </div>

        {status === 'loading' && <p className="project-list-status">불러오는 중...</p>}

        {status === 'error' && (
          <p className="project-list-status project-list-error">
            API 서버에 연결할 수 없습니다. 로컬에서 <code>npm run api</code>로 더미 REST
            서버(json-server)를 띄운 뒤 다시 시도해주세요.
          </p>
        )}

        {status === 'ready' && projects.length === 0 && (
          <p className="project-list-status">저장된 프로젝트가 없습니다.</p>
        )}

        {status === 'ready' && projects.length > 0 && (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="project-list-load"
                  onClick={() => {
                    onLoad(p.presetId, p.layers)
                    onClose()
                  }}
                >
                  <strong>{p.name}</strong>
                  <span>{new Date(p.savedAt).toLocaleString('ko-KR')}</span>
                </button>
                <button type="button" className="project-list-delete" onClick={() => handleDelete(p.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="project-list-hint">
          GET/POST/DELETE로 json-server와 통신하는 REST API 연동 데모입니다 (저장소: <code>db.json</code>
          ).
        </p>
      </div>
    </div>
  )
}
