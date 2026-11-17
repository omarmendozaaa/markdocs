import { useMemo, useState } from 'react'
import type { AppState, LibFile } from '../../shared/types'
import { IconLogo, IconMove, IconSearch, IconTrash, IconUpload, IconX } from './icons'
import { Popover } from './Popover'
import { formatDate, formatSize, plural, STATUS_LABEL, typeClass } from './util'

interface Props {
  state: AppState
  view: string
  onConvert(ids: string[]): void
  onPreview(id: string): void
  onAddFiles(): void
}

const busy = (f: LibFile): boolean => f.status === 'queued' || f.status === 'converting'

export function Workspace({ state, view, onConvert, onPreview, onAddFiles }: Props) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [moveOpen, setMoveOpen] = useState(false)

  const folder = state.folders.find((f) => f.id === view) ?? null
  const folderName = (id: string): string => state.folders.find((f) => f.id === id)?.name ?? ''

  const all = useMemo(() => {
    if (folder) {
      return state.files
        .filter((f) => f.folderId === folder.id)
        .sort((a, b) => a.relDir.localeCompare(b.relDir) || a.name.localeCompare(b.name))
    }
    if (view === 'done') {
      return state.files
        .filter((f) => f.status === 'done')
        .sort((a, b) => (b.convertedAt ?? 0) - (a.convertedAt ?? 0))
    }
    return [...state.files]
      .sort((a, b) => Math.max(b.convertedAt ?? 0, b.addedAt) - Math.max(a.convertedAt ?? 0, a.addedAt))
      .slice(0, 50)
  }, [state.files, folder, view])

  const q = query.trim().toLowerCase()
  const files = q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all
  const selected = files.filter((f) => picked.has(f.id))
  const n = selected.length
  const allSelected = files.length > 0 && n === files.length

  const toggle = (id: string): void => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  // With nothing selected the button acts on the whole list: pending and
  // failed files first, or everything again when all are already converted.
  const idle = files.filter((f) => !busy(f))
  const todo = idle.filter((f) => f.status !== 'done')
  const targets = n > 0 ? selected.filter((f) => !busy(f)) : todo.length ? todo : idle
  const scope = folder ? 'carpeta' : 'lista'
  const convertLabel =
    n > 0
      ? `Convertir ${n} a Markdown`
      : todo.length === 0 && idle.length > 0
        ? `Reconvertir ${scope} (${idle.length})`
        : todo.length === idle.length
          ? `Convertir ${scope} (${todo.length})`
          : `Convertir pendientes (${todo.length})`

  const title = folder ? folder.name : view === 'done' ? 'Convertidos' : 'Recientes'
  const otherFolders = state.folders.filter((f) => f.id !== view)

  return (
    <main className="main-col">
      <div className="page-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="crumb">{folder ? 'Mis carpetas  ›' : 'Biblioteca  ›'}</div>
          <h1 className="ellipsis">{title}</h1>
        </div>
        <label className="search">
          <IconSearch />
          <span className="sr-only">Buscar por nombre</span>
          <input type="search" placeholder="Buscar por nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {folder && (
        <div className="dropzone">
          <div className="tile">
            <IconUpload size={22} />
          </div>
          <div className="grow">
            <div className="t">Arrastra archivos o carpetas aquí</div>
            <div className="s">
              PDF · DOCX · XLSX · PPTX · HTML · imágenes · CSV — las subcarpetas conservan su estructura
            </div>
          </div>
          <button className="btn" onClick={onAddFiles}>
            Examinar…
          </button>
        </div>
      )}

      <div className="toolbar">
        <label className="select-all">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={files.length === 0}
            onChange={() => setPicked(allSelected ? new Set() : new Set(files.map((f) => f.id)))}
          />
          {n === 0 ? 'Seleccionar todo' : plural(n, 'seleccionado', 'seleccionados')}
        </label>
        <div className="grow" />
        <div className="rel">
          <button className="btn" disabled={n === 0} aria-haspopup="menu" aria-expanded={moveOpen} onClick={() => setMoveOpen(!moveOpen)}>
            <IconMove size={15} /> Mover a…
          </button>
          {moveOpen && (
            <Popover onClose={() => setMoveOpen(false)} style={{ top: 40, right: 0 }}>
              {otherFolders.length === 0 && <div className="empty">No hay otras carpetas.</div>}
              {otherFolders.map((f) => (
                <button
                  key={f.id}
                  role="menuitem"
                  onClick={() => {
                    void window.api.moveFiles(selected.map((s) => s.id), f.id)
                    setMoveOpen(false)
                    setPicked(new Set())
                  }}
                >
                  <span className="ellipsis">{f.name}</span>
                </button>
              ))}
            </Popover>
          )}
        </div>
        <button
          className="btn"
          disabled={n === 0}
          title="Quita los archivos de Markdocs. No borra nada del disco."
          onClick={() => {
            void window.api.removeFiles(selected.map((s) => s.id))
            setPicked(new Set())
          }}
        >
          <IconTrash size={15} /> Quitar
        </button>
        <button className="btn primary" disabled={targets.length === 0} onClick={() => onConvert(targets.map((f) => f.id))}>
          <IconLogo size={16} /> {convertLabel}
        </button>
      </div>

      <div className="table" role="table" aria-label="Archivos">
        <div className="thead" role="row">
          <span />
          <span role="columnheader">Nombre</span>
          <span role="columnheader" className="col-size">Tamaño</span>
          <span role="columnheader" className="col-pages">Págs.</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader" className="col-date">Modificado</span>
          <span />
        </div>
        {files.length === 0 && (
          <div className="empty-list">
            {q
              ? 'Ningún archivo coincide con la búsqueda.'
              : folder
                ? 'Esta carpeta está vacía. Arrastra archivos aquí o usa «Agregar archivos».'
                : 'Todavía no hay nada que mostrar aquí.'}
          </div>
        )}
        {files.map((f) => {
          const sub = f.status === 'error' ? f.error : folder ? f.relDir : folderName(f.folderId)
          return (
            <div
              key={f.id}
              role="row"
              className={'trow' + (picked.has(f.id) ? ' selected' : '')}
              onDoubleClick={() => f.outputPath && onPreview(f.id)}
            >
              <label className="check">
                <span className="sr-only">Seleccionar {f.name}</span>
                <input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(f.id)} />
              </label>
              <div className="name">
                <span className={'badge ' + typeClass(f.ext)}>{f.ext}</span>
                <span className="txt">
                  <span className="ellipsis" title={f.path}>
                    {f.name}
                  </span>
                  {sub && (
                    <span className={'sub ellipsis' + (f.status === 'error' ? ' err' : '')} title={sub}>
                      {sub}
                    </span>
                  )}
                </span>
              </div>
              <span className="cell col-size">{formatSize(f.size)}</span>
              <span className="cell col-pages">{f.pages ? f.pages : '—'}</span>
              <span className={'chip ' + f.status}>
                <i />
                {STATUS_LABEL[f.status]}
              </span>
              <span className="cell col-date">{formatDate(f.mtime)}</span>
              <span style={{ justifySelf: 'end' }}>
                {f.outputPath && !busy(f) && (
                  <button className="link-btn" onClick={() => onPreview(f.id)}>
                    Ver .md
                  </button>
                )}
                {busy(f) && (
                  <button className="icon-btn" aria-label={`Cancelar ${f.name}`} title="Cancelar" onClick={() => void window.api.cancel([f.id])}>
                    <IconX />
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {folder && files.length > 0 && (
        <span className="hint">
          Sin selección, el botón convierte lo pendiente de la carpeta. Doble clic en un archivo convertido abre su Markdown.
        </span>
      )}
    </main>
  )
}
