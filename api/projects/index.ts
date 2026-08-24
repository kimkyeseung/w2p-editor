import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readProjects, writeProjects } from '../_lib/projectsStore.js'
import type { EditorLayer } from '../../src/types/editor.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const projects = await readProjects()
    res.status(200).json(projects)
    return
  }

  if (req.method === 'POST') {
    const body = req.body as { name?: string; presetId?: string; layers?: EditorLayer[] }
    if (!body?.name || !body?.presetId || !body?.layers) {
      res.status(400).json({ error: 'name, presetId, layers are required' })
      return
    }

    const projects = await readProjects()
    const project = {
      id: crypto.randomUUID(),
      name: body.name,
      presetId: body.presetId,
      layers: body.layers,
      savedAt: new Date().toISOString(),
    }
    await writeProjects([...projects, project])
    res.status(201).json(project)
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
