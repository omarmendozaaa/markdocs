import type { LibFile, Stage } from '../../shared/types'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('es', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`
}

export function formatDate(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const day = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff === 0) return `Hoy ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
  if (diff === 1) return 'Ayer'
  return d.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  })
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toLocaleString('es', { maximumFractionDigits: 1 })} s`
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
}

export const fileUrl = (path: string): string => `markdocs-file://local/${encodeURIComponent(path)}`

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i <= 0 ? path : path.slice(0, i)
}

export function joinPath(dir: string, rel: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + rel.replace(/^[\\/]+/, '')
}

export const isAbsolute = (p: string): boolean => /^([a-zA-Z]:[\\/]|[\\/])/.test(p)

/** Colour family for the type badge. */
export function typeClass(ext: string): string {
  if (ext === 'pdf') return 't-pdf'
  if (['docx', 'odt', 'epub', 'md', 'adoc', 'asciidoc'].includes(ext)) return 't-doc'
  if (['xlsx', 'ods', 'csv'].includes(ext)) return 't-sheet'
  if (['pptx', 'odp'].includes(ext)) return 't-slides'
  if (['html', 'htm'].includes(ext)) return 't-web'
  return 't-img'
}

export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'webp']

export const STATUS_LABEL: Record<LibFile['status'], string> = {
  pending: 'Pendiente',
  queued: 'En cola',
  converting: 'Convirtiendo',
  done: 'Convertido',
  error: 'Error'
}

export const STAGE_LABEL: Record<Stage, string> = {
  loading: 'Cargando modelos…',
  converting: 'Analizando el documento…',
  writing: 'Escribiendo Markdown…'
}

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
