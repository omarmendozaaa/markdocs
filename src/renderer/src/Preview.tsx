import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useMemo, useState } from 'react'
import type { AppState, LibFile, OutputDoc } from '../../shared/types'
import { IconBack, IconCheck, IconCopy } from './icons'
import { dirname, fileUrl, formatDuration, IMAGE_EXTS, isAbsolute, joinPath, plural, typeClass } from './util'

interface Props {
  state: AppState
  file: LibFile
  onBack(): void
  onConvert(ids: string[]): void
}

/** Renders Markdown to sanitised HTML, pointing relative images at the output folder. */
function renderMarkdown(md: string, baseDir: string): string {
  const raw = marked.parse(md, { async: false, gfm: true })
  const frag = DOMPurify.sanitize(raw, { RETURN_DOM_FRAGMENT: true })
  frag.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? ''
    if (/^(data:|https?:)/i.test(src)) return
    let rel = src
    try {
      rel = decodeURI(src)
    } catch {
      /* keep as is */
    }
    img.setAttribute('src', fileUrl(isAbsolute(rel) ? rel : joinPath(baseDir, rel)))
  })
  frag.querySelectorAll('a').forEach((a) => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noreferrer')
  })
  const host = document.createElement('div')
  host.appendChild(frag)
  return host.innerHTML
}

function CodeView({ markdown }: { markdown: string }) {
  const lines = useMemo(
    () => markdown.replace(/\(data:image\/[a-z+]+;base64,[^)]{80,}\)/g, '(data:image/…;base64,…)').split('\n'),
    [markdown]
  )
  return (
    <pre className="code">
      {lines.map((line, i) => {
        const cls = /^#{1,6}\s/.test(line) ? 'h' : /^\s*\|/.test(line) ? 'tb' : undefined
        const bullet = !cls && line.match(/^(\s*(?:[-*+]|\d+\.)\s)(.*)$/)
        return (
          <span key={i}>
            {bullet ? (
              <>
                <span className="li">{bullet[1]}</span>
                {bullet[2]}
              </>
            ) : (
              <span className={cls}>{line}</span>
            )}
            {'\n'}
          </span>
        )
      })}
    </pre>
  )
}

export function Preview({ state, file, onBack, onConvert }: Props) {
  const [doc, setDoc] = useState<OutputDoc | null | undefined>(undefined)
  const [mode, setMode] = useState<'code' | 'rendered'>('rendered')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    void window.api.readOutput(file.id).then((d) => alive && setDoc(d))
    return () => {
      alive = false
    }
  }, [file.id, file.convertedAt])

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onBack])

  const html = useMemo(
    () => (doc ? renderMarkdown(doc.markdown, dirname(doc.outputPath)) : ''),
    [doc]
  )
  const words = useMemo(() => (doc ? (doc.markdown.match(/\S+/g) ?? []).length : 0), [doc])
  const folder = state.folders.find((f) => f.id === file.folderId)
  const mdName = doc ? doc.outputPath.split(/[\\/]/).pop() : file.name
  const working = file.status === 'queued' || file.status === 'converting'

  const stats = [
    file.durationMs !== undefined ? `Convertido en ${formatDuration(file.durationMs)}` : 'Convertido',
    file.pages ? plural(file.pages, 'pág.', 'págs.') : null,
    file.tables ? plural(file.tables, 'tabla', 'tablas') : null
  ].filter(Boolean)

  return (
    <div className="preview">
      <div className="doc-bar">
        <button className="icon-btn back" aria-label="Volver" onClick={onBack}>
          <IconBack />
        </button>
        <div className="titles">
          <span className="crumb ellipsis">
            {folder?.name}  ›  {file.name}
          </span>
          <h1 className="ellipsis">{mdName}</h1>
        </div>
        {working ? (
          <span className="chip converting">
            <i />
            Reconvirtiendo…
          </span>
        ) : (
          <span className="chip done">
            <IconCheck size={12} />
            {stats.join(' · ')}
          </span>
        )}
        <button className="btn" disabled={!doc} onClick={() => doc && void window.api.showInFolder(doc.outputPath)}>
          Mostrar en el Explorador
        </button>
        <button className="btn" disabled={working} onClick={() => onConvert([file.id])}>
          Reconvertir
        </button>
        <button
          className="btn primary"
          disabled={!doc}
          onClick={() => {
            if (!doc) return
            void window.api.copyText(doc.markdown)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
        >
          {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copiado' : 'Copiar Markdown'}
        </button>
      </div>

      <div className="split">
        <section className="pane" aria-label="Original">
          <div className="pane-head">
            <h2>Original</h2>
            <button className="link-btn" onClick={() => void window.api.openPath(file.path)}>
              Abrir original
            </button>
          </div>
          <div className="pane-body original">
            {file.ext === 'pdf' ? (
              <iframe title={`Original: ${file.name}`} src={fileUrl(file.path)} />
            ) : IMAGE_EXTS.includes(file.ext) ? (
              <img alt={`Original: ${file.name}`} src={fileUrl(file.path)} />
            ) : (
              <div className="no-preview">
                <span className={'badge ' + typeClass(file.ext)}>{file.ext}</span>
                <b>{file.name}</b>
                <span>Este formato no se puede previsualizar aquí. Ábrelo con su aplicación para compararlo.</span>
              </div>
            )}
          </div>
          <div className="pane-foot">
            <span className="ellipsis" title={file.path}>
              {file.path}
            </span>
          </div>
        </section>

        <section className="pane" aria-label="Markdown">
          <div className="pane-head">
            <h2>Markdown</h2>
            <div className="segmented two" role="tablist" aria-label="Modo de vista">
              <button role="tab" aria-selected={mode === 'rendered'} onClick={() => setMode('rendered')}>
                Renderizado
              </button>
              <button role="tab" aria-selected={mode === 'code'} onClick={() => setMode('code')}>
                Código
              </button>
            </div>
          </div>
          <div className="pane-body">
            {doc === undefined && <div className="empty-list">Cargando…</div>}
            {doc === null && (
              <div className="empty-list">
                No se encontró el archivo .md. Puede que se haya movido o eliminado; usa «Reconvertir» para generarlo de nuevo.
              </div>
            )}
            {doc && mode === 'code' && <CodeView markdown={doc.markdown} />}
            {doc && mode === 'rendered' && <div className="rendered" dangerouslySetInnerHTML={{ __html: html }} />}
          </div>
          <div className="pane-foot">
            {doc && (
              <>
                <span style={{ flexShrink: 0 }}>{plural(words, 'palabra', 'palabras')} · UTF-8</span>
                <span className="ellipsis" title={doc.outputPath}>
                  {doc.outputPath}
                </span>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
