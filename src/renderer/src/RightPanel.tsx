import type { AppState, Folder, ImageMode } from '../../shared/types'
import { IconAlert, IconCheck, IconX } from './icons'
import { STAGE_LABEL } from './util'

interface Props {
  state: AppState
  folder: Folder | null
  tracked: string[]
  onPreview(id: string): void
  onClear(): void
}

const IMAGE_MODES: [ImageMode, string, string][] = [
  ['referenced', 'Referenciar', 'Guarda las imágenes como archivos junto al .md'],
  ['embedded', 'Incrustar', 'Incluye las imágenes dentro del .md en base64'],
  ['placeholder', 'Omitir', 'Deja solo un marcador donde había una imagen']
]

export function RightPanel({ state, folder, tracked, onPreview, onClear }: Props) {
  const { options } = state.settings
  const setOption = (patch: Partial<typeof options>): void =>
    void window.api.setSettings({ options: { ...options, ...patch } })

  const items = tracked
    .map((id) => state.files.find((f) => f.id === id))
    .filter((f) => f !== undefined)
  const converting = items.filter((f) => f.status === 'converting')
  const queued = items.filter((f) => f.status === 'queued')
  const finished = items.filter((f) => f.status === 'done' || f.status === 'error').reverse()
  const total = converting.length + queued.length + finished.length

  return (
    <aside className="panel" aria-label="Salida y cola">
      <section>
        <h2>Salida</h2>
        {folder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label">Guardar los .md en</span>
            <div className="pathbox">
              <span className="p ellipsis" title={folder.outputDir ?? undefined}>
                {folder.outputDir ?? 'Junto a cada archivo original'}
              </span>
              <button className="btn small" onClick={() => void window.api.chooseFolderOutput(folder.id)}>
                Cambiar
              </button>
            </div>
            {folder.outputDir && (
              <div style={{ display: 'flex', gap: 14 }}>
                <button className="link-btn" onClick={() => void window.api.showInFolder(folder.outputDir!)}>
                  Abrir carpeta
                </button>
                <button className="link-btn" onClick={() => void window.api.setFolderOutputBeside(folder.id)}>
                  Junto a los originales
                </button>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="opt">
            <input type="checkbox" checked={options.ocr} onChange={(e) => setOption({ ocr: e.target.checked })} />
            <span>OCR en páginas escaneadas</span>
          </label>
          <label className="opt">
            <input type="checkbox" checked={options.tables} onChange={(e) => setOption({ tables: e.target.checked })} />
            <span>Reconstruir tablas</span>
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">Imágenes</span>
          <div className="segmented" role="radiogroup" aria-label="Imágenes">
            {IMAGE_MODES.map(([mode, label, hint]) => (
              <button key={mode} role="radio" aria-checked={options.images === mode} title={hint} onClick={() => setOption({ images: mode })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="grow">Cola de conversión</h2>
          {total > 0 && (
            <span className="label">
              {finished.length} de {total}
            </span>
          )}
        </div>

        {total === 0 && <span className="hint">Aquí verás el progreso cuando conviertas archivos.</span>}

        {converting.map((f) => (
          <div key={f.id} className="q-item">
            <div className="top">
              <span className="grow ellipsis">{f.name}</span>
              <button className="icon-btn" aria-label={`Cancelar ${f.name}`} title="Cancelar" onClick={() => void window.api.cancel([f.id])}>
                <IconX size={14} />
              </button>
            </div>
            <div className="bar" role="progressbar" aria-label={`Convirtiendo ${f.name}`}>
              <i />
            </div>
            <span className="label">{STAGE_LABEL[f.stage ?? 'loading']}</span>
          </div>
        ))}

        {queued.slice(0, 4).map((f) => (
          <div key={f.id} className="q-flat waiting">
            <span className="grow ellipsis">{f.name}</span>
            <button className="icon-btn" aria-label={`Quitar ${f.name} de la cola`} title="Quitar de la cola" onClick={() => void window.api.cancel([f.id])}>
              <IconX size={14} />
            </button>
          </div>
        ))}
        {queued.length > 4 && <span className="label">y {queued.length - 4} más en espera</span>}

        {finished.slice(0, 8).map((f) =>
          f.status === 'done' ? (
            <div key={f.id} className="q-flat done">
              <IconCheck />
              <span className="grow ellipsis">{f.name}</span>
              <button className="link-btn" onClick={() => onPreview(f.id)}>
                Ver .md
              </button>
            </div>
          ) : (
            <div key={f.id} className="q-flat error">
              <IconAlert />
              <div className="col">
                <span className="ellipsis">{f.name}</span>
                <span className="msg">{f.error}</span>
              </div>
              <button className="btn small danger" onClick={() => void window.api.convert([f.id])}>
                Reintentar
              </button>
            </div>
          )
        )}

        {finished.length > 0 && (
          <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onClear}>
            Limpiar terminados
          </button>
        )}
      </section>
    </aside>
  )
}
