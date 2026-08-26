import type { ApiProject, EditorLayer, LayerFolder } from '../types/editor'

// REST API backed by Vercel Functions + Blob storage (see api/projects/), deployed
// alongside the frontend — no separate backend or hosting to manage.
const API_BASE_URL = '/api'

export const fetchProjects = async (): Promise<ApiProject[]> => {
  const res = await fetch(`${API_BASE_URL}/projects`)
  if (!res.ok) throw new Error(`GET /projects failed: ${res.status}`)
  return res.json()
}

export const createProject = async (
  name: string,
  presetId: string,
  layers: EditorLayer[],
  folders: LayerFolder[],
): Promise<ApiProject> => {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, presetId, layers, folders }),
  })
  if (!res.ok) throw new Error(`POST /projects failed: ${res.status}`)
  return res.json()
}

export const deleteProject = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /projects/${id} failed: ${res.status}`)
}
