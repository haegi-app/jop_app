import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const base = process.env.STUDIO_BASE_URL || 'http://127.0.0.1:5173'
const output = new URL('../docs/screenshots/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath })
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
  })
  for (const [index, route] of ['generate', 'library', 'style', 'history', 'settings'].entries()) {
    await page.goto(`${base}/#${route}`)
    await page.locator('h1').waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((image) => image.decode()))
    })
    await page.screenshot({
      path: new URL(`0${index + 1}-${route}.png`, output).pathname,
      fullPage: true,
      animations: 'disabled',
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/#generate`)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode()))
  })
  await page.screenshot({
    path: new URL('06-mobile.png', output).pathname,
    fullPage: true,
    animations: 'disabled',
  })
  console.log('Saved 5 desktop screens and 1 mobile screen in docs/screenshots/.')
} finally {
  await browser.close()
}
