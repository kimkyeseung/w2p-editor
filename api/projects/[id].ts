import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readProjects, writeProjects } from '../_lib/projectsStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  const projectId = Array.isArray(id) ? id[0] : id

  if (req.method === 'DELETE') {
    if (!projectId) {
      res.status(400).json({ error: 'id is required' })
      return
    }

    const projects = await readProjects()
    const next = projects.filter((p) => p.id !== projectId)
    if (next.length === projects.length) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await writeProjects(next)
    res.status(204).end()
    return
  }

  res.setHeader('Allow', 'DELETE')
  res.status(405).json({ error: 'Method not allowed' })
}
