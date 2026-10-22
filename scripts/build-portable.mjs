import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Package the already-built app for file:// review without a web server or viewer.
// This does not change the normal Vite build, application behavior, or API mode.
const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, 'dist')
const output = resolve(root, 'portable')
const mime = {
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
}

async function readAsset(path) {
  const absolute = resolve(dist, path.replace(/^\//, ''))
  if (!absolute.startsWith(dist + sep)) throw new Error(`Unsafe asset path: ${path}`)
  return readFile(absolute)
}

async function dataUrl(path) {
  const type = mime[extname(path)]
  if (!type) throw new Error(`Unsupported portable asset: ${path}`)
  return `data:${type};base64,${(await readAsset(path)).toString('base64')}`
}

let html = await readFile(resolve(dist, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]
if (scripts.length !== 1)
  throw new Error(
    'Expected exactly one entry bundle; review portable packaging for code splitting.',
  )
for (const [tag, path] of scripts) {
  let js = (await readAsset(path)).toString('utf8')
  // Preserve the exact bundled sample image identities used by state validation.
  for (const asset of new Set(js.match(/\/assets\/[a-z-]+\.svg/g) ?? [])) {
    js = js.replaceAll(asset, await dataUrl(asset))
  }
  html = html.replace(
    tag,
    () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
  )
}
for (const [tag, path] of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)) {
  let css = (await readAsset(path)).toString('utf8')
  for (const [reference, asset] of [...css.matchAll(/url\(["']?(\/assets\/[^\s)"']+)["']?\)/g)]) {
    const embedded = await dataUrl(asset)
    css = css.replace(reference, () => `url("${embedded}")`)
  }
  html = html.replace(tag, () => `<style>${css}</style>`)
}
html = html.replace('href="/favicon.svg"', `href="${await dataUrl('/favicon.svg')}"`)
if (/(?:src|href)="\/(?:assets\/|favicon)/.test(html) || /url\(["']?\/assets\//.test(html)) {
  throw new Error('Unresolved external asset in portable build')
}
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'Brand-Asset-AI-Studio.html'), html)
console.log(
  `Portable app written: portable/Brand-Asset-AI-Studio.html (${Math.round(Buffer.byteLength(html) / 1024)} KB)`,
)
