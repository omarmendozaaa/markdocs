export type FileStatus = 'pending' | 'queued' | 'converting' | 'done' | 'error'
export type Stage = 'loading' | 'converting' | 'writing'
export type ImageMode = 'referenced' | 'embedded' | 'placeholder'
export type Theme = 'system' | 'light' | 'dark'

export interface LibFile {
  id: string
  folderId: string
  /** Absolute path of the original document. */
  path: string
  name: string
  ext: string
  size: number
  mtime: number
  /** Sub-directory inside the folder (kept when importing a directory tree). */
  relDir: string
  status: FileStatus
  stage?: Stage
  outputPath?: string
  error?: string
  pages?: number
  tables?: number
  durationMs?: number
  addedAt: number
  convertedAt?: number
}

export interface Folder {
  id: string
  name: string
  /** Where the .md files go. null = next to each original file. */
  outputDir: string | null
  createdAt: number
}

export interface ConvertOptions {
  ocr: boolean
  tables: boolean
  images: ImageMode
}

export interface Settings {
  outputRoot: string
  theme: Theme
  options: ConvertOptions
}

export interface EngineState {
  status: 'missing' | 'installing' | 'ready' | 'error'
  /** Human readable step shown while installing. */
  step?: string
  log: string[]
  message?: string
  version?: string
}

export interface AppState {
  folders: Folder[]
  files: LibFile[]
  settings: Settings
  engine: EngineState
  platform: string
}

export interface OutputDoc {
  markdown: string
  outputPath: string
}

export const SUPPORTED_EXTENSIONS = [
  'pdf', 'docx', 'pptx', 'xlsx', 'odt', 'ods', 'odp', 'html', 'htm', 'csv', 'md',
  'adoc', 'asciidoc', 'epub', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp'
]

export interface Api {
  getState(): Promise<AppState>
  onState(cb: (s: AppState) => void): () => void
  createFolder(name: string): Promise<string>
  renameFolder(id: string, name: string): Promise<void>
  deleteFolder(id: string): Promise<void>
  chooseFolderOutput(id: string): Promise<void>
  setFolderOutputBeside(id: string): Promise<void>
  addFilesDialog(folderId: string | null): Promise<string | null>
  importFolderDialog(): Promise<string | null>
  addPaths(paths: string[], folderId: string | null): Promise<string | null>
  removeFiles(ids: string[]): Promise<void>
  moveFiles(ids: string[], folderId: string): Promise<void>
  convert(ids: string[]): Promise<void>
  cancel(ids: string[]): Promise<void>
  setSettings(patch: Partial<Settings>): Promise<void>
  chooseOutputRoot(): Promise<void>
  installEngine(): Promise<void>
  readOutput(fileId: string): Promise<OutputDoc | null>
  showInFolder(path: string): Promise<void>
  openPath(path: string): Promise<void>
  copyText(text: string): Promise<void>
  pathForFile(file: File): string
}
