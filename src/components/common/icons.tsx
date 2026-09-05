interface IconProps {
  className?: string
}

const base = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none' as const,
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 2.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 7V5.3C6 3.7 7.1 2.5 8 2.5C8.9 2.5 10 3.7 10 5.3V7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function UnlockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 7V5.3C6 3.7 7.1 2.5 8 2.5C8.9 2.5 9.9 3.3 10 4.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BringFrontIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 2.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M8 13V5M4.5 8.3L8 4.8L11.5 8.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SendBackIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 13.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M8 3V11M4.5 7.7L8 11.2L11.5 7.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DuplicateIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 5.5V4C10.5 3.2 9.8 2.5 9 2.5H4C3.2 2.5 2.5 3.2 2.5 4V9C2.5 9.8 3.2 10.5 4 10.5H5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 4.5H13M6 4.5V3.2C6 2.5 6.6 2 7.2 2H8.8C9.4 2 10 2.5 10 3.2V4.5M5 4.5V12.3C5 13.2 5.7 14 6.6 14H9.4C10.3 14 11 13.2 11 12.3V4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M2 4.5C2 3.7 2.7 3 3.5 3H6.5L7.8 4.3H12.5C13.3 4.3 14 5 14 5.8V11.5C14 12.3 13.3 13 12.5 13H3.5C2.7 13 2 12.3 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FolderPlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M2 4.5C2 3.7 2.7 3 3.5 3H6.5L7.8 4.3H12.5C13.3 4.3 14 5 14 5.8V11.5C14 12.3 13.3 13 12.5 13H3.5C2.7 13 2 12.3 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 7.3V10.7M6.3 9H9.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M6 3.5L10.5 8L6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="3" width="12" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.6" cy="6.6" r="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M2.7 11.5L6 8.2L8.4 10.5L10.8 7.7L13.3 10.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RectangleShapeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="4" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function EllipseShapeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <ellipse cx="8" cy="8" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function TriangleShapeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 3L14 12.5H2L8 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function LineShapeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 12.5L13.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function TextToolIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 4H13M8 4V12.5M5.5 12.5H10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UndoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M4 5.5H10C11.66 5.5 13 6.84 13 8.5C13 10.16 11.66 11.5 10 11.5H6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 3L3.5 5.5L6 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RedoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 5.5H6C4.34 5.5 3 6.84 3 8.5C3 10.16 4.34 11.5 6 11.5H9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 3L12.5 5.5L10 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FolderMenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M2 4.7C2 3.9 2.7 3.2 3.5 3.2H6.3L7.6 4.5H12.5C13.3 4.5 14 5.2 14 6V11.3C14 12.1 13.3 12.8 12.5 12.8H3.5C2.7 12.8 2 12.1 2 11.3V4.7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SaveIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 3.5C3 2.95 3.45 2.5 4 2.5H10.5L13 5V12.5C13 13.05 12.55 13.5 12 13.5H4C3.45 13.5 3 13.05 3 12.5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M5.5 2.7V6H10V2.7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.7 9.3H10.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function FolderOpenIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M2 5.3C2 4.5 2.7 3.8 3.5 3.8H6.3L7.6 5.1H12C12.6 5.1 13 5.5 13 6.1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M2.3 6.3C2.2 5.8 2.6 5.4 3.1 5.4H12.9C13.5 5.4 13.9 5.9 13.7 6.5L12.4 11.6C12.3 12 11.9 12.3 11.5 12.3H3.5C3.1 12.3 2.7 12 2.6 11.6L2.3 6.3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FileExportIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M4 2.5H9L12 5.5V13C12 13.3 11.75 13.5 11.5 13.5H4C3.75 13.5 3.5 13.3 3.5 13V3C3.5 2.7 3.75 2.5 4 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 2.5V5.5H12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 9.5H9M7.5 8L9 9.5L7.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FileImportIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M4 2.5H9L12 5.5V13C12 13.3 11.75 13.5 11.5 13.5H4C3.75 13.5 3.5 13.3 3.5 13V3C3.5 2.7 3.75 2.5 4 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 2.5V5.5H12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 9.5H6M7.5 8L6 9.5L7.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2.5V10M5 7.2L8 10.2L11 7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12.2V12.8C3 13.4 3.5 13.8 4 13.8H12C12.5 13.8 13 13.4 13 12.8V12.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function MockupIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="3.5" width="12" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 14H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 11.5V14" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.3" cy="6.3" r="0.9" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 10L6 7.3L8 9L10.5 6L13 8.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloudIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5 12C3.34 12 2 10.66 2 9C2 7.46 3.16 6.2 4.65 6.03C4.98 4.28 6.52 3 8.35 3C10.35 3 12 4.53 12.2 6.5C13.28 6.75 14 7.71 14 8.85C14 10.13 13.02 11.4 11.5 12H5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
