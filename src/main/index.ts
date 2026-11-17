import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, net, protocol, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Engine } from './engine'
import { Store } from './store'
import {
  SUPPORTED_EXTENSIONS,
  type AppState,
  type Folder,
  type LibFile,
  type OutputDoc,
  type Settings
} from '../shared/types'

const QUICK_FOLDER = 'Conversión rápida'

if (process.env.MARKDOCS_USER_DATA) app.setPath('userData', process.env.MARKDOCS_USER_DATA)

protocol.registerSchemesAsPrivileged([
  { scheme: 'markdocs-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let win: BrowserWindow | null = null
let store: Store
let engine: Engine

// ---------------------------------------------------------------- state

function snapshot(): AppState {
  return {
    folders: store.data.folders,
    files: store.data.files,
    settings: store.data.settings,
    engine: engine.state,
    platform: process.platform
  }
}

let pushTimer: NodeJS.Timeout | null = null
function changed(persist = true): void {
  if (persist) store.save()
  if (pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    win?.webContents.send('state', snapshot())
  }, 40)
}

const fileById = (id: string): LibFile | undefined => store.data.files.find((f) => f.id === id)
const folderById = (id: string): Folder | undefined => store.data.folders.find((f) => f.id === id)

function patchFile(id: string, patch: Partial<LibFile>): void {
  store.data.files = store.data.files.map((f) => (f.id === id ? { ...f, ...patch } : f))
  changed()
}

// -------------------------------------------------------------- library

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim() || 'Carpeta'
}

function uniqueFolderName(name: string): string {
  const names = new Set(store.data.folders.map((f) => f.name.toLowerCase()))
  if (!names.has(name.toLowerCase())) return name
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`
    if (!names.has(candidate.toLowerCase())) return candidate
  }
}

function createFolder(rawName: string, outputBeside = false): Folder {
  const name = uniqueFolderName(rawName.trim() || 'Carpeta nueva')
  const folder: Folder = {
    id: randomUUID(),
    name,
    outputDir: outputBeside ? null : path.join(store.data.settings.outputRoot, sanitize(name)),
    createdAt: Date.now()
  }
  store.data.folders = [...store.data.folders, folder]
  changed()
  return folder
}

const isSupported = (p: string): boolean =>
  SUPPORTED_EXTENSIONS.includes(path.extname(p).slice(1).toLowerCase())

/** Recursively lists supported documents under `dir`. */
function scan(dir: string, rel = ''): { path: string; relDir: string }[] {
  const out: { path: string; relDir: string }[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name.endsWith('_artifacts')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...scan(full, path.join(rel, e.name)))
    else if (e.isFile() && isSupported(full)) out.push({ path: full, relDir: rel })
  }
  return out
}

function addFile(folderId: string, filePath: string, relDir: string): void {
  if (store.data.files.some((f) => f.folderId === folderId && f.path === filePath)) return
  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    return
  }
  store.data.files = [
    ...store.data.files,
    {
      id: randomUUID(),
      folderId,
      path: filePath,
      name: path.basename(filePath),
      ext: path.extname(filePath).slice(1).toLowerCase(),
      size: stat.size,
      mtime: stat.mtimeMs,
      relDir,
      status: 'pending',
      addedAt: Date.now()
    }
  ]
}

function importDirectory(dir: string): Folder {
  const folder = createFolder(path.basename(dir) || dir)
  for (const f of scan(dir)) addFile(folder.id, f.path, f.relDir)
  changed()
  return folder
}

/**
 * Adds files and/or directories. With a target folder everything lands in
 * it (directories keep their structure). Without one, each directory
 * becomes its own folder and loose files go to "Conversión rápida".
 * Returns the id of the folder the UI should show.
 */
function addPaths(paths: string[], folderId: string | null): string | null {
  let target = folderId && folderById(folderId) ? folderId : null
  let shown: string | null = target
  const loose: string[] = []

  for (const p of paths) {
    let stat: fs.Stats
    try {
      stat = fs.statSync(p)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      if (target) {
        for (const f of scan(p)) addFile(target, f.path, path.join(path.basename(p), f.relDir))
      } else {
        shown = importDirectory(p).id
      }
    } else if (stat.isFile() && isSupported(p)) {
      loose.push(p)
    }
  }

  if (loose.length) {
    if (!target) {
      const quick =
        store.data.folders.find((f) => f.name === QUICK_FOLDER && f.outputDir === null) ??
        createFolder(QUICK_FOLDER, true)
      target = quick.id
      shown = quick.id
    }
    for (const p of loose) addFile(target, p, '')
  }
  changed()
  return shown
}

function outputPathFor(file: LibFile): string {
  const folder = folderById(file.folderId)
  const outDir = folder?.outputDir ? path.join(folder.outputDir, file.relDir) : path.dirname(file.path)
  const stem = path.parse(file.name).name
  const clash = store.data.files.some(
    (o) =>
      o.id !== file.id &&
      o.folderId === file.folderId &&
      path.parse(o.name).name.toLowerCase() === stem.toLowerCase() &&
      (folder?.outputDir ? o.relDir === file.relDir : path.dirname(o.path) === path.dirname(file.path))
  )
  let out = path.join(outDir, (clash ? file.name : stem) + '.md')
  // Never overwrite the original (e.g. a .md input converted next to itself).
  if (path.resolve(out) === path.resolve(file.path)) out = path.join(outDir, stem + '.docling.md')
  return out
}

// ---------------------------------------------------------------- queue

const queue: string[] = []
let running: string | null = null
let cancelled = false

function enqueue(ids: string[]): void {
  if (engine.state.status !== 'ready') return
  for (const id of ids) {
    const f = fileById(id)
    if (!f || f.status === 'queued' || f.status === 'converting') continue
    queue.push(id)
    patchFile(id, { status: 'queued', error: undefined, stage: undefined })
  }
  void pump()
}

async function pump(): Promise<void> {
  if (running) return
  let file: LibFile | undefined
  while (!file && queue.length) file = fileById(queue.shift()!)
  if (!file) return

  const id = file.id
  running = id
  cancelled = false
  patchFile(id, { status: 'converting', stage: 'loading' })
  try {
    const res = await engine.convert(
      { id, input: file.path, output: outputPathFor(file), options: store.data.settings.options },
      (stage) => patchFile(id, { stage })
    )
    patchFile(id, {
      status: 'done',
      stage: undefined,
      outputPath: res.output,
      pages: res.pages,
      tables: res.tables,
      durationMs: res.ms,
      convertedAt: Date.now(),
      error: undefined
    })
  } catch (e) {
    const current = fileById(id)
    if (current) {
      if (cancelled) patchFile(id, { status: current.outputPath ? 'done' : 'pending', stage: undefined })
      else patchFile(id, { status: 'error', stage: undefined, error: e instanceof Error ? e.message : String(e) })
    }
  }
  running = null
  void pump()
}

function cancel(ids: string[]): void {
  for (const id of ids) {
    const i = queue.indexOf(id)
    if (i >= 0) {
      queue.splice(i, 1)
      const f = fileById(id)
      if (f) patchFile(id, { status: f.outputPath ? 'done' : 'pending' })
    } else if (running === id) {
      cancelled = true
      engine.stopWorker()
    }
  }
}

// ------------------------------------------------------- local file access

/** The renderer may only read library originals and converted output. */
function isReadable(p: string): boolean {
  const target = path.resolve(p)
  return store.data.files.some((f) => {
    if (path.resolve(f.path) === target) return true
    if (!f.outputPath) return false
    const outDir = path.dirname(path.resolve(f.outputPath)) + path.sep
    return target.startsWith(outDir)
  })
}

function registerProtocol(): void {
  protocol.handle('markdocs-file', (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname.slice(1))
    if (!isReadable(p)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(p).toString())
  })
}

// ------------------------------------------------------------------ ipc

function registerIpc(): void {
  const h = ipcMain.handle.bind(ipcMain)

  h('state:get', () => snapshot())

  h('folder:create', (_e, name: string) => createFolder(name).id)
  h('folder:rename', (_e, id: string, name: string) => {
    const clean = name.trim()
    if (!clean) return
    store.data.folders = store.data.folders.map((f) => (f.id === id ? { ...f, name: clean } : f))
    changed()
  })
  h('folder:delete', (_e, id: string) => {
    cancel(store.data.files.filter((f) => f.folderId === id).map((f) => f.id))
    store.data.files = store.data.files.filter((f) => f.folderId !== id)
    store.data.folders = store.data.folders.filter((f) => f.id !== id)
    changed()
  })
  h('folder:chooseOutput', async (_e, id: string) => {
    const folder = folderById(id)
    if (!folder || !win) return
    const res = await dialog.showOpenDialog(win, {
      title: 'Carpeta de salida',
      defaultPath: folder.outputDir ?? store.data.settings.outputRoot,
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return
    store.data.folders = store.data.folders.map((f) => (f.id === id ? { ...f, outputDir: res.filePaths[0] } : f))
    changed()
  })
  h('folder:outputBeside', (_e, id: string) => {
    store.data.folders = store.data.folders.map((f) => (f.id === id ? { ...f, outputDir: null } : f))
    changed()
  })

  h('files:addDialog', async (_e, folderId: string | null) => {
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      title: 'Agregar archivos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documentos admitidos', extensions: SUPPORTED_EXTENSIONS },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })
    if (res.canceled) return null
    return addPaths(res.filePaths, folderId)
  })
  h('files:importFolderDialog', async () => {
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      title: 'Importar carpeta',
      properties: ['openDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return importDirectory(res.filePaths[0]).id
  })
  h('files:addPaths', (_e, paths: string[], folderId: string | null) => addPaths(paths, folderId))
  h('files:remove', (_e, ids: string[]) => {
    cancel(ids)
    const set = new Set(ids)
    store.data.files = store.data.files.filter((f) => !set.has(f.id))
    changed()
  })
  h('files:move', (_e, ids: string[], folderId: string) => {
    if (!folderById(folderId)) return
    const set = new Set(ids)
    store.data.files = store.data.files.map((f) => {
      if (!set.has(f.id) || f.folderId === folderId) return f
      const dup = store.data.files.some((o) => o.folderId === folderId && o.path === f.path)
      return dup ? f : { ...f, folderId, relDir: '' }
    })
    changed()
  })

  h('convert', (_e, ids: string[]) => enqueue(ids))
  h('cancel', (_e, ids: string[]) => cancel(ids))

  h('settings:set', (_e, patch: Partial<Settings>) => {
    const s = store.data.settings
    store.data.settings = { ...s, ...patch, options: { ...s.options, ...patch.options } }
    nativeTheme.themeSource = store.data.settings.theme
    changed()
  })
  h('settings:chooseOutputRoot', async () => {
    if (!win) return
    const res = await dialog.showOpenDialog(win, {
      title: 'Carpeta de salida predeterminada',
      defaultPath: store.data.settings.outputRoot,
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return
    store.data.settings = { ...store.data.settings, outputRoot: res.filePaths[0] }
    changed()
  })

  h('engine:install', () => {
    void engine.install()
  })

  h('output:read', async (_e, fileId: string): Promise<OutputDoc | null> => {
    const f = fileById(fileId)
    if (!f?.outputPath) return null
    try {
      return { markdown: await fs.promises.readFile(f.outputPath, 'utf8'), outputPath: f.outputPath }
    } catch {
      return null
    }
  })
  h('shell:showInFolder', (_e, p: string) => {
    if (fs.existsSync(p)) shell.showItemInFolder(p)
    else void shell.openPath(path.dirname(p))
  })
  h('shell:openPath', (_e, p: string) => {
    if (isReadable(p)) void shell.openPath(p)
  })
  h('clipboard:write', (_e, text: string) => clipboard.writeText(text))
}

// --------------------------------------------------------------- window

function overlayColors(): { color: string; symbolColor: string; height: number } {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#1B1D22', symbolColor: '#E8EAED', height: 40 }
    : { color: '#EEF0F3', symbolColor: '#1B1D21', height: 40 }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    show: false,
    title: 'Markdocs',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16181C' : '#F3F4F6',
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? false : overlayColors(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      plugins: true
    }
  })
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => (win = null))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

function resource(...parts: string[]): string {
  return app.isPackaged ? path.join(process.resourcesPath, ...parts) : path.join(app.getAppPath(), ...parts)
}

function findUv(): string {
  const exe = process.platform === 'win32' ? 'uv.exe' : 'uv'
  const bundled = app.isPackaged ? resource('bin', exe) : resource('resources', 'bin', exe)
  return fs.existsSync(bundled) ? bundled : 'uv'
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    store = new Store(path.join(app.getPath('userData'), 'library.json'), {
      outputRoot: path.join(app.getPath('documents'), 'Markdocs'),
      theme: 'system',
      options: { ocr: true, tables: true, images: 'referenced' }
    })
    nativeTheme.themeSource = store.data.settings.theme

    engine = new Engine(
      process.env.MARKDOCS_ENGINE_DIR || path.join(app.getPath('userData'), 'engine'),
      findUv(),
      resource('engine', 'worker.py')
    )
    engine.on('change', () => changed(false))

    nativeTheme.on('updated', () => {
      if (process.platform !== 'darwin') win?.setTitleBarOverlay(overlayColors())
    })

    // macOS needs the default menu for Cmd+Q and the edit shortcuts.
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    registerProtocol()
    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => {
    engine?.stopWorker()
    store?.flush()
    app.quit()
  })
}
