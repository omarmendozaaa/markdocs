// End-to-end smoke test: drives the real app with a real Docling engine.
// Run `npm run build` first. State lives in .e2e/ (the engine install is
// reused between runs; delete .e2e/engine to exercise the installer again).
import { _electron as electron } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.e2e')
const shots = path.join(root, 'shots')
const samples = path.join(root, 'samples')
const out = path.join(root, 'out')
for (const d of ['userdata', 'out', 'shots']) fs.rmSync(path.join(root, d), { recursive: true, force: true })
fs.mkdirSync(shots, { recursive: true })
if (!fs.existsSync(samples)) throw new Error(`Put sample documents in ${samples} first`)

const assert = (cond, msg) => {
  if (!cond) throw new Error('ASSERT: ' + msg)
  console.log('ok  ' + msg)
}

// E2E_APP=<path to a packaged executable> tests a built package instead of out/.
const app = await electron.launch({
  ...(process.env.E2E_APP ? { executablePath: path.resolve(process.env.E2E_APP), args: [] } : { args: ['.'] }),
  env: {
    ...process.env,
    MARKDOCS_USER_DATA: path.join(root, 'userdata'),
    MARKDOCS_ENGINE_DIR: process.env.E2E_ENGINE_DIR ? path.resolve(process.env.E2E_ENGINE_DIR) : path.join(root, 'engine')
  }
})
const page = await app.firstWindow()
page.on('console', (m) => m.type() === 'error' && console.log('[renderer error]', m.text()))
await page.waitForSelector('.titlebar')
const shot = async (name) => {
  // The compositor may not have painted the window yet; retry briefly.
  for (let i = 0; ; i++) {
    try {
      return await page.screenshot({ path: path.join(shots, name + '.png') })
    } catch (e) {
      if (i >= 5) throw e
      await page.waitForTimeout(500)
    }
  }
}
const state = () => page.evaluate(() => window.api.getState())
// Polls from Node so it keeps working when the window is hidden and rAF is throttled.
const until = async (fn, timeout) => {
  const end = Date.now() + timeout
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('Timed out')
    await new Promise((r) => setTimeout(r, 1000))
  }
}

try {
  // --- engine install (first run only)
  if ((await state()).engine.status !== 'ready') {
    await page.getByRole('dialog', { name: 'Motor de conversión Docling' }).waitFor()
    await shot('01-engine-prompt')
    await page.getByRole('button', { name: 'Instalar motor' }).click()
    await page.getByText('Instalando Docling').waitFor({ timeout: 300_000 })
    await shot('02-engine-installing')
    await until(async () => (await state()).engine.status !== 'installing', 1_800_000)
    const s = await state()
    if (s.engine.status !== 'ready') console.log(JSON.stringify(s.engine, null, 1))
    assert(s.engine.status === 'ready', `engine installed (Docling ${s.engine.version})`)
    await page.getByRole('button', { name: 'Cerrar' }).click()
  }
  await shot('03-welcome')
  assert(await page.getByText('Convierte tus documentos a Markdown').isVisible(), 'welcome screen shown')

  // --- create a folder through the UI
  await page.getByRole('button', { name: /Crear carpeta de proyecto/ }).click()
  await page.getByLabel('Nombre').fill('Proyecto demo')
  await page.getByRole('button', { name: 'Crear carpeta', exact: true }).click()
  await page.getByRole('heading', { name: 'Proyecto demo' }).waitFor()
  assert(true, 'folder created from dialog')

  // --- import a directory tree (native dialogs cannot be automated)
  await page.evaluate((o) => window.api.setSettings({ outputRoot: o }), out)
  const folderId = await page.evaluate((p) => window.api.addPaths([p], null), samples)
  let s = await state()
  const imported = s.files.filter((f) => f.folderId === folderId)
  assert(imported.length >= 3, `imported ${imported.length} files from the samples directory`)
  await page.getByRole('button', { name: /^samples/ }).click()
  await page.getByRole('heading', { name: 'samples' }).waitFor()
  await shot('04-folder')

  // --- convert the whole folder
  await page.getByRole('button', { name: /Convertir carpeta/ }).click()
  await page.locator('.q-item, .q-flat').first().waitFor()
  await shot('05-converting')
  await until(async () => {
    const st = await state()
    return st.files.filter((f) => f.folderId === folderId).every((f) => f.status === 'done' || f.status === 'error')
  }, 900_000)
  s = await state()
  for (const f of s.files.filter((x) => x.folderId === folderId)) {
    assert(f.status === 'done', `${f.relDir ? f.relDir + '/' : ''}${f.name} -> ${f.status} ${f.error ?? ''}`)
    assert(fs.existsSync(f.outputPath) && fs.statSync(f.outputPath).size > 0, `  wrote ${path.relative(root, f.outputPath)}`)
  }
  await shot('06-converted')

  // --- preview
  await page.locator('.trow', { hasText: 'informe.html' }).getByRole('button', { name: 'Ver .md' }).click()
  await page.locator('.rendered h1').waitFor()
  assert((await page.locator('.rendered table').count()) === 1, 'preview renders the table')
  await shot('07-preview-rendered')
  await page.getByRole('tab', { name: 'Código' }).click()
  assert((await page.locator('pre.code').innerText()).includes('# Informe trimestral'), 'code view shows markdown')
  await shot('08-preview-code')
  await page.getByRole('button', { name: 'Volver' }).click()
  const pdfRow = page.locator('.trow', { hasText: '.pdf' }).first()
  if (await pdfRow.count()) {
    await pdfRow.getByRole('button', { name: 'Ver .md' }).click()
    await page.waitForTimeout(2500)
    await shot('09-preview-pdf')
    await page.getByRole('button', { name: 'Volver' }).click()
  }

  // --- selection, remove, settings (dark theme)
  await page.getByLabel(/Seleccionar informe.html/).check()
  await page.getByRole('button', { name: 'Convertir 1 a Markdown' }).waitFor()
  await page.getByRole('button', { name: 'Quitar', exact: true }).click()
  s = await state()
  assert(!s.files.some((f) => f.name === 'informe.html'), 'selected file removed from library')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('radio', { name: 'Oscuro' }).click()
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.waitForTimeout(400)
  await shot('10-dark')
  console.log('\nE2E PASSED')
} catch (e) {
  await shot('99-failure').catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await app.close()
}
