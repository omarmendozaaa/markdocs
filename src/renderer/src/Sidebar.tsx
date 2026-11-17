import { useState } from 'react'
import type { AppState } from '../../shared/types'
import { IconClock, IconFileCheck, IconFolder, IconFolderIn, IconMore, IconPlus, IconSettings, IconUpload } from './icons'
import { Popover } from './Popover'

interface Props {
  state: AppState
  view: string
  onView(view: string): void
  onAddFiles(): void
  onImportFolder(): void
  onNewFolder(): void
  onRename(id: string): void
  onDelete(id: string): void
  onSettings(): void
  onEngine(): void
}

export function Sidebar(p: Props) {
  const { state } = p
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const doneCount = state.files.filter((f) => f.status === 'done').length
  const engine = state.engine

  return (
    <nav className="sidebar" aria-label="Carpetas">
      <div className="stack">
        <button className="btn primary" onClick={p.onAddFiles}>
          <IconUpload /> Agregar archivos
        </button>
        <button className="btn" onClick={p.onImportFolder}>
          <IconFolderIn /> Importar carpeta
        </button>
      </div>

      <div className="nav-group">
        <div className="nav-title">Biblioteca</div>
        <div className={'nav-item' + (p.view === 'recent' ? ' active' : '')}>
          <button className="main" onClick={() => p.onView('recent')}>
            <IconClock />
            <span className="grow">Recientes</span>
          </button>
        </div>
        <div className={'nav-item' + (p.view === 'done' ? ' active' : '')}>
          <button className="main" onClick={() => p.onView('done')}>
            <IconFileCheck />
            <span className="grow">Convertidos</span>
            <span className="count">{doneCount}</span>
          </button>
        </div>
      </div>

      <div className="nav-group">
        <div className="nav-title">
          <span className="grow">Mis carpetas</span>
          <button className="icon-btn" aria-label="Nueva carpeta" onClick={p.onNewFolder}>
            <IconPlus />
          </button>
        </div>
        {state.folders.map((f) => (
          <div key={f.id} className={'nav-item' + (p.view === f.id ? ' active' : '')}>
            <button className="main" onClick={() => p.onView(f.id)}>
              <IconFolder />
              <span className="grow ellipsis">{f.name}</span>
              <span className="count">{state.files.filter((x) => x.folderId === f.id).length}</span>
            </button>
            <button
              className="icon-btn more"
              aria-label={`Opciones de ${f.name}`}
              aria-haspopup="menu"
              aria-expanded={menuFor === f.id}
              onClick={() => setMenuFor(menuFor === f.id ? null : f.id)}
            >
              <IconMore />
            </button>
            {menuFor === f.id && (
              <Popover onClose={() => setMenuFor(null)} style={{ top: 36, right: 0 }}>
                <button role="menuitem" onClick={() => (setMenuFor(null), p.onRename(f.id))}>
                  Cambiar nombre
                </button>
                <button role="menuitem" className="danger" onClick={() => (setMenuFor(null), p.onDelete(f.id))}>
                  Quitar carpeta
                </button>
              </Popover>
            )}
          </div>
        ))}
        <button className="new-folder" onClick={p.onNewFolder}>
          <IconPlus /> Nueva carpeta
        </button>
      </div>

      <div className="grow" />

      <div className="engine-card">
        {engine.status === 'ready' && (
          <>
            <div className="row">
              <span className="dot" /> Motor local listo · Docling {engine.version}
            </div>
            <span>Tus archivos se procesan en este equipo.</span>
          </>
        )}
        {engine.status === 'installing' && (
          <>
            <div className="row">
              <span className="dot warn" /> Instalando el motor…
            </div>
            <button className="link-btn" style={{ textAlign: 'left' }} onClick={p.onEngine}>
              Ver progreso
            </button>
          </>
        )}
        {(engine.status === 'missing' || engine.status === 'error') && (
          <>
            <div className="row">
              <span className={'dot ' + (engine.status === 'error' ? 'err' : 'warn')} />
              {engine.status === 'error' ? 'Falló la instalación del motor' : 'Motor Docling sin instalar'}
            </div>
            <button className="link-btn" style={{ textAlign: 'left' }} onClick={p.onEngine}>
              {engine.status === 'error' ? 'Ver detalles' : 'Instalar ahora'}
            </button>
          </>
        )}
      </div>
      <div className="nav-item">
        <button className="main" onClick={p.onSettings}>
          <IconSettings /> Ajustes
        </button>
      </div>
    </nav>
  )
}
