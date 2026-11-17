import { IconFile, IconFolder, IconFolderPlus, IconUpload } from './icons'

interface Props {
  onAddFiles(): void
  onImportFolder(): void
  onNewFolder(): void
}

export function Welcome(p: Props) {
  return (
    <main className="welcome">
      <div className="inner">
        <div className="hero">
          <h1>Convierte tus documentos a Markdown</h1>
          <p>Tablas, títulos, listas y texto escaneado se conservan. Todo se procesa en este equipo.</p>
        </div>

        <div className="bigdrop">
          <div className="tile">
            <IconUpload size={30} />
          </div>
          <span className="t">Suelta aquí archivos o carpetas completas</span>
          <span className="or">o</span>
          <div className="actions">
            <button className="btn primary big" onClick={p.onAddFiles}>
              Elegir archivos…
            </button>
            <button className="btn big" onClick={p.onImportFolder}>
              Elegir carpeta…
            </button>
          </div>
        </div>

        <div className="paths">
          <button className="path-card" onClick={p.onAddFiles}>
            <IconFile size={22} />
            <b>Conversión rápida</b>
            <span>Archivos sueltos. El .md queda junto a cada original.</span>
          </button>
          <button className="path-card" onClick={p.onImportFolder}>
            <IconFolder size={22} />
            <b>Carpeta del equipo</b>
            <span>Convierte todo lo que hay dentro, incluidas subcarpetas, replicando la estructura.</span>
          </button>
          <button className="path-card" onClick={p.onNewFolder}>
            <IconFolderPlus size={22} />
            <b>Crear carpeta de proyecto</b>
            <span>Agrupa archivos de distintos orígenes y conviértelos juntos cuando quieras.</span>
          </button>
        </div>

        <div className="formats">
          <span>Formatos admitidos</span>
          <span className="badge t-pdf">PDF</span>
          <span className="badge t-doc">DOCX · ODT · EPUB</span>
          <span className="badge t-sheet">XLSX · ODS · CSV</span>
          <span className="badge t-slides">PPTX · ODP</span>
          <span className="badge t-web">HTML · AsciiDoc · MD</span>
          <span className="badge t-img">PNG · JPG · TIFF · WEBP</span>
        </div>
      </div>
    </main>
  )
}
