import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/** Small anchored menu. Closes on outside click or Escape. */
export function Popover(props: { onClose: () => void; children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const { onClose } = props
  useEffect(() => {
    const down = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div ref={ref} className="menu" role="menu" style={props.style}>
      {props.children}
    </div>
  )
}
