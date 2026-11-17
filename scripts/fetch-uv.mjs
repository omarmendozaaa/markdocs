// Downloads the uv binary that the packaged app uses to install Docling.
// Usage: node scripts/fetch-uv.mjs [win|linux]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const target = process.argv[2] ?? (process.platform === 'win32' ? 'win' : 'linux')
const asset =
  target === 'win' ? 'uv-x86_64-pc-windows-msvc.zip' : 'uv-x86_64-unknown-linux-gnu.tar.gz'
const url = `https://github.com/astral-sh/uv/releases/latest/download/${asset}`
const outDir = path.resolve('resources/bin')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-'))
const archive = path.join(tmp, asset)

console.log(`Downloading ${url}`)
const res = await fetch(url)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()))

fs.mkdirSync(outDir, { recursive: true })
// bsdtar (Windows 10+) and GNU tar both extract these archives.
const sysTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
execFileSync(process.platform === 'win32' && fs.existsSync(sysTar) ? sysTar : 'tar', ['-xf', archive, '-C', tmp])
const exe = target === 'win' ? 'uv.exe' : 'uv'
const found = [path.join(tmp, exe), path.join(tmp, asset.replace(/\.(zip|tar\.gz)$/, ''), exe)].find((p) =>
  fs.existsSync(p)
)
if (!found) throw new Error(`${exe} not found in ${asset}`)
fs.copyFileSync(found, path.join(outDir, exe))
if (target !== 'win') fs.chmodSync(path.join(outDir, exe), 0o755)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`Saved ${path.join(outDir, exe)}`)
