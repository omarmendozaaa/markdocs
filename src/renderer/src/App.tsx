import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from '../../shared/types'
import { ConfirmDialog, EngineDialog, NameDialog, SettingsDialog } from './Dialogs'
import { IconLogo } from './icons'
import { Preview } from './Preview'
import { RightPanel } from './RightPanel'
import { Sidebar } from './Sidebar'
import { Welcome } from './Welcome'
import { Workspace } from './Workspace'

type Dialog =
  | { kind: 'newFolder' }
  | { kind: 'rename'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'settings' }
  | { kind: 'engine' }
  | null

const api = window.api

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [view, setView] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [tracked, setTracked] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const prompted = useRef(false)
  const dragDepth = useRef(0)

  useEffect(() => {
    void api.getState().then(setState)
    return api.onState(setState)
  }, [])

  // Offer the one-time engine install on first launch.
  useEffect(() => {
    if (state && state.engine.status === 'missing' && !prompted.current) {
      prompted.current = true
      setDialog({ kind: 'engine' })
    }
  }, [state])

  // Everything that enters the queue during this session shows in the queue panel.
  useEffect(() => {
    if (!state) return
    setTracked((prev) => {
      const kept = prev.filter((id) => state.files.some((f) => f.id === id))
      const added = state.files
        .filter((f) => (f.status === 'queued' || f.status === 'converting') && !kept.includes(f.id))
        .map((f) => f.id)
      return added.length || kept.length !== prev.length ? [...kept, ...added] : prev
    })
  }, [state])

  // Apply the chosen theme (or follow the system) through a data attribute.
  const theme = state?.settings.theme ?? 'system'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const folders = state?.folders ?? []
  const current =
    view === 'recent' || view === 'done' || folders.some((f) => f.id === view) ? view : (folders[0]?.id ?? '')
  const currentFolderId = folders.some((f) => f.id === current) ? current : null
  const targetRef = useRef<string | null>(null)
  targetRef.current = currentFolderId

  const show = useCallback((id: string | null) => {
    if (!id) return
    setView(id)
    setPreviewId(null)
  }, [])

  // Drag & drop of files and folders anywhere on the window.
  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      dragDepth.current++
      setDragging(true)
    }
    const leave = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const over = (e: DragEvent): void => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const paths = Array.from(e.dataTransfer?.files ?? [])
        .map((f) => api.pathForFile(f))
        .filter(Boolean)
      if (paths.length) void api.addPaths(paths, targetRef.current).then(show)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [show])

  const closeDialog = useCallback(() => setDialog(null), [])
  const closePreview = useCallback(() => setPreviewId(null), [])

  if (!state) return null

  const convert = (ids: string[]): void => {
    if (ids.length === 0) return
    if (state.engine.status !== 'ready') setDialog({ kind: 'engine' })
    else void api.convert(ids)
  }
  const addFiles = (): void => void api.addFilesDialog(currentFolderId).then(show)
  const importFolder = (): void => void api.importFolderDialog().then(show)

  const previewFile = previewId ? state.files.find((f) => f.id === previewId) : undefined
  const dialogFolder = dialog && 'id' in dialog ? folders.find((f) => f.id === dialog.id) : undefined

  return (
    <div className="app" data-platform={state.platform}>
      <header className="titlebar">
        <div className="logo">
          <IconLogo />
        </div>
        <b>Markdocs</b>
        <span>· motor Docling</span>
      </header>

      <div className="body">
        {previewFile ? (
          <Preview state={state} file={previewFile} onBack={closePreview} onConvert={convert} />
        ) : folders.length === 0 ? (
          <Welcome onAddFiles={addFiles} onImportFolder={importFolder} onNewFolder={() => setDialog({ kind: 'newFolder' })} />
        ) : (
          <>
            <Sidebar
              state={state}
              view={current}
              onView={setView}
              onAddFiles={addFiles}
              onImportFolder={importFolder}
              onNewFolder={() => setDialog({ kind: 'newFolder' })}
              onRename={(id) => setDialog({ kind: 'rename', id })}
              onDelete={(id) => setDialog({ kind: 'delete', id })}
              onSettings={() => setDialog({ kind: 'settings' })}
              onEngine={() => setDialog({ kind: 'engine' })}
            />
            <Workspace key={current} state={state} view={current} onConvert={convert} onPreview={setPreviewId} onAddFiles={addFiles} />
            <RightPanel
              state={state}
              folder={folders.find((f) => f.id === current) ?? null}
              tracked={tracked}
              onPreview={setPreviewId}
              onClear={() =>
                setTracked((t) =>
                  t.filter((id) => {
                    const f = state.files.find((x) => x.id === id)
                    return f && (f.status === 'queued' || f.status === 'converting')
                  })
                )
              }
            />
          </>
        )}
      </div>

      {dragging && <div className="drag-veil">Suelta para agregar a Markdocs</div>}

      {dialog?.kind === 'newFolder' && (
        <NameDialog
          title="Nueva carpeta"
          confirm="Crear carpeta"
          onClose={closeDialog}
          onSubmit={(name) => {
            void api.createFolder(name).then(show)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'rename' && dialogFolder && (
        <NameDialog
          title="Cambiar nombre"
          confirm="Guardar"
          initial={dialogFolder.name}
          onClose={closeDialog}
          onSubmit={(name) => {
            void api.renameFolder(dialogFolder.id, name)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'delete' && dialogFolder && (
        <ConfirmDialog
          title={`¿Quitar «${dialogFolder.name}»?`}
          body="La carpeta y su lista de archivos se quitan de Markdocs. Los documentos originales y los .md ya generados permanecen en el disco."
          confirm="Quitar carpeta"
          onClose={closeDialog}
          onConfirm={() => {
            void api.deleteFolder(dialogFolder.id)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'settings' && (
        <SettingsDialog state={state} onClose={closeDialog} onEngine={() => setDialog({ kind: 'engine' })} />
      )}
      {dialog?.kind === 'engine' && <EngineDialog state={state} onClose={closeDialog} />}
    </div>
  )
}
