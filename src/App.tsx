import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  FolderOpen,
  Grid2X2,
  History,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Menu,
  Palette,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { ApiNotice, dateLabel, DemoBadge, Empty, Modal, PageHeading } from './components'
import { CATEGORIES, DEFAULT_PROFILE } from './data'
import {
  downloadBlob,
  downloadImage,
  generateDemo,
  initialState,
  isProfile,
  prepareUpload,
  restoreState,
  STORAGE_KEY,
  validateKeyword,
} from './services/studio'
import type { Asset, Category, Generation, Page, Profile } from './types'

const NAV: { id: Page; label: string; icon: typeof Sparkles }[] = [
  { id: 'generate', label: 'AI 에셋 생성', icon: Sparkles },
  { id: 'library', label: '승인 에셋 라이브러리', icon: Grid2X2 },
  { id: 'style', label: '브랜드 스타일 관리', icon: Palette },
  { id: 'history', label: '생성 히스토리', icon: History },
]
const getPage = (): Page =>
  [...NAV.map((n) => n.id), 'settings'].includes(location.hash.slice(1))
    ? (location.hash.slice(1) as Page)
    : 'generate'

export default function App() {
  const [state, setState] = useState(() => {
    try {
      return restoreState(localStorage.getItem(STORAGE_KEY))
    } catch {
      return initialState()
    }
  })
  const [page, setPage] = useState<Page>(getPage)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [result, setResult] = useState<Generation | null>(null)
  const [generating, setGenerating] = useState(false)
  const generationLock = useRef(false)
  const [generationError, setGenerationError] = useState('')
  const [category, setCategory] = useState<Category>('전체')
  const [query, setQuery] = useState('')
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending'>('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [preview, setPreview] = useState<Asset | Generation | null>(null)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    action: () => void
  } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const profile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0]
  const approved = state.assets.filter((a) => a.status === 'approved')
  const pending = state.assets.filter((a) => a.status === 'pending')
  const filtered = state.assets.filter(
    (a) =>
      (category === '전체' || a.category === category) &&
      a.name.toLowerCase().includes(query.toLowerCase()) &&
      (approvalFilter === 'all' || a.status === approvalFilter),
  )
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [state])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const listener = () => {
      setPage(getPage())
      setMobileMenu(false)
    }
    window.addEventListener('hashchange', listener)
    return () => window.removeEventListener('hashchange', listener)
  }, [])
  const navigate = (next: Page) => {
    location.hash = next
    setPage(next)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  async function generate(event?: FormEvent) {
    event?.preventDefault()
    if (generationLock.current) return
    const error = validateKeyword(keyword)
    if (error) {
      setGenerationError(error)
      return
    }
    generationLock.current = true
    setGenerating(true)
    setGenerationError('')
    try {
      const generated = await generateDemo(keyword, profile)
      setResult(generated)
      setState((s) => ({ ...s, history: [generated, ...s.history].slice(0, 40) }))
      setToast('데모 에셋을 만들고 히스토리에 저장했습니다.')
    } catch (e) {
      setGenerationError(
        e instanceof Error ? e.message : '생성에 실패했습니다. 다시 시도해 주세요.',
      )
    } finally {
      generationLock.current = false
      setGenerating(false)
    }
  }
  async function download(image: string, name: string) {
    setDownloading(true)
    try {
      await downloadImage(image, name)
      setToast('PNG 파일을 다운로드했습니다.')
    } catch {
      setToast('다운로드에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setDownloading(false)
    }
  }
  const reuse = (item: Generation) => {
    setKeyword(item.keyword)
    setResult(item)
    setPreview(null)
    navigate('generate')
  }
  const deleteAsset = (asset: Asset) =>
    setConfirm({
      title: '에셋을 삭제할까요?',
      description: `‘${asset.name}’ 에셋을 이 브라우저의 라이브러리에서 삭제합니다.`,
      action: () => {
        setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== asset.id) }))
        setPreview(null)
        setToast('에셋을 삭제했습니다.')
      },
    })
  const selectProfile = (id: string) => {
    setState((s) => ({ ...s, activeProfileId: id }))
    setToast('활성 스타일 프로필을 변경했습니다.')
  }

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <a className="brand" href="#generate" aria-label="Brand Asset Studio 홈">
          <span className="brand-symbol">
            <Sparkles size={23} strokeWidth={1.8} />
          </span>
          <span>
            brandasset<span className="brand-sub">AI DESIGN STUDIO</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">A</span>
          <span>
            <b>Brand Workspace</b>
            <small>디자인팀 워크스페이스</small>
          </span>
          <span className="workspace-tag">P1</span>
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav aria-label="주 메뉴">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {id === 'generate' && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="nav-section-label manage-label">MANAGE</div>
        <button
          className={`nav-item ${page === 'settings' ? 'active' : ''}`}
          aria-current={page === 'settings' ? 'page' : undefined}
          onClick={() => navigate('settings')}
        >
          <Settings2 size={19} strokeWidth={1.7} />
          관리자 설정
        </button>
        <div className="sidebar-bottom">
          <div className="phase-card">
            <span className="phase-icon">
              <Layers3 size={19} />
            </span>
            <b>브랜드의 다음 가능성</b>
            <p>
              일관된 스타일로, 더 자유롭게.
              <br />
              당신의 아이디어를 확장하세요.
            </p>
            <span>
              PHASE 1 <i /> UI PROTOTYPE
            </span>
          </div>
          <div className="user-card">
            <span className="user-avatar">D</span>
            <div>
              <b>디자인팀</b>
              <small>로컬 데모 · 로그인 없음</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="메뉴 열기"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>워크스페이스</span>
            <ChevronRight size={14} />
            <b>{page === 'settings' ? '관리자 설정' : NAV.find((n) => n.id === page)?.label}</b>
          </div>
          <div className="topbar-right">
            <span className="local-state">
              <span className={storageError ? 'error-dot' : 'online-dot'} />
              {storageError ? '저장 공간 확인 필요' : '이 브라우저에 자동 저장'}
            </span>
            <DemoBadge />
          </div>
        </header>
        <main id="main-content">
          {storageError && (
            <div role="alert" className="error-banner">
              브라우저 저장 공간이 부족하거나 저장이 차단되었습니다. 변경 사항은 새로고침하면 사라질
              수 있습니다. 관리자 설정에서 데이터를 백업하거나 불필요한 업로드를 삭제해 주세요.
            </div>
          )}
          {page === 'generate' && (
            <>
              <PageHeading
                eyebrow="CREATE SOMETHING ON-BRAND"
                title="아이디어가 에셋이 되는 순간"
                description="승인된 브랜드 스타일을 바탕으로, 새로운 3D 에셋을 만들어 보세요."
                action={
                  <button className="button secondary" onClick={() => navigate('library')}>
                    <FolderOpen size={16} />
                    에셋 라이브러리
                    <ArrowUpRight size={15} />
                  </button>
                }
              />
              <ApiNotice />
              <div className="studio-grid">
                <section className="panel create-panel">
                  <div className="panel-title">
                    <span className="step-number">01</span>
                    <h2>어떤 에셋을 만들까요?</h2>
                    <WandSparkles size={19} />
                  </div>
                  <form onSubmit={generate}>
                    <label className="field-label" htmlFor="keyword">
                      키워드 & 아이디어<span>필수</span>
                    </label>
                    <div className={`prompt-box ${generationError ? 'invalid' : ''}`}>
                      <textarea
                        id="keyword"
                        value={keyword}
                        maxLength={120}
                        onChange={(e) => {
                          setKeyword(e.target.value)
                          setGenerationError('')
                        }}
                        placeholder={
                          '떠오르는 아이디어를 자유롭게 적어주세요.\n예: 부드러운 구름, 마음을 전하는 선물'
                        }
                        aria-describedby="keyword-help keyword-error"
                        aria-invalid={!!generationError}
                      />
                      <div className="prompt-bottom">
                        <span>
                          <Sparkles size={13} />
                          간결하고 구체적일수록 좋아요
                        </span>
                        <span>{keyword.length}/120</span>
                      </div>
                    </div>
                    <p id="keyword-help" className="hint">
                      오브젝트와 전달하고 싶은 느낌을 함께 입력해 보세요.
                    </p>
                    {generationError && (
                      <p id="keyword-error" role="alert" className="field-error">
                        {generationError}
                      </p>
                    )}
                    <div className="suggestions">
                      <span>이런 키워드는 어때요?</span>
                      <div>
                        {['☁️ 부드러운 구름', '🎁 마음을 전하는 선물', '✨ 반짝이는 영감'].map(
                          (value) => (
                            <button
                              type="button"
                              key={value}
                              onClick={() => {
                                setKeyword(value.split(' ').slice(1).join(' '))
                                setGenerationError('')
                              }}
                            >
                              {value}
                              <Plus size={12} />
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="form-divider" />
                    <div className="field-label">
                      <label htmlFor="profile-select">브랜드 스타일</label>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => navigate('style')}
                      >
                        스타일 보기
                        <ArrowUpRight size={12} />
                      </button>
                    </div>
                    <div className="profile-selector">
                      <span className="profile-icon">
                        <Layers3 size={22} />
                      </span>
                      <div>
                        <select
                          id="profile-select"
                          value={profile.id}
                          onChange={(e) => selectProfile(e.target.value)}
                        >
                          {state.profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <span>스타일 프로필 · 데모 규칙</span>
                      </div>
                      <ChevronDown size={16} />
                    </div>
                    <div className="reference-label">
                      <span>승인 에셋 레퍼런스</span>
                      <span>{approved.length}개</span>
                    </div>
                    <div className="reference-strip">
                      {approved.slice(0, 4).map((asset) => (
                        <button
                          type="button"
                          key={asset.id}
                          title={`${asset.name} · ${asset.kind === 'sample' ? '샘플' : '업로드'}`}
                          onClick={() => setPreview(asset)}
                        >
                          <img src={asset.image} alt={asset.name} />
                        </button>
                      ))}
                      {approved.length > 4 && (
                        <button
                          type="button"
                          className="more-reference"
                          onClick={() => navigate('library')}
                        >
                          +{approved.length - 4}
                        </button>
                      )}
                      {!approved.length && (
                        <span className="hint">
                          승인 에셋이 없습니다. 라이브러리에 추가해 주세요.
                        </span>
                      )}
                    </div>
                    <button
                      className="button primary generate-button"
                      type="submit"
                      onClick={generate}
                      disabled={generating}
                    >
                      {generating ? (
                        <LoaderCircle size={18} className="spin" />
                      ) : (
                        <Sparkles size={18} />
                      )}
                      {generating ? '데모 결과 준비 중…' : '데모 에셋 생성하기'}
                      <ArrowRight size={17} />
                    </button>
                    <p className="under-button">
                      로컬 샘플 미리보기 · API 호출 및 크레딧 사용 없음
                    </p>
                  </form>
                </section>
                <section className="panel preview-panel" aria-busy={generating}>
                  <div className="panel-title">
                    <span className="step-number">02</span>
                    <h2>에셋 미리보기</h2>
                    <span className="preview-size">800 × 800</span>
                  </div>
                  <div className={`preview-stage ${generating ? 'is-generating' : ''}`}>
                    <span className="preview-label">
                      <span />
                      {result ? 'DEMO RESULT' : 'STYLE PREVIEW'}
                    </span>
                    <img
                      src={result?.image ?? '/assets/cloud.svg'}
                      alt={
                        result ? `${result.keyword} 데모 결과` : 'Soft Dimension 스타일의 구름 샘플'
                      }
                    />
                    {generating && (
                      <div className="generating-overlay" role="status">
                        <LoaderCircle size={28} className="spin" />
                        <b>샘플 에셋을 준비하고 있어요</b>
                        <span>실제 AI 생성이 아닌 데모입니다.</span>
                      </div>
                    )}
                    <div className="canvas-footer">
                      <span>{result ? result.keyword : 'A softer side of imagination.'}</span>
                      <span className="canvas-counter">{result ? 'DEMO' : 'SAMPLE 01 / 06'}</span>
                    </div>
                  </div>
                  <div className="preview-meta">
                    <div>
                      <span className="mini-label">
                        {result ? 'YOUR DEMO ASSET' : 'MEET YOUR BRAND STYLE'}
                      </span>
                      <h3>{result ? result.keyword : '부드러운 차원, 새로운 가능성'}</h3>
                      <p>
                        {result
                          ? `${result.profileName} · 데모 결과 · 히스토리 저장됨`
                          : 'Soft clay · Pastel colors · Gentle light'}
                      </p>
                    </div>
                    <button
                      className="button download-button"
                      disabled={!result || downloading || generating}
                      onClick={() => result && download(result.image, result.keyword)}
                      aria-label="결과 PNG 다운로드"
                    >
                      <ArrowDownToLine size={18} />
                      <span>PNG</span>
                    </button>
                  </div>
                  <div className="preview-note">
                    <ShieldCheck size={14} />
                    <span>
                      {result
                        ? '준비된 샘플을 키워드에 매핑한 결과입니다. 업로드 이미지와 프로필은 아직 생성에 반영되지 않습니다.'
                        : '스타일을 미리 살펴보세요. 키워드를 입력하면 데모 결과를 확인할 수 있어요.'}
                    </span>
                  </div>
                </section>
              </div>
              <section className="recent-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      최근 생성한 에셋 <span>{state.history.length}</span>
                    </h2>
                    <p>아이디어의 흐름을 이어가 보세요.</p>
                  </div>
                  <button className="text-button" onClick={() => navigate('history')}>
                    전체 히스토리
                    <ArrowRight size={15} />
                  </button>
                </div>
                {state.history.length ? (
                  <div className="recent-grid">
                    {state.history.slice(0, 3).map((item) => (
                      <button
                        className="recent-card"
                        key={item.id}
                        onClick={() => setPreview(item)}
                      >
                        <img src={item.image} alt={item.keyword} />
                        <div>
                          <span className="mini-label">DEMO ASSET</span>
                          <h3>{item.keyword}</h3>
                          <p>{dateLabel(item.createdAt)}</p>
                        </div>
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="첫 번째 아이디어를 기다리고 있어요"
                    description="에셋을 생성하면 이곳에 기록됩니다."
                  />
                )}
              </section>
            </>
          )}

          {page === 'library' && (
            <>
              <PageHeading
                eyebrow="YOUR BRAND, IN EVERY DIMENSION"
                title="승인 에셋 라이브러리"
                description="브랜드의 기준이 되는 에셋을 한곳에서 관리하세요."
                action={
                  <button className="button primary" onClick={() => setUploadOpen(true)}>
                    <Plus size={17} />
                    에셋 업로드
                  </button>
                }
              />
              <ApiNotice compact />
              <div className="stats-row">
                <div>
                  <span className="stat-icon lavender">
                    <Box size={22} />
                  </span>
                  <div>
                    <span>전체 에셋</span>
                    <b>
                      {state.assets.length}
                      <small>개</small>
                    </b>
                  </div>
                </div>
                <div>
                  <span className="stat-icon mint">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <span>승인 완료</span>
                    <b>
                      {approved.length}
                      <small>개 · 샘플 포함</small>
                    </b>
                  </div>
                </div>
                <div>
                  <span className="stat-icon peach">
                    <Clock3 size={22} />
                  </span>
                  <div>
                    <span>승인 대기</span>
                    <b>
                      {pending.length}
                      <small>개</small>
                    </b>
                  </div>
                </div>
              </div>
              <div className="library-toolbar">
                <div className="tab-list" aria-label="카테고리">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? 'selected' : ''}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="filter-controls">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="에셋 검색"
                      placeholder="에셋 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="승인 상태 필터"
                    value={approvalFilter}
                    onChange={(e) => setApprovalFilter(e.target.value as typeof approvalFilter)}
                  >
                    <option value="all">모든 상태</option>
                    <option value="approved">승인 완료</option>
                    <option value="pending">승인 대기</option>
                  </select>
                </div>
              </div>
              <div className="results-label">
                {filtered.length}개의 에셋{' '}
                <span>기본 제공 이미지는 A사 원본이 아닌 UI 확인용 샘플입니다.</span>
              </div>
              {filtered.length ? (
                <div className="asset-grid">
                  {filtered.map((asset) => (
                    <button className="asset-card" key={asset.id} onClick={() => setPreview(asset)}>
                      <div className="asset-image">
                        <img src={asset.image} alt={asset.name} />
                        <span className={`approval-badge ${asset.status}`}>
                          <span />
                          {asset.status === 'approved' ? '승인 완료' : '승인 대기'}
                        </span>
                        <span className="image-kind">
                          {asset.kind === 'sample' ? 'SAMPLE' : 'UPLOAD'}
                        </span>
                      </div>
                      <div className="asset-card-content">
                        <span className="asset-category">{asset.category}</span>
                        <h3>
                          {asset.name}
                          <ArrowUpRight size={17} />
                        </h3>
                        <p>
                          {asset.source}
                          {asset.kind === 'sample' ? ' · 데모 분류' : ' · 직접 업로드'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  title="조건에 맞는 에셋이 없어요"
                  description="다른 카테고리나 검색어로 찾아보세요."
                  action={
                    <button
                      className="button secondary"
                      onClick={() => {
                        setCategory('전체')
                        setQuery('')
                        setApprovalFilter('all')
                      }}
                    >
                      필터 초기화
                    </button>
                  }
                />
              )}
            </>
          )}

          {page === 'style' && (
            <>
              <PageHeading
                eyebrow="THE DNA OF YOUR BRAND"
                title="브랜드 스타일 관리"
                description="우리 브랜드만의 시각적 언어와 공통 디자인 규칙을 확인하세요."
                action={
                  <button className="button secondary" onClick={() => navigate('settings')}>
                    <SlidersHorizontal size={16} />
                    프로필 관리
                  </button>
                }
              />
              <ApiNotice />
              <div className="style-hero panel">
                <div className="style-hero-copy">
                  <div className="eyebrow">
                    ACTIVE STYLE PROFILE <span className="inline-tag">예시 분석</span>
                  </div>
                  <h2>{profile.name}</h2>
                  <p>{profile.description}</p>
                  <div className="style-tags">
                    <span>
                      <Box size={13} />
                      3D Illustration
                    </span>
                    <span>
                      <ShieldCheck size={13} />
                      승인 에셋 {approved.length}개
                    </span>
                  </div>
                </div>
                <div className="style-hero-images">
                  <img src="/assets/orbit.svg" alt="파스텔 오비트 예시" />
                  <img src="/assets/cloud.svg" alt="부드러운 구름 예시" />
                  <img src="/assets/gift.svg" alt="무광 선물 예시" />
                </div>
              </div>
              <div className="style-detail-grid">
                <section className="panel detail-panel">
                  <div className="section-heading">
                    <h2>스타일 분석 결과</h2>
                    <DemoBadge small />
                  </div>
                  <p className="muted">
                    아래 값은 사전 정의된 프로필입니다. 업로드한 이미지를 분석한 값이 아닙니다.
                  </p>
                  <div className="analysis-row">
                    <span>소재 & 질감</span>
                    <b>{profile.material}</b>
                  </div>
                  <div className="analysis-row">
                    <span>조명 & 그림자</span>
                    <b>{profile.lighting}</b>
                  </div>
                  <div className="analysis-row">
                    <span>구도 & 형태</span>
                    <b>중앙 구도 · 라운드 실루엣</b>
                  </div>
                  <div className="palette-heading">
                    시그니처 컬러 <span>프로필 예시</span>
                  </div>
                  <div className="palette-swatches">
                    {profile.palette.map((color, i) => (
                      <div key={i}>
                        <span style={{ background: color }} />
                        <small>{color}</small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel detail-panel">
                  <div className="section-heading">
                    <h2>공통 디자인 규칙</h2>
                    <span className="rule-count">{profile.rules.length} RULES</span>
                  </div>
                  <p className="muted">일관된 에셋을 위한 디자인팀의 가이드라인</p>
                  <ol className="rules">
                    {profile.rules.map((rule, i) => (
                      <li key={i}>
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {rule}
                      </li>
                    ))}
                  </ol>
                  <div className="rule-note">
                    <ShieldCheck size={17} />
                    프로필 변경은 관리자 설정에서 할 수 있습니다.
                  </div>
                </section>
              </div>
            </>
          )}

          {page === 'history' && (
            <>
              <PageHeading
                eyebrow="EVERY IDEA LEAVES A TRACE"
                title="생성 히스토리"
                description="지나온 아이디어를 다시 살펴보고, 다음 작업의 영감을 찾아보세요."
                action={
                  <button className="button primary" onClick={() => navigate('generate')}>
                    <Plus size={17} />새 에셋 생성
                  </button>
                }
              />
              <ApiNotice compact />
              <div className="section-heading history-heading">
                <h2>
                  전체 기록 <span>{state.history.length}</span>
                </h2>
                <span className="muted">최신순 · 최대 40개 · 모든 결과는 데모</span>
              </div>
              {state.history.length ? (
                <div className="asset-grid history-grid">
                  {state.history.map((item) => (
                    <article className="asset-card" key={item.id}>
                      <button
                        className="asset-image"
                        onClick={() => setPreview(item)}
                        aria-label={`${item.keyword} 결과 보기`}
                      >
                        <img src={item.image} alt={item.keyword} />
                        <span className="image-kind">DEMO RESULT</span>
                      </button>
                      <div className="asset-card-content">
                        <span className="asset-category">{item.profileName}</span>
                        <h3>{item.keyword}</h3>
                        <p>
                          <Clock3 size={12} />
                          {dateLabel(item.createdAt)}
                        </p>
                        <div className="history-actions">
                          <button className="text-button" onClick={() => reuse(item)}>
                            <Copy size={14} />
                            다시 사용
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`${item.keyword} 기록 삭제`}
                            onClick={() =>
                              setConfirm({
                                title: '생성 기록을 삭제할까요?',
                                description: '이 브라우저에 저장된 기록이 삭제됩니다.',
                                action: () => {
                                  setState((s) => ({
                                    ...s,
                                    history: s.history.filter((h) => h.id !== item.id),
                                  }))
                                  setToast('생성 기록을 삭제했습니다.')
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="아직 생성한 에셋이 없어요"
                  description="첫 번째 키워드로 새로운 아이디어를 시작해 보세요."
                  action={
                    <button className="button primary" onClick={() => navigate('generate')}>
                      <Sparkles size={16} />
                      에셋 생성하기
                    </button>
                  }
                />
              )}
            </>
          )}

          {page === 'settings' && (
            <>
              <PageHeading
                eyebrow="A WORKSPACE THAT WORKS FOR YOU"
                title="관리자 설정"
                description="스타일 프로필과 워크스페이스의 기본 설정을 관리하세요."
              />
              <ApiNotice compact />
              <section className="panel settings-panel">
                <div className="section-heading">
                  <div>
                    <h2>스타일 프로필</h2>
                    <p>활성 프로필을 선택하거나 공통 디자인 규칙을 편집하세요.</p>
                  </div>
                  <button
                    className="button secondary"
                    disabled={state.profiles.length >= 5}
                    onClick={() =>
                      setEditProfile({
                        ...structuredClone(DEFAULT_PROFILE),
                        id: crypto.randomUUID(),
                        name: '새 스타일 프로필',
                      })
                    }
                  >
                    <Plus size={16} />
                    프로필 추가
                  </button>
                </div>
                <div className="profile-list">
                  {state.profiles.map((p) => (
                    <div className="profile-row" key={p.id}>
                      <div className="profile-icon">
                        <Layers3 size={24} />
                      </div>
                      <div className="profile-row-info">
                        <h3>
                          {p.name}
                          {p.id === profile.id && <span className="active-badge">활성</span>}
                        </h3>
                        <p>{p.description}</p>
                      </div>
                      <div className="profile-row-actions">
                        {p.id !== profile.id && (
                          <button className="text-button" onClick={() => selectProfile(p.id)}>
                            활성화
                          </button>
                        )}
                        <button
                          className="button secondary small-button"
                          onClick={() => setEditProfile(structuredClone(p))}
                        >
                          편집
                        </button>
                        <button
                          className="icon-button"
                          disabled={state.profiles.length === 1}
                          aria-label={`${p.name} 프로필 삭제`}
                          onClick={() =>
                            setConfirm({
                              title: '스타일 프로필을 삭제할까요?',
                              description:
                                '기존 생성 히스토리는 유지됩니다. 활성 프로필을 삭제하면 다른 프로필로 전환됩니다.',
                              action: () =>
                                setState((s) => {
                                  const profiles = s.profiles.filter((item) => item.id !== p.id)
                                  return {
                                    ...s,
                                    profiles,
                                    activeProfileId:
                                      s.activeProfileId === p.id
                                        ? profiles[0].id
                                        : s.activeProfileId,
                                  }
                                }),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="hint">
                  프로필은 최대 5개까지 저장됩니다. 현재 데모 생성 이미지는 프로필 변경에 따라
                  달라지지 않습니다.
                </p>
              </section>
              <div className="settings-grid">
                <section className="panel detail-panel">
                  <h2>연동 상태</h2>
                  <div className="integration-row">
                    <span className="integration-icon">
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <b>OpenAI 이미지 생성</b>
                      <p>후속 Phase에서 백엔드 연동 예정</p>
                    </div>
                    <span className="disconnected">미연결</span>
                  </div>
                  <div className="integration-row">
                    <span className="integration-icon">
                      <Search size={20} />
                    </span>
                    <div>
                      <b>브랜드 이미지 분석</b>
                      <p>현재 사전 정의된 데모 분석 사용</p>
                    </div>
                    <span className="disconnected">미연결</span>
                  </div>
                  <div className="rule-note">
                    이 화면에서는 API 키를 입력하거나 저장하지 않습니다.
                  </div>
                </section>
                <section className="panel detail-panel">
                  <h2>로컬 데이터 관리</h2>
                  <p className="muted">
                    업로드, 프로필, 기록은 현재 브라우저에만 저장됩니다. 계정·권한·서버 동기화는
                    아직 제공하지 않습니다.
                  </p>
                  <div className="data-actions">
                    <button
                      className="button secondary"
                      onClick={() => {
                        downloadBlob(
                          new Blob(
                            [
                              JSON.stringify(
                                { version: 1, exportedAt: new Date().toISOString(), ...state },
                                null,
                                2,
                              ),
                            ],
                            { type: 'application/json' },
                          ),
                          'brand-studio-backup.json',
                        )
                        setToast('로컬 데이터를 JSON으로 백업했습니다.')
                      }}
                    >
                      <ArrowDownToLine size={16} />
                      데이터 백업
                    </button>
                    <button
                      className="button danger-outline"
                      onClick={() =>
                        setConfirm({
                          title: '데모 데이터를 초기화할까요?',
                          description:
                            '직접 업로드한 에셋, 생성 기록, 수정한 프로필을 지우고 기본 샘플로 복원합니다. 필요한 데이터는 먼저 백업해 주세요.',
                          action: () => {
                            setState(initialState())
                            setResult(null)
                            setKeyword('')
                            setToast('기본 데모 데이터로 초기화했습니다.')
                          },
                        })
                      }
                    >
                      초기화
                    </button>
                  </div>
                </section>
              </div>
              <div className="admin-note">
                <ShieldCheck size={18} />
                <div>
                  <b>Phase 1의 관리 기능은 로컬 데모입니다.</b>
                  <p>
                    승인 변경은 이 브라우저에서만 적용되며 실제 A사 승인 또는 관리자 인증을 의미하지
                    않습니다.
                  </p>
                </div>
              </div>
            </>
          )}
          <footer className="footer">
            <span>
              BRAND ASSET AI STUDIO <i /> PHASE 1
            </span>
            <span>Designed for consistency. Built for imagination.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="알림 닫기" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          limitReached={state.assets.filter((a) => a.kind === 'upload').length >= 12}
          onUpload={(asset) => {
            setState((s) => ({ ...s, assets: [asset, ...s.assets] }))
            setUploadOpen(false)
            setToast('에셋을 업로드했습니다. 승인 대기 상태로 저장됩니다.')
          }}
        />
      )}
      {preview && (
        <Modal
          title={'keyword' in preview ? '생성 결과 상세' : '에셋 상세'}
          onClose={() => setPreview(null)}
          wide
        >
          <div className="detail-modal-grid">
            <img
              className="detail-image"
              src={preview.image}
              alt={'keyword' in preview ? preview.keyword : preview.name}
            />
            <div className="detail-modal-copy">
              <DemoBadge />
              <h3>{'keyword' in preview ? preview.keyword : preview.name}</h3>
              {'keyword' in preview ? (
                <>
                  <p>{preview.profileName}</p>
                  <p className="muted">{dateLabel(preview.createdAt)}</p>
                  <div className="info-box">
                    미리 준비된 샘플 이미지입니다. 실제 AI 생성 결과가 아닙니다.
                  </div>
                  <button className="button secondary" onClick={() => reuse(preview)}>
                    <Copy size={16} />
                    키워드 다시 사용
                  </button>
                </>
              ) : (
                <>
                  <dl>
                    <dt>카테고리</dt>
                    <dd>{preview.category}</dd>
                    <dt>출처</dt>
                    <dd>
                      {preview.source}
                      {preview.kind === 'sample' ? ' (데모 분류)' : ''}
                    </dd>
                    <dt>상태</dt>
                    <dd>{preview.status === 'approved' ? '승인 완료' : '승인 대기'}</dd>
                  </dl>
                  <div className="info-box">
                    {preview.kind === 'sample'
                      ? 'UI 확인용으로 제작한 샘플입니다. A사가 제공하거나 승인한 실제 에셋이 아닙니다.'
                      : '직접 업로드한 이미지입니다. 승인 처리는 로컬 데모 상태만 변경하며 실제 A사 검수를 대체하지 않습니다.'}
                  </div>
                  {preview.kind === 'upload' && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        const updated: Asset = {
                          ...preview,
                          status: preview.status === 'approved' ? 'pending' : 'approved',
                        }
                        setState((s) => ({
                          ...s,
                          assets: s.assets.map((a) => (a.id === preview.id ? updated : a)),
                        }))
                        setPreview(updated)
                        setToast('로컬 승인 상태를 변경했습니다.')
                      }}
                    >
                      <CheckCheck size={16} />
                      {preview.status === 'pending' ? '로컬 승인 처리' : '승인 대기로 변경'}
                    </button>
                  )}
                  <button className="text-button danger-text" onClick={() => deleteAsset(preview)}>
                    <Trash2 size={15} />
                    라이브러리에서 삭제
                  </button>
                </>
              )}
              <button
                className="button primary"
                disabled={downloading}
                onClick={() =>
                  download(preview.image, 'keyword' in preview ? preview.keyword : preview.name)
                }
              >
                <ArrowDownToLine size={16} />
                PNG 다운로드
              </button>
            </div>
          </div>
        </Modal>
      )}
      {editProfile && (
        <ProfileModal
          profile={editProfile}
          onClose={() => setEditProfile(null)}
          onSave={(updated) => {
            setState((s) => ({
              ...s,
              profiles: s.profiles.some((p) => p.id === updated.id)
                ? s.profiles.map((p) => (p.id === updated.id ? updated : p))
                : [...s.profiles, updated],
            }))
            setEditProfile(null)
            setToast('스타일 프로필을 저장했습니다.')
          }}
        />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="confirm-copy">{confirm.description}</p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              취소
            </button>
            <button
              className="button danger"
              onClick={() => {
                confirm.action()
                setConfirm(null)
              }}
            >
              확인
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function UploadModal({
  onClose,
  onUpload,
  limitReached,
}: {
  onClose: () => void
  onUpload: (asset: Asset) => void
  limitReached: boolean
}) {
  const [image, setImage] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Asset['category']>('오브젝트')
  const [source, setSource] = useState<Asset['source']>('디자인팀 제작')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  async function choose(file?: File) {
    if (!file || busy) return
    setBusy(true)
    setError('')
    try {
      setImage(await prepareUpload(file))
      setName(file.name.replace(/\.[^.]+$/, '').slice(0, 60))
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지를 읽을 수 없습니다.')
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (limitReached) return
    if (!image || !name.trim()) {
      setError('이미지와 에셋 이름을 입력해 주세요.')
      return
    }
    onUpload({
      id: crypto.randomUUID(),
      name: name.trim(),
      image,
      category,
      source,
      status: 'pending',
      kind: 'upload',
      createdAt: new Date().toISOString(),
    })
  }
  return (
    <Modal title="새 에셋 업로드" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <p className="muted">브랜드 레퍼런스를 추가하세요. 업로드 시 승인 대기로 저장됩니다.</p>
        {limitReached && (
          <p className="field-error" role="alert">
            로컬 데모는 업로드 12개까지 지원합니다. 기존 업로드를 삭제한 후 다시 시도해 주세요.
          </p>
        )}
        <button
          type="button"
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          disabled={busy || limitReached}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!limitReached) void choose(e.dataTransfer.files[0])
          }}
        >
          {image ? <img src={image} alt="업로드 미리보기" /> : <ImagePlus size={30} />}
          <b>
            {busy
              ? '이미지 처리 중…'
              : image
                ? '다른 이미지 선택'
                : '클릭하거나 이미지를 끌어다 놓으세요'}
          </b>
          <span>PNG, JPG, WebP · 최대 5MB</span>
        </button>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="에셋 이미지 파일"
          ref={input}
          className="visually-hidden"
          onChange={(e) => {
            void choose(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <label>
          에셋 이름
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 부드러운 구름"
          />
        </label>
        <div className="form-columns">
          <label>
            카테고리
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Asset['category'])}
            >
              {CATEGORIES.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            출처
            <select value={source} onChange={(e) => setSource(e.target.value as Asset['source'])}>
              <option>디자인팀 제작</option>
              <option>A사 제공</option>
            </select>
          </label>
        </div>
        <p className="hint">
          로컬 데모용으로 최대 480px로 축소됩니다. 원본 보관·자동 분석·서버 업로드는 수행하지
          않습니다.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="button primary"
            disabled={busy || limitReached}
            type="submit"
            onClick={submit}
          >
            <Plus size={16} />
            라이브러리에 추가
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile
  onClose: () => void
  onSave: (p: Profile) => void
}) {
  const [draft, setDraft] = useState(profile)
  const [rules, setRules] = useState(profile.rules.join('\n'))
  const [error, setError] = useState('')
  const field = (
    key: keyof Pick<Profile, 'name' | 'description' | 'material' | 'lighting'>,
    value: string,
  ) => setDraft((d) => ({ ...d, [key]: value }))
  function submit(e: FormEvent) {
    e.preventDefault()
    const updated = {
      ...draft,
      name: draft.name.trim(),
      rules: rules
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean),
    }
    if (
      !isProfile(updated) ||
      !updated.material.trim() ||
      !updated.lighting.trim() ||
      !updated.rules.length
    ) {
      setError('이름, 소재, 조명과 규칙을 입력해 주세요. 규칙은 최대 10개, 각 160자입니다.')
      return
    }
    onSave(updated)
  }
  return (
    <Modal title="스타일 프로필 편집" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          프로필 이름
          <input
            value={draft.name}
            maxLength={40}
            onChange={(e) => field('name', e.target.value)}
          />
        </label>
        <label>
          설명
          <input
            value={draft.description}
            maxLength={160}
            onChange={(e) => field('description', e.target.value)}
          />
        </label>
        <label>
          소재 & 질감
          <input
            value={draft.material}
            maxLength={80}
            onChange={(e) => field('material', e.target.value)}
          />
        </label>
        <label>
          조명 & 그림자
          <input
            value={draft.lighting}
            maxLength={80}
            onChange={(e) => field('lighting', e.target.value)}
          />
        </label>
        <label>
          공통 디자인 규칙
          <textarea
            aria-label="공통 디자인 규칙"
            value={rules}
            maxLength={1609}
            rows={5}
            onChange={(e) => setRules(e.target.value)}
          />
        </label>
        <p className="hint">
          한 줄에 하나씩 입력하세요. 프로필은 규칙 관리용이며 데모 이미지에는 반영되지 않습니다.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            취소
          </button>
          <button className="button primary" type="submit" onClick={submit}>
            <Check size={16} />
            프로필 저장
          </button>
        </div>
      </form>
    </Modal>
  )
}
