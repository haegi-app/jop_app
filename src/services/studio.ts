import { DEFAULT_PROFILE, SAMPLE_ASSETS, SAMPLE_HISTORY, CATEGORIES } from '../data'
import type { Generation, Profile, StudioState } from '../types'

export const STORAGE_KEY = 'brand-asset-studio:phase1:v1'
export const initialState = (): StudioState => ({
  assets: structuredClone(SAMPLE_ASSETS),
  history: structuredClone(SAMPLE_HISTORY),
  profiles: [structuredClone(DEFAULT_PROFILE)],
  activeProfileId: DEFAULT_PROFILE.id,
})
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const date = (v: unknown): v is string => text(v, 40) && Number.isFinite(Date.parse(v))
const localImage = (v: unknown): v is string =>
  text(v, 450000) &&
  (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) || SAMPLE_ASSETS.some((a) => a.image === v))
export function isProfile(p: unknown): p is Profile {
  if (!p || typeof p !== 'object') return false
  const v = p as Profile
  return (
    text(v.id, 100) &&
    text(v.name, 40) &&
    !!v.name.trim() &&
    text(v.description, 160) &&
    text(v.material, 80) &&
    text(v.lighting, 80) &&
    Array.isArray(v.palette) &&
    v.palette.length === 5 &&
    v.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c)) &&
    Array.isArray(v.rules) &&
    v.rules.length <= 10 &&
    v.rules.every((r) => text(r, 160))
  )
}
export function restoreState(raw: string | null): StudioState {
  if (!raw) return initialState()
  try {
    const v = JSON.parse(raw) as StudioState
    if (
      !Array.isArray(v.assets) ||
      !Array.isArray(v.history) ||
      !Array.isArray(v.profiles) ||
      !v.profiles.length ||
      !v.profiles.every(isProfile) ||
      !v.profiles.some((p) => p.id === v.activeProfileId)
    )
      return initialState()
    const assets = v.assets
      .filter(
        (a) =>
          a &&
          text(a.id, 100) &&
          text(a.name, 60) &&
          localImage(a.image) &&
          CATEGORIES.slice(1).includes(a.category) &&
          ['A사 제공', '디자인팀 제작'].includes(a.source) &&
          ['approved', 'pending'].includes(a.status) &&
          ['sample', 'upload'].includes(a.kind) &&
          date(a.createdAt),
      )
      .slice(0, 18)
    const history = v.history
      .filter(
        (g) =>
          g &&
          text(g.id, 100) &&
          text(g.keyword, 120) &&
          localImage(g.image) &&
          text(g.profileName, 40) &&
          date(g.createdAt) &&
          g.kind === 'demo',
      )
      .slice(0, 40)
    return { ...v, assets, history, profiles: v.profiles.slice(0, 5) }
  } catch {
    return initialState()
  }
}
export function validateKeyword(keyword: string) {
  if (!keyword.trim()) return '생성할 에셋의 키워드를 입력해 주세요.'
  if (keyword.trim().length > 120) return '키워드는 120자 이내로 입력해 주세요.'
  return null
}
// Phase 1 adapter: selects a bundled illustration. No image analysis or AI API is called.
// Replace this service with an authenticated backend in the next phase; never ship API keys to the browser.
export async function generateDemo(keyword: string, profile: Profile): Promise<Generation> {
  const error = validateKeyword(keyword)
  if (error) throw new Error(error)
  await new Promise((resolve) => setTimeout(resolve, 900))
  const words = keyword.toLowerCase()
  const matches: [RegExp, number][] = [
    [/구름|클라우드|cloud/, 0],
    [/선물|기프트|gift/, 1],
    [/저축|코인|금융|coin|saving/, 2],
    [/오비트|궤도|orbit/, 3],
    [/하트|사랑|heart/, 4],
    [/별|반짝|star/, 5],
  ]
  const index =
    matches.find(([pattern]) => pattern.test(words))?.[1] ??
    Array.from(words).reduce((sum, c) => sum + c.codePointAt(0)!, 0) % SAMPLE_ASSETS.length
  return {
    id: crypto.randomUUID(),
    keyword: keyword.trim(),
    image: SAMPLE_ASSETS[index].image,
    profileName: profile.name,
    createdAt: new Date().toISOString(),
    kind: 'demo',
  }
}
export async function prepareUpload(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('PNG, JPG, WebP 이미지 파일만 업로드할 수 있습니다.')
  if (file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 이미지를 선택해 주세요.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (image.naturalWidth * image.naturalHeight > 40000000)
      throw new Error('이미지 해상도는 4,000만 픽셀 이하여야 합니다.')
    const scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('이 브라우저에서 이미지 처리를 지원하지 않습니다.')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/png')
    if (data.length > 450000)
      throw new Error('데모 저장 공간을 위해 더 단순하거나 작은 이미지를 선택해 주세요.')
    return data
  } finally {
    URL.revokeObjectURL(url)
  }
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function downloadImage(src: string, name: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 내보낼 수 없습니다.')
  ctx.drawImage(image, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG 변환에 실패했습니다.'))),
      'image/png',
    ),
  )
  downloadBlob(blob, `${name.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60)}-demo.png`)
}
