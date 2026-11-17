import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { ConvertOptions, EngineState, Stage } from '../shared/types'

export interface Job {
  id: string
  input: string
  output: string
  options: ConvertOptions
}

export interface JobResult {
  output: string
  pages: number
  tables: number
  ms: number
}

interface Pending {
  resolve: (r: JobResult) => void
  reject: (e: Error) => void
  onStage: (s: Stage) => void
}

const PYTHON_VERSION = '3.12'
const MAX_LOG = 200

/**
 * Owns the local Docling installation (a uv-managed virtualenv inside the
 * app's data directory) and the long-lived Python worker process.
 */
export class Engine extends EventEmitter {
  state: EngineState = { status: 'missing', log: [] }
  private worker: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<string, Pending>()

  constructor(
    private readonly dir: string,
    private readonly uvPath: string,
    private readonly workerScript: string
  ) {
    super()
    this.check()
  }

  private get venvDir(): string {
    return path.join(this.dir, 'venv')
  }

  private get python(): string {
    return process.platform === 'win32'
      ? path.join(this.venvDir, 'Scripts', 'python.exe')
      : path.join(this.venvDir, 'bin', 'python')
  }

  private get marker(): string {
    return path.join(this.dir, 'engine.json')
  }

  private get env(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1',
      HF_HOME: path.join(this.dir, 'models'),
      HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
      UV_PYTHON_INSTALL_DIR: path.join(this.dir, 'python')
    }
  }

  private set(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch }
    this.emit('change')
  }

  private log(line: string): void {
    const clean = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trimEnd()
    if (!clean) return
    const log = [...this.state.log, clean].slice(-MAX_LOG)
    this.set({ log })
  }

  check(): void {
    try {
      if (fs.existsSync(this.marker) && fs.existsSync(this.python)) {
        const info = JSON.parse(fs.readFileSync(this.marker, 'utf8'))
        this.set({ status: 'ready', version: info.version, message: undefined })
        return
      }
    } catch {
      /* fall through to missing */
    }
    this.set({ status: 'missing' })
  }

  /** Runs a command, streaming its output into the install log. */
  private run(cmd: string, args: string[], capture = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { env: this.env, windowsHide: true })
      let out = ''
      const feed = (stream: NodeJS.ReadableStream, keep: boolean): void => {
        const rl = readline.createInterface({ input: stream })
        rl.on('line', (l) => {
          if (keep) out += l + '\n'
          else for (const part of l.split('\r')) this.log(part)
        })
      }
      feed(child.stdout, capture)
      feed(child.stderr, false)
      child.on('error', (e) => reject(new Error(`No se pudo ejecutar ${path.basename(cmd)}: ${e.message}`)))
      child.on('close', (code) => {
        if (code === 0) resolve(out.trim())
        else reject(new Error(`${path.basename(cmd)} terminó con código ${code}`))
      })
    })
  }

  async install(): Promise<void> {
    if (this.state.status === 'installing') return
    this.stopWorker()
    this.set({ status: 'installing', log: [], message: undefined, step: 'Preparando Python' })
    try {
      fs.mkdirSync(this.dir, { recursive: true })
      fs.rmSync(this.marker, { force: true })

      await this.run(this.uvPath, ['venv', '--python', PYTHON_VERSION, '--clear', this.venvDir])

      this.set({ step: 'Instalando Docling (puede tardar varios minutos)' })
      await this.run(this.uvPath, [
        'pip', 'install', '--python', this.python, '--torch-backend', 'cpu', 'docling'
      ])

      this.set({ step: 'Descargando modelos de análisis y OCR' })
      await this.run(this.python, [this.workerScript, '--warmup'])

      const version = await this.run(
        this.python,
        ['-c', "from importlib.metadata import version; print(version('docling'))"],
        true
      )
      fs.writeFileSync(this.marker, JSON.stringify({ version, installedAt: Date.now() }))
      this.set({ status: 'ready', version, step: undefined })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.log(message)
      this.set({ status: 'error', message, step: undefined })
    }
  }

  private startWorker(): ChildProcessWithoutNullStreams {
    if (this.worker) return this.worker
    const child = spawn(this.python, ['-u', this.workerScript], { env: this.env, windowsHide: true })
    this.worker = child

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }
      const p = this.pending.get(msg.id)
      if (msg.type === 'stage' && p) p.onStage(msg.stage)
      else if (msg.type === 'done' && p) {
        this.pending.delete(msg.id)
        p.resolve({ output: msg.output, pages: msg.pages, tables: msg.tables, ms: msg.ms })
      } else if (msg.type === 'error' && p) {
        this.pending.delete(msg.id)
        p.reject(new Error(msg.message))
      }
    })
    child.stderr.resume()

    const fail = (reason: string): void => {
      if (this.worker === child) this.worker = null
      for (const [, p] of this.pending) p.reject(new Error(reason))
      this.pending.clear()
    }
    child.on('error', (e) => fail(`No se pudo iniciar el motor: ${e.message}`))
    child.on('close', () => fail('El motor de conversión se detuvo inesperadamente.'))
    return child
  }

  convert(job: Job, onStage: (s: Stage) => void): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      if (this.state.status !== 'ready') {
        reject(new Error('El motor Docling no está instalado.'))
        return
      }
      const worker = this.startWorker()
      this.pending.set(job.id, { resolve, reject, onStage })
      worker.stdin.write(JSON.stringify(job) + '\n')
    })
  }

  /** Kills the worker; any in-flight job is rejected with `reason`. */
  stopWorker(reason = 'Conversión cancelada.'): void {
    const child = this.worker
    if (!child) return
    this.worker = null
    for (const [, p] of this.pending) p.reject(new Error(reason))
    this.pending.clear()
    child.removeAllListeners('close')
    child.kill()
  }
}
