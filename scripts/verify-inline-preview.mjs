import { chromium, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

// Test an inline HTML viewer with an opaque sandbox origin, no storage access,
// and no native form submissions. This models restrictions, not Codex internals.
const server = createServer((request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204)
    response.end()
    return
  }
  if (request.url !== '/') {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, { 'Content-Type': 'text/html' })
  response.end('<!doctype html><html><body></body></html>')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
})
const result = {
  mode: 'sandboxed inline HTML',
  nativeForms: false,
  persistentStorage: false,
  checks: [],
  errors: [],
  failedRequests: [],
}
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
  page.on('pageerror', (error) => result.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') result.errors.push(message.text())
  })
  page.on('requestfailed', (request) => result.failedRequests.push(request.url()))
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.evaluate(
    (html) => {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('sandbox', 'allow-scripts allow-downloads')
      iframe.style = 'width:1440px;height:1050px;border:0'
      iframe.srcdoc = html
      document.body.append(iframe)
    },
    await readFile(new URL('../portable/Brand-Asset-AI-Studio.html', import.meta.url), 'utf8'),
  )
  const frame = page.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: '아이디어가 에셋이 되는 순간.' })).toBeVisible()
  await expect(frame.getByRole('alert')).toContainText('저장이 차단')
  result.checks.push('Initial UI renders with blocked persistent storage')
  await frame.getByLabel('키워드 & 아이디어').fill('구름')
  await frame.getByRole('button', { name: '데모 에셋 생성하기' }).click()
  await expect(frame.getByAltText('구름 데모 결과')).toBeVisible()
  result.checks.push('Demo generation without native form submission')
  await frame.getByRole('button', { name: '생성 히스토리', exact: true }).click()
  await expect(frame.locator('.history-grid .asset-card')).toHaveCount(4)
  result.checks.push('Exactly one new history entry per click')
  await frame.getByRole('button', { name: '승인 에셋 라이브러리', exact: true }).click()
  await expect(frame.locator('.asset-grid .asset-card')).toHaveCount(6)
  await frame.getByRole('button', { name: '에셋 업로드' }).click()
  await frame
    .getByLabel('에셋 이미지 파일')
    .setInputFiles(fileURLToPath(new URL('../docs/screenshots/05-settings.png', import.meta.url)))
  await expect(frame.getByAltText('업로드 미리보기')).toBeVisible()
  await frame.getByRole('dialog').getByLabel('에셋 이름').fill('프레임 업로드')
  await frame.getByRole('button', { name: '라이브러리에 추가' }).click()
  await expect(frame.locator('.asset-grid .asset-card')).toHaveCount(7)
  result.checks.push('Upload creates exactly one pending asset')
  await frame.getByRole('button', { name: '관리자 설정', exact: true }).click()
  await frame.getByRole('button', { name: '편집', exact: true }).click()
  await frame.getByLabel('프로필 이름', { exact: true }).fill('Frame Profile')
  await frame.getByRole('button', { name: '프로필 저장' }).click()
  await frame.getByRole('button', { name: '브랜드 스타일 관리', exact: true }).click()
  await expect(frame.getByRole('heading', { name: 'Frame Profile', exact: true })).toBeVisible()
  result.checks.push('Profile editing and all five screens')
  expect(result.errors).toEqual([])
  expect(result.failedRequests).toEqual([])
  const output = new URL('../portable/verification/', import.meta.url)
  await mkdir(output, { recursive: true })
  await writeFile(new URL('inline-report.json', output), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
