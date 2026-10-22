export type Page = 'generate' | 'library' | 'style' | 'history' | 'settings'
export type Category = '전체' | '오브젝트' | '금융' | '라이프스타일' | '테크'
export type Asset = {
  id: string
  name: string
  image: string
  category: Exclude<Category, '전체'>
  source: 'A사 제공' | '디자인팀 제작'
  status: 'approved' | 'pending'
  kind: 'sample' | 'upload'
  createdAt: string
}
export type Generation = {
  id: string
  keyword: string
  image: string
  profileName: string
  createdAt: string
  kind: 'demo'
}
export type Profile = {
  id: string
  name: string
  description: string
  material: string
  lighting: string
  palette: string[]
  rules: string[]
}
export type StudioState = {
  assets: Asset[]
  history: Generation[]
  profiles: Profile[]
  activeProfileId: string
}
