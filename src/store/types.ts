// The single EditorState contract every slice in `slices/` implements a
// piece of (see editorStore.ts for how they're combined). Kept separate from
// editorStore.ts so a slice can import just this file — a few hundred lines
// of interface — instead of the whole store module.
import type {
  EditorGuide,
  EditorLayer,
  LayerBorder,
  LayerFolder,
  LayerGradient,
  LayerShadow,
  PathCommand,
  PathLayer,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from '../types/editor'

export type DrawMode = 'none' | 'pencil' | 'circle' | 'spray'

export interface HistoryEntry {
  layers: EditorLayer[]
  folders: LayerFolder[]
  guides: EditorGuide[]
  selectedId: string | null
  selectedIds: string[]
  presetId: string
}

export interface EditorState {
  layers: EditorLayer[]
  // Folders are a layer-panel-only grouping concept — they have no z-order
  // slot of their own (see the folderId comment on LayerBase) and never
  // reach Canvas.tsx as Fabric objects. Collapsed state is deliberately
  // excluded from undo history (see toggleFolderCollapsed) since it's a
  // panel view preference, not document content.
  folders: LayerFolder[]
  // User-placed ruler guides (see the EditorGuide comment) — undoable within
  // a session like any other document edit, but session-only scaffolding:
  // not persisted with save/load or the project API, and reset whenever a
  // project is loaded via replaceAll.
  guides: EditorGuide[]
  // `selectedId` is kept as the "primary" selection (set whenever exactly
  // one layer is selected) so existing single-object UI — the properties
  // panel's field editing, canvas.setActiveObject — doesn't need to branch
  // on multi-select. `selectedIds` is the full set for multi-select-aware
  // UI (layer panel highlighting, batch delete/duplicate).
  selectedId: string | null
  selectedIds: string[]
  presetId: string
  past: HistoryEntry[]
  future: HistoryEntry[]
  // Shared across every color picker in the app and persisted to
  // localStorage — a UI convenience, not document content, so it's
  // excluded from undo history (same reasoning as toggleFolderCollapsed).
  recentColors: string[]
  // Illustrator-style "Transform Again" (Cmd/Ctrl+D): the most recent
  // canvas-driven move/rotate delta, replayable on whatever is selected
  // later. Deliberately excludes scale/resize — only move and rotate are in
  // scope — and is meta-state about the editing session rather than
  // document content, so it's excluded from undo history.
  lastTransform: { dx: number; dy: number; dRotation: number } | null
  // Freehand drawing tool state — which brush is active (if any) and its
  // current color/width. Meta-state about the editing session rather than
  // document content (same reasoning as `lastTransform`), so it's excluded
  // from undo history and not persisted; a stroke itself becomes a normal
  // undoable PathLayer once drawn (see addPathLayer).
  drawMode: DrawMode
  drawColor: string
  drawWidth: number
  // In-app clipboard for Ctrl/Cmd+C / Ctrl/Cmd+V — holds the copied layers'
  // data so paste can be repeated after selecting something else. Session
  // state rather than document content (same reasoning as `lastTransform`),
  // so it's excluded from undo history and not persisted. `pasteCount`
  // tracks how many times the current clipboard has been pasted so repeated
  // pastes step further away from the original instead of stacking exactly
  // on top of each other.
  clipboard: EditorLayer[]
  pasteCount: number
  // True whenever the document has changed since the last save/load —
  // driven by pushHistory (every document-mutating action spreads its
  // result, so `dirty: true` rides along for free) and cleared by
  // `markSaved` and by `replaceAll` (loading fresh content isn't itself an
  // unsaved change). Lets the UI warn before a page close/refresh or a
  // project switch would silently drop unsaved work.
  dirty: boolean

  setPreset: (presetId: string) => void
  addTextLayer: () => void
  addImageLayer: (src: string, width: number, height: number, position?: { x: number; y: number }) => void
  addShapeLayer: (shape: ShapeKind) => void
  setDrawMode: (mode: DrawMode) => void
  setDrawColor: (color: string) => void
  setDrawWidth: (width: number) => void
  // Commits one finished freehand stroke (Fabric's `path:created`) as a new
  // layer — `path` is the raw command array straight off the Fabric object,
  // and the geometry is its on-canvas bounding box (see Canvas.tsx).
  addPathLayer: (
    path: PathCommand[],
    geometry: { x: number; y: number; width: number; height: number },
    style: { stroke: string; strokeWidth: number },
  ) => void
  updatePathStyle: (id: string, style: Partial<Pick<PathLayer, 'stroke' | 'strokeWidth' | 'fill'>>) => void
  updateLayerTransform: (
    id: string,
    transform: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'blendMode'>>,
  ) => void
  updateLayerShadow: (id: string, shadow: Partial<LayerShadow>) => void
  updateLayerBorder: (id: string, border: Partial<LayerBorder>) => void
  flipLayer: (id: string, axis: 'horizontal' | 'vertical') => void
  addRecentColor: (color: string) => void
  updateTextStyle: (id: string, style: Partial<Omit<TextLayer, keyof EditorLayer | 'type'>>) => void
  updateShapeStyle: (id: string, style: Partial<Omit<ShapeLayer, keyof EditorLayer | 'type' | 'shape'>>) => void
  updateShapeGradient: (id: string, gradient: Partial<LayerGradient>) => void
  // Fabric fires one `object:modified` event for both a transform drag AND
  // Fabric's own inline text-editing (double-click on the canvas) — this
  // applies both in one history entry so canvas-driven edits aren't lost
  // the next time the store re-syncs the object from stale layer data.
  applyCanvasModification: (
    id: string,
    patch: Partial<Pick<EditorLayer, 'x' | 'y' | 'width' | 'height' | 'rotation'>> & { text?: string },
  ) => void
  // Reapplies `lastTransform` to every currently selected layer, in one
  // undo step. A no-op with nothing recorded yet or nothing selected.
  repeatLastTransform: () => void
  renameLayer: (id: string, name: string) => void
  removeLayer: (id: string) => void
  removeLayers: (ids: string[]) => void
  duplicateLayer: (id: string) => void
  duplicateLayers: (ids: string[]) => void
  // Ctrl/Cmd+C: snapshots the given layers into `clipboard`. Doesn't touch
  // undo history — copying isn't a document edit.
  copyLayers: (ids: string[]) => void
  // Ctrl/Cmd+V: inserts fresh clones of whatever is in `clipboard`, offset
  // further each repeated call. No-op with an empty clipboard.
  pasteLayers: () => void
  // Flatten/merge: swaps every given layer for one new rasterized image
  // layer in a single step (Canvas.tsx does the actual rendering — this
  // just commits the result). Inserted where the topmost merged layer sat,
  // joining its folder if every merged layer shared the same one.
  replaceLayersWithImage: (
    ids: string[],
    image: { src: string; x: number; y: number; width: number; height: number },
  ) => void
  toggleLock: (id: string) => void
  toggleVisible: (id: string) => void
  reorderLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
  // Uses `maskId`'s shape to clip `targetId`'s visible content (a Fabric
  // clipPath), set by dragging one layer panel row onto another. The mask
  // layer can't be an image (Canvas.tsx builds the clip shape synchronously
  // every render pass, and image layers load asynchronously). Repositions
  // the mask to sit directly above the target in z-order, joining the
  // target's folder if any, to keep that folder's contiguous-run invariant
  // intact.
  setClipMask: (maskId: string, targetId: string) => void
  removeClipMask: (targetId: string) => void
  alignLayer: (id: string, alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  // Illustrator-style "align to selection" (as opposed to alignLayer's
  // align-to-canvas): positions every given layer relative to the
  // combined bounding box of the whole set, not the artboard.
  alignLayers: (ids: string[], alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  // Equalizes the gaps between adjacent layers' bounding boxes along one
  // axis, keeping the first and last (by position) fixed — needs 3+ layers
  // to mean anything, since 2 layers have only a single gap to equalize.
  distributeLayers: (ids: string[], axis: 'horizontal' | 'vertical') => void
  selectLayer: (id: string | null) => void
  selectLayers: (ids: string[]) => void
  toggleSelectLayer: (id: string) => void
  // Groups the given layers into a folder. If exactly one of them already
  // belongs to a folder, the rest join that folder instead of a new one
  // being created — lets "group selection" double as "add to this folder".
  groupLayers: (ids: string[], name?: string) => void
  ungroupLayer: (id: string) => void
  removeFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
  toggleFolderVisible: (id: string) => void
  toggleFolderLock: (id: string) => void
  // Deliberately not undo-tracked (see the `folders` field comment).
  toggleFolderCollapsed: (id: string) => void
  reorderFolder: (id: string, direction: 'front' | 'back') => void
  addGuide: (axis: 'horizontal' | 'vertical', position: number) => void
  updateGuide: (id: string, position: number) => void
  removeGuide: (id: string) => void
  clearGuides: () => void
  replaceAll: (layers: EditorLayer[], presetId: string, folders?: LayerFolder[]) => void
  // Clears `dirty` after a successful save. Save itself lives outside the
  // store (Canvas.tsx serializes straight from Fabric), so it can't ride
  // along on a document-mutating action the way `dirty: true` does.
  markSaved: () => void
  undo: () => void
  redo: () => void
}
