// Fabric.js's rotate ("mtr") control has no built-in cursor icon — its
// default cursorStyle is literally 'crosshair' unless a Control overrides
// it. This is a small curved-arrow cursor (Figma/Photoshop-style) applied to
// every object's rotate handle instead.
const ROTATE_CURSOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <path d="M4.5 10a5.5 5.5 0 1 1 2.1 4.3" fill="none" stroke="white" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M4.5 10a5.5 5.5 0 1 1 2.1 4.3" fill="none" stroke="#111827" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M3.3 13.6 L4.5 10 L7.6 11.4 Z" fill="white" stroke="#111827" stroke-width="0.8" stroke-linejoin="round"/>
</svg>
`.trim()

export const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROTATE_CURSOR_SVG)}") 10 10, crosshair`
