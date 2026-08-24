import { useEffect, useState } from 'react'
import { createProject, deleteProject, fetchProjects } from '../../utils/api'
import { Modal } from '../common/Modal'
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
      // Append the server's response directly instead of re-fetching the list —
      // the blob store the API sits on is only eventually consistent across
      // writes, so a GET immediately after this POST can still race and miss it.
      const created = await createProject(name, currentPresetId, currentLayers)
      setProjects((prev) => [...prev, created])
      setSaveName('')
    } catch {
      window.alert('저장하지 못했습니다. API 서버 연결을 확인해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch {
      window.alert('삭제하지 못했습니다.')
    }
  }

  return (
    <Modal title="프로젝트 목록 (REST API 데모)" onClose={onClose} dialogClassName="project-list-dialog">
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
            API 서버에 연결할 수 없습니다. <code>npm run dev</code>(Vite 단독 실행)로는 API
            라우트가 뜨지 않으니, 로컬에서 확인하려면 <code>npm run dev:api</code>
            (vercel dev)로 실행한 뒤 다시 시도해주세요.
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
          GET/POST/DELETE로 Vercel Functions API(<code>api/projects</code>)와 통신하는 REST API
          연동 데모입니다. 데이터는 Vercel Blob에 저장되어 배포된 사이트에서도 그대로 동작합니다.
        </p>
    </Modal>
  )
}
