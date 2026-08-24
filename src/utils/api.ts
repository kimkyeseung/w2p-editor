import type { ApiProject, EditorLayer } from '../types/editor'

// Dummy REST API (json-server) demonstrating the fetch/CRUD flow the job
// posting asks for. Run `npm run api` locally to serve it from db.json —
// the deployed site has no backend to talk to, so requests there fail with
// a network error, which the UI surfaces as a clear "run it locally" hint
// rather than a silent/broken feature.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export const fetchProjects = async (): Promise<ApiProject[]> => {
  const res = await fetch(`${API_BASE_URL}/projects`)
  if (!res.ok) throw new Error(`GET /projects failed: ${res.status}`)
  return res.json()
}

export const createProject = async (
  name: string,
  presetId: string,
  layers: EditorLayer[],
): Promise<ApiProject> => {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, presetId, layers, savedAt: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`POST /projects failed: ${res.status}`)
  return res.json()
}

export const deleteProject = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /projects/${id} failed: ${res.status}`)
}
