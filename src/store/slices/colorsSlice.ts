// Recent-colors swatch list shared by every color picker in the app —
// persisted to localStorage directly (not part of undo history; see the
// `recentColors` field comment on EditorState).
import type { StoreApi } from 'zustand'
import type { EditorState } from '../types'

const RECENT_COLORS_KEY = 'w2p-recent-colors'
const MAX_RECENT_COLORS = 12

const loadRecentColors = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveRecentColors = (colors: string[]) => {
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors))
  } catch {
    // Private browsing / storage full — swatches just won't persist.
  }
}

type Set = StoreApi<EditorState>['setState']

export type ColorsSlice = Pick<EditorState, 'recentColors' | 'addRecentColor'>

export const createColorsSlice = (set: Set): ColorsSlice => ({
  recentColors: loadRecentColors(),

  addRecentColor: (color) => {
    set((state) => {
      const next = [color, ...state.recentColors.filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(
        0,
        MAX_RECENT_COLORS,
      )
      saveRecentColors(next)
      return { recentColors: next }
    })
  },
})
