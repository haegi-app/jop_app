import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROFILE } from '../data'
import {
  generateDemo,
  initialState,
  isProfile,
  prepareUpload,
  restoreState,
  validateKeyword,
} from './studio'

describe('keyword validation', () => {
  it('rejects empty, whitespace-only and oversized requests', () => {
    expect(validateKeyword('')).toBeTruthy()
    expect(validateKeyword('   ')).toBeTruthy()
    expect(validateKeyword('가'.repeat(121))).toBeTruthy()
    expect(validateKeyword('부드러운 구름')).toBeNull()
  })
})
describe('demo service contract', () => {
  it('returns explicitly marked bundled results and preserves keyword/profile metadata', async () => {
    vi.useFakeTimers()
    try {
      const promise = generateDemo('  마음을 전하는 선물  ', DEFAULT_PROFILE)
      await vi.advanceTimersByTimeAsync(900)
      const result = await promise
      expect(result.kind).toBe('demo')
      expect(result.image).toBe('/assets/gift.svg')
      expect(result.keyword).toBe('마음을 전하는 선물')
      expect(result.profileName).toBe(DEFAULT_PROFILE.name)
      expect(result.id).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
  it('rejects invalid input without returning a result', async () => {
    await expect(generateDemo(' ', DEFAULT_PROFILE)).rejects.toThrow('키워드')
  })
})
describe('local state validation', () => {
  it('restores valid user state and resets corrupted JSON', () => {
    const state = initialState()
    state.history = []
    expect(restoreState(JSON.stringify(state)).history).toHaveLength(0)
    expect(restoreState('{broken')).toEqual(initialState())
  })
  it('rejects unsafe image sources and unmarked generated results', () => {
    const state = initialState()
    state.assets[0].image = 'javascript:alert(1)'
    state.history[0].kind = 'real' as 'demo'
    expect(restoreState(JSON.stringify(state)).assets).toHaveLength(5)
    expect(restoreState(JSON.stringify(state)).history).toHaveLength(2)
  })
  it('requires a valid active style and enforces profile limits', () => {
    const state = initialState()
    state.activeProfileId = 'missing'
    expect(restoreState(JSON.stringify(state)).activeProfileId).toBe(DEFAULT_PROFILE.id)
    expect(isProfile({ ...DEFAULT_PROFILE, palette: ['red'] })).toBe(false)
    expect(isProfile({ ...DEFAULT_PROFILE, name: '' })).toBe(false)
    expect(isProfile({ ...DEFAULT_PROFILE, rules: Array(11).fill('rule') })).toBe(false)
  })
  it('creates independent initial states', () => {
    const first = initialState()
    first.profiles[0].rules.push('another')
    expect(initialState().profiles[0].rules).toHaveLength(5)
  })
  it('drops invalid dates instead of crashing the history screen', () => {
    const state = initialState()
    state.history[0].createdAt = 'not a date'
    expect(restoreState(JSON.stringify(state)).history).toHaveLength(2)
  })
})
describe('upload validation', () => {
  it('rejects executable SVG and oversize images before decoding', async () => {
    await expect(
      prepareUpload(new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('PNG, JPG, WebP')
    await expect(
      prepareUpload(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
      ),
    ).rejects.toThrow('5MB')
  })
})
