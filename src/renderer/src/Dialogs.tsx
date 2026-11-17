import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppState, Theme } from '../../shared/types'

function Modal(props: { title: string; wide?: boolean; onClose(): void; children: ReactNode }) {
  const { onClose } = props
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'dialog' + (props.wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={props.title}>
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </div>
  )
}

export function NameDialog(props: {
  title: string
  initial?: string
  confirm: string
  onClose(): void
  onSubmit(name: string): void
}) {
  const [name, setName] = useState(props.initial ?? '')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.select(), [])
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <form
        style={{ display: 'contents' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) props.onSubmit(name.trim())
        }}
      >
        <label className="field">
          Nombre
          <input ref={ref} type="text" value={name} placeholder="Ej. Facturas Q4" maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            {props.confirm}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function ConfirmDialog(props: {
  title: string
  body: string
  confirm: string
  onClose(): void
  onConfirm(): void
}) {
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <p>{props.body}</p>
      <div className="actions">
        <button className="btn" onClick={props.onClose}>
          Cancelar
        </button>
        <button className="btn danger" onClick={props.onConfirm}>
          {props.confirm}
        </button>
      </div>
    </Modal>
  )
}

export function EngineDialog({ state, onClose }: { state: AppState; onClose(): void }) {
  const engine = state.engine
  const logRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [engine.log.length])

  return (
    <Modal title="Motor de conversión Docling" wide onClose={onClose}>
      {engine.status === 'missing' && (
        <>
          <p>
            Markdocs convierte tus documentos con <b>Docling</b>, que se ejecuta en este equipo. Hay que instalarlo una
            sola vez:
          </p>
          <ol className="steps">
            <li>Se descarga Python y Docling en la carpeta de datos de la app (no toca tu sistema).</li>
            <li>Se descargan los modelos de análisis de páginas y OCR.</li>
            <li>Ocupa unos 2&nbsp;GB y tarda varios minutos según tu conexión.</li>
          </ol>
          <p>Después de esto las conversiones no necesitan internet y tus archivos no salen del equipo.</p>
        </>
      )}
      {engine.status === 'installing' && (
        <>
          <p>{engine.step ?? 'Instalando'}…</p>
          <div className="bar" role="progressbar" aria-label="Instalando el motor">
            <i />
          </div>
        </>
      )}
      {engine.status === 'error' && (
        <div className="notice">No se pudo instalar el motor: {engine.message}. Revisa tu conexión e inténtalo otra vez.</div>
      )}
      {engine.status === 'ready' && (
        <p>
          El motor está instalado y listo (Docling {engine.version}). Puedes reinstalarlo para actualizar a la última
          versión.
        </p>
      )}
      {(engine.status === 'installing' || engine.status === 'error') && (
        <pre ref={logRef} className="log">
          {engine.log.join('\n') || 'Iniciando…'}
        </pre>
      )}
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {engine.status === 'installing' ? 'Seguir en segundo plano' : engine.status === 'missing' ? 'Más tarde' : 'Cerrar'}
        </button>
        {engine.status !== 'installing' && (
          <button className="btn primary" onClick={() => void window.api.installEngine()}>
            {engine.status === 'ready' ? 'Reinstalar / actualizar' : engine.status === 'error' ? 'Reintentar' : 'Instalar motor'}
          </button>
        )}
      </div>
    </Modal>
  )
}

const THEMES: [Theme, string][] = [
  ['system', 'Sistema'],
  ['light', 'Claro'],
  ['dark', 'Oscuro']
]

export function SettingsDialog({ state, onClose, onEngine }: { state: AppState; onClose(): void; onEngine(): void }) {
  const { settings, engine } = state
  return (
    <Modal title="Ajustes" wide onClose={onClose}>
      <div className="field">
        Tema
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {THEMES.map(([value, label]) => (
            <button key={value} role="radio" aria-checked={settings.theme === value} onClick={() => void window.api.setSettings({ theme: value })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        Carpeta de salida para carpetas nuevas
        <div className="pathbox">
          <span className="p ellipsis grow" title={settings.outputRoot}>
            {settings.outputRoot}
          </span>
          <button className="btn small" onClick={() => void window.api.chooseOutputRoot()}>
            Cambiar
          </button>
        </div>
      </div>
      <div className="field">
        Motor de conversión
        <div className="pathbox">
          <span className="grow" style={{ fontSize: 13 }}>
            {engine.status === 'ready'
              ? `Docling ${engine.version} instalado`
              : engine.status === 'installing'
                ? 'Instalando…'
                : 'Sin instalar'}
          </span>
          <button className="btn small" onClick={onEngine}>
            Administrar
          </button>
        </div>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={onClose}>
          Listo
        </button>
      </div>
    </Modal>
  )
}
