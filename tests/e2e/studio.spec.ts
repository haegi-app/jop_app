import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('generates an explicitly labeled demo, downloads a valid PNG, and persists history', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1')
      externalRequests.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '아이디어가 에셋이 되는 순간.' })).toBeVisible()
  await page.getByRole('button', { name: '데모 에셋 생성하기' }).click()
  await expect(page.getByRole('alert')).toHaveText('생성할 에셋의 키워드를 입력해 주세요.')
  await page.getByLabel('키워드 & 아이디어').fill('새로운 구름 아이디어')
  await page.getByRole('button', { name: '데모 에셋 생성하기' }).click()
  await expect(page.getByRole('button', { name: '데모 결과 준비 중…' })).toBeDisabled()
  await expect(page.getByAltText('새로운 구름 아이디어 데모 결과')).toBeVisible()
  await expect(page.locator('.preview-note')).toContainText('준비된 샘플을 키워드에 매핑한 결과')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '결과 PNG 다운로드' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toContain('-demo.png')
  const bytes = await readFile((await download.path())!)
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(800)
  expect(bytes.readUInt32BE(20)).toBe(800)
  await page.reload()
  await page.getByRole('button', { name: '생성 히스토리', exact: true }).click()
  await expect(page.locator('.history-grid')).toContainText('새로운 구름 아이디어')
  await expect(page.locator('.history-grid .asset-card')).toHaveCount(4)
  expect(errors).toEqual([])
  expect(externalRequests).toEqual([])
})

test('filters the library, uploads an image, and requires an explicit local approval', async ({
  page,
}) => {
  await page.goto('/#library')
  await expect(page.locator('.asset-grid .asset-card')).toHaveCount(6)
  await page.getByRole('button', { name: '금융', exact: true }).click()
  await expect(page.locator('.asset-grid .asset-card')).toHaveCount(1)
  await expect(page.locator('.asset-grid')).toContainText('세이빙 코인')
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await page.getByLabel('에셋 검색').fill('no matching asset')
  await expect(page.getByText('조건에 맞는 에셋이 없어요')).toBeVisible()
  await page.getByRole('button', { name: '필터 초기화' }).click()
  await page.getByRole('button', { name: '에셋 업로드' }).click()
  const dialog = page.getByRole('dialog')
  await page
    .getByLabel('에셋 이미지 파일')
    .setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(dialog.getByRole('alert')).toContainText('PNG, JPG, WebP')
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 160
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#b7a6ef'
    ctx.fillRect(0, 0, 160, 160)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('에셋 이미지 파일').setInputFiles({
    name: 'team-object.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await expect(page.getByAltText('업로드 미리보기')).toBeVisible()
  await dialog.getByLabel('에셋 이름').fill('우리 팀 테스트 에셋')
  await dialog.getByRole('button', { name: '라이브러리에 추가' }).click()
  await expect(page.locator('.asset-grid .asset-card')).toHaveCount(7)
  await page.getByRole('button', { name: /우리 팀 테스트 에셋/ }).click()
  await expect(page.getByRole('dialog')).toContainText('승인 대기')
  await page.getByRole('button', { name: '로컬 승인 처리' }).click()
  await expect(page.getByRole('dialog').locator('dd').last()).toHaveText('승인 완료')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: /우리 팀 테스트 에셋/ })).toContainText('승인 완료')
})

test('creates and edits a profile, activates it, and reflects its rules on the style screen', async ({
  page,
}) => {
  await page.goto('/#settings')
  await page.getByRole('button', { name: '프로필 추가' }).click()
  await page.getByLabel('프로필 이름', { exact: true }).fill('Team Clay')
  await page
    .getByLabel('공통 디자인 규칙', { exact: true })
    .fill('정면 구도를 유지합니다.\n광택을 낮춥니다.')
  await page.getByRole('button', { name: '프로필 저장' }).click()
  await expect(page.locator('.profile-row')).toHaveCount(2)
  await page.getByRole('button', { name: '활성화', exact: true }).click()
  await page.getByRole('button', { name: '브랜드 스타일 관리', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Team Clay', exact: true })).toBeVisible()
  await expect(page.locator('.rules li')).toHaveCount(2)
  await expect(page.locator('.rules')).toContainText('정면 구도를 유지합니다.')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Team Clay', exact: true })).toBeVisible()
})

test('reuses and deletes history with confirmation and supports data backup and reset', async ({
  page,
}) => {
  await page.goto('/#history')
  await page.getByRole('button', { name: '다시 사용' }).first().click()
  await expect(page.getByLabel('키워드 & 아이디어')).toHaveValue('부드러운 구름')
  await page.getByRole('button', { name: '생성 히스토리', exact: true }).click()
  await page.getByRole('button', { name: '부드러운 구름 기록 삭제' }).click()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.locator('.history-grid .asset-card')).toHaveCount(3)
  await page.getByRole('button', { name: '부드러운 구름 기록 삭제' }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  await expect(page.locator('.history-grid .asset-card')).toHaveCount(2)
  await page.getByRole('button', { name: '관리자 설정', exact: true }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '데이터 백업' }).click()
  const backup = await downloadEvent
  const data = JSON.parse(await readFile((await backup.path())!, 'utf8'))
  expect(data.history).toHaveLength(2)
  await page.getByRole('button', { name: '초기화', exact: true }).click()
  await page.getByRole('button', { name: '확인', exact: true }).click()
  await page.getByRole('button', { name: '생성 히스토리', exact: true }).click()
  await expect(page.locator('.history-grid .asset-card')).toHaveCount(3)
})

test('supports all five screens on a narrow viewport without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
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
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
  await page.getByLabel('키워드 & 아이디어').fill('반짝이는 별')
  await page.getByRole('button', { name: '데모 에셋 생성하기' }).click()
  await expect(page.getByAltText('반짝이는 별 데모 결과')).toBeVisible()
})

test('falls back safely when local storage is corrupted', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brand-asset-studio:phase1:v1', '{invalid'))
  await page.goto('/#library')
  await expect(page.locator('.asset-grid .asset-card')).toHaveCount(6)
})
