import fs from 'node:fs'
import path from 'node:path'
import type { Folder, LibFile, Settings } from '../shared/types'

interface Persisted {
  version: 1
  folders: Folder[]
  files: LibFile[]
  settings: Settings
}

/** JSON-file persistence for the library (folders, files, settings). */
export class Store {
  data: Persisted
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly file: string,
    defaults: Settings
  ) {
    this.data = { version: 1, folders: [], files: [], settings: defaults }
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Persisted>
      this.data = {
        version: 1,
        folders: raw.folders ?? [],
        files: (raw.files ?? []).map((f) =>
          // Nothing can still be running after a restart.
          f.status === 'queued' || f.status === 'converting'
            ? { ...f, status: 'pending', stage: undefined }
            : f
        ),
        settings: {
          ...defaults,
          ...raw.settings,
          options: { ...defaults.options, ...raw.settings?.options }
        }
      }
    } catch {
      /* first run or unreadable file: start empty */
    }
  }

  save(): void {
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), 300)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = this.file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    fs.renameSync(tmp, this.file)
  }
}
