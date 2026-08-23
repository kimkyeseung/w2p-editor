import * as fabric from 'fabric'
import type { EditorLayer, PersistedProject } from '../types/editor'

const STORAGE_KEY = 'w2p-editor:project'

export const buildProject = (
  canvas: fabric.Canvas,
  layers: EditorLayer[],
  presetId: string,
): PersistedProject => ({
  version: 1,
  presetId,
  fabricJson: canvas.toJSON(),
  layers,
  savedAt: new Date().toISOString(),
})

export const saveToLocalStorage = (
  canvas: fabric.Canvas,
  layers: EditorLayer[],
  presetId: string,
): void => {
  const project = buildProject(canvas, layers, presetId)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

export const loadFromLocalStorage = (): PersistedProject | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedProject
  } catch {
    return null
  }
}

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportProjectFile = (
  canvas: fabric.Canvas,
  layers: EditorLayer[],
  presetId: string,
): void => {
  const project = buildProject(canvas, layers, presetId)
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `w2p-project-${Date.now()}.json`)
}

export const importProjectFile = (file: File): Promise<PersistedProject> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as PersistedProject
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.layers)) {
          throw new Error('invalid project file')
        }
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

export const exportCanvasAsPng = (canvas: fabric.Canvas): void => {
  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `w2p-design-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const readImageFile = (file: File): Promise<{ src: string; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      const img = new Image()
      img.onload = () => resolve({ src, width: img.width, height: img.height })
      img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'))
      img.src = src
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
