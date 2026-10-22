import { useEffect, useRef, type ReactNode } from 'react'
import { X, Sparkles, ArrowUpRight, Box } from 'lucide-react'

export function DemoBadge({ small = false }: { small?: boolean }) {
  return (
    <span className={`demo-badge ${small ? 'small' : ''}`}>
      <span />
      {small ? 'DEMO' : '데모 모드'}
    </span>
  )
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Box size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
export function ApiNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`api-notice ${compact ? 'compact' : ''}`}>
      <Sparkles size={16} />
      <span>
        {compact
          ? 'Phase 1 · 실제 AI API는 연결되어 있지 않습니다.'
          : '지금은 아이디어를 경험하는 데모입니다. 생성 결과와 스타일 분석은 미리 준비한 샘플이며, 실제 AI 분석·생성 결과가 아닙니다.'}
      </span>
      {!compact && <ArrowUpRight size={16} />}
    </div>
  )
}
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(date))
