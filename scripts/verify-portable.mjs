import { chromium, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const app = new URL('../portable/Brand-Asset-AI-Studio.html', import.meta.url)
const reportDir = new URL('../portable/verification/', import.meta.url)
const html = await readFile(app)
// The managed cloud Chromium blocks file:// by administrator policy.
// Serve only the standalone HTML to validate it without Vite or external assets.
const server = createServer((request, response) => {
  if (request.url !== '/') {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(html)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const appAddress = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
})
const report = {
  mode: 'standalone HTML over loopback; external requests blocked',
  fileNavigation: 'unverified: managed Chromium blocks file://',
  checks: [],
  consoleErrors: [],
  pageErrors: [],
  networkRequests: [],
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } })
  await context.route(/^https?:/, (route) =>
    route.request().url().startsWith(appAddress) ? route.continue() : route.abort(),
  )
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => report.pageErrors.push(error.message))
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(appAddress))
      report.networkRequests.push(request.url())
  })
  await page.goto(appAddress)
  await expect(page.getByRole('heading', { name: '아이디어가 에셋이 되는 순간.' })).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((i) => i.decode()))
  })
  report.checks.push('Initial render, embedded fonts and sample images')

  await page.getByLabel('키워드 & 아이디어').fill('외부 브라우저 구름 테스트')
  await page.getByRole('button', { name: '데모 에셋 생성하기' }).click()
  await expect(page.getByAltText('외부 브라우저 구름 테스트 데모 결과')).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '결과 PNG 다운로드' }).click()
  const bytes = await readFile(await (await downloaded).path())
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(800)
  expect(bytes.readUInt32BE(20)).toBe(800)
  report.checks.push('Demo generation and 800x800 PNG download')

  await page.getByRole('button', { name: '생성 히스토리', exact: true }).click()
  await page.reload()
  await expect(page.locator('.history-grid')).toContainText('외부 브라우저 구름 테스트')
  report.checks.push('History and local storage survive reload')

  await page.getByRole('button', { name: '승인 에셋 라이브러리', exact: true }).click()
  await page.getByRole('button', { name: '에셋 업로드' }).click()
  await page
    .getByLabel('에셋 이미지 파일')
    .setInputFiles({ name: 'offline-test.png', mimeType: 'image/png', buffer: bytes })
  await expect(page.getByAltText('업로드 미리보기')).toBeVisible()
  await page.getByRole('dialog').getByLabel('에셋 이름').fill('오프라인 업로드')
  await page.getByRole('button', { name: '라이브러리에 추가' }).click()
  await page.getByRole('button', { name: /오프라인 업로드/ }).click()
  await expect(page.getByRole('dialog')).toContainText('승인 대기')
  await page.getByRole('button', { name: '로컬 승인 처리' }).click()
  await expect(page.getByRole('dialog').locator('dd').last()).toHaveText('승인 완료')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  report.checks.push('Image upload and explicit local approval without external services')

  await page.getByRole('button', { name: '관리자 설정', exact: true }).click()
  await page.getByRole('button', { name: '편집', exact: true }).click()
  await page.getByLabel('프로필 이름', { exact: true }).fill('Offline Studio')
  await page.getByRole('button', { name: '프로필 저장' }).click()
  await page.getByRole('button', { name: '브랜드 스타일 관리', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Offline Studio', exact: true })).toBeVisible()
  report.checks.push('Profile editing and style screen')

  await mkdir(reportDir, { recursive: true })
  await page.goto(`${appAddress}#generate`)
  await page.screenshot({
    path: fileURLToPath(new URL('desktop.png', reportDir)),
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const label of [
    '승인 에셋 라이브러리',
    '브랜드 스타일 관리',
    '생성 히스토리',
    '관리자 설정',
    'AI 에셋 생성',
  ]) {
    await page.getByRole('button', { name: '메뉴 열기' }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  report.checks.push('All five screens on mobile without horizontal overflow')
  expect(report.consoleErrors).toEqual([])
  expect(report.pageErrors).toEqual([])
  expect(report.networkRequests).toEqual([])
  await writeFile(new URL('report.json', reportDir), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
