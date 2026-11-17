import type { ReactNode } from 'react'

function Svg({ size = 16, sw = 1.8, children }: { size?: number; sw?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const IconLogo = ({ size = 12 }: P) => (
  <Svg size={size} sw={2.6}>
    <path d="M4 18V6l5 6 5-6v12" />
    <path d="M19 8v10M16 15l3 3 3-3" />
  </Svg>
)
export const IconUpload = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
  </Svg>
)
export const IconFolder = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
)
export const IconFolderIn = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 11v5M9.5 13.5 12 11l2.5 2.5" />
  </Svg>
)
export const IconFolderPlus = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 10v6M9 13h6" />
  </Svg>
)
export const IconMove = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M10 13h6M13 10l3 3-3 3" />
  </Svg>
)
export const IconFile = ({ size }: P) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
)
export const IconFileCheck = ({ size }: P) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 15l2 2 4-4" />
  </Svg>
)
export const IconClock = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const IconPlus = ({ size }: P) => (
  <Svg size={size} sw={2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconSearch = ({ size }: P) => (
  <Svg size={size} sw={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)
export const IconTrash = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
)
export const IconCheck = ({ size }: P) => (
  <Svg size={size} sw={2.4}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
)
export const IconAlert = ({ size }: P) => (
  <Svg size={size} sw={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Svg>
)
export const IconX = ({ size }: P) => (
  <Svg size={size} sw={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IconBack = ({ size }: P) => (
  <Svg size={size} sw={2}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)
export const IconCopy = ({ size }: P) => (
  <Svg size={size} sw={2}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
)
export const IconMore = ({ size }: P) => (
  <Svg size={size} sw={2.4}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </Svg>
)
export const IconSettings = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
)
