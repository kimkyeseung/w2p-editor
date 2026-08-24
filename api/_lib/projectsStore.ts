import { put, get, BlobNotFoundError } from '@vercel/blob'
import type { ApiProject } from '../../src/types/editor.js'

const PROJECTS_PATHNAME = 'projects.json'

export async function readProjects(): Promise<ApiProject[]> {
  try {
    // useCache: false bypasses the blob CDN (which ignores query strings for its
    // cache key, so a plain cache-busted fetch() still returns stale content) and
    // reads the latest write directly from origin storage.
    const result = await get(PROJECTS_PATHNAME, { access: 'public', useCache: false })
    if (!result) return []
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as ApiProject[]
  } catch (err) {
    if (err instanceof BlobNotFoundError) return []
    throw err
  }
}

export async function writeProjects(projects: ApiProject[]): Promise<void> {
  await put(PROJECTS_PATHNAME, JSON.stringify(projects), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}
