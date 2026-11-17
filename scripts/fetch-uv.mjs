// Downloads the uv binary that the packaged app uses to install Docling.
// Usage: node scripts/fetch-uv.mjs [win-x64|linux-x64|linux-arm64|mac-arm64|mac-x64]
// Defaults to the current platform and architecture.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ASSETS = {
  'win-x64': 'uv-x86_64-pc-windows-msvc.zip',
  'linux-x64': 'uv-x86_64-unknown-linux-gnu.tar.gz',
  'linux-arm64': 'uv-aarch64-unknown-linux-gnu.tar.gz',
  'mac-arm64': 'uv-aarch64-apple-darwin.tar.gz',
  'mac-x64': 'uv-x86_64-apple-darwin.tar.gz'
}
const osName = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform]
const target = process.argv[2] ?? `${osName}-${process.arch}`
const asset = ASSETS[target]
if (!asset) throw new Error(`Unknown target "${target}". Use one of: ${Object.keys(ASSETS).join(', ')}`)

const url = `https://github.com/astral-sh/uv/releases/latest/download/${asset}`
const outDir = path.resolve('resources/bin')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-'))
const archive = path.join(tmp, asset)

console.log(`Downloading ${url}`)
const res = await fetch(url)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()))

fs.mkdirSync(outDir, { recursive: true })
for (const old of fs.readdirSync(outDir)) if (old.startsWith('uv')) fs.rmSync(path.join(outDir, old))

// bsdtar (bundled with Windows 10+) and GNU tar both extract these archives.
const sysTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
execFileSync(process.platform === 'win32' && fs.existsSync(sysTar) ? sysTar : 'tar', ['-xf', archive, '-C', tmp])
const exe = target.startsWith('win') ? 'uv.exe' : 'uv'
const found = [path.join(tmp, exe), path.join(tmp, asset.replace(/\.(zip|tar\.gz)$/, ''), exe)].find((p) =>
  fs.existsSync(p)
)
if (!found) throw new Error(`${exe} not found in ${asset}`)
fs.copyFileSync(found, path.join(outDir, exe))
if (exe === 'uv') fs.chmodSync(path.join(outDir, exe), 0o755)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`Saved ${path.join(outDir, exe)} (${target})`)
