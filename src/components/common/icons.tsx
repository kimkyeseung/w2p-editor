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
