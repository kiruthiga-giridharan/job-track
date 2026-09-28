// Doodle-style building blocks carried over from the Figma design.
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { colorFor, initialsOf, type TabKey } from '../lib/jobs'

export const PRIMARY_BTN: CSSProperties = {
  color: 'white',
  borderColor: '#9B87F5',
  backgroundColor: '#9B87F5',
  boxShadow: '3px 3px 0 #7C5CBF',
}
export const SECONDARY_BTN: CSSProperties = { color: '#9B87F5', borderColor: '#9B87F5', backgroundColor: 'white' }
export const MUTED_BTN: CSSProperties = { color: '#6B5B7B', borderColor: '#D1C4E9', backgroundColor: 'white' }
export const PINK_BTN: CSSProperties = { color: '#E84393', borderColor: '#FFB3C6', backgroundColor: 'white' }

export function DoodleStars({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="80" height="40" viewBox="0 0 80 40" fill="none" aria-hidden="true">
      <path d="M10 20 L11.5 15 L13 20 L18 21.5 L13 23 L11.5 28 L10 23 L5 21.5 Z" fill="#FFB3C6" opacity="0.7" />
      <path d="M50 10 L51 7 L52 10 L55 11 L52 12 L51 15 L50 12 L47 11 Z" fill="#C8B4FA" opacity="0.7" />
      <circle cx="70" cy="22" r="3" fill="#FFD6E7" opacity="0.8" />
      <circle cx="30" cy="30" r="2" fill="#E8D9FF" opacity="0.8" />
    </svg>
  )
}

export function DoodleCircle({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="120" height="60" viewBox="0 0 120 60" fill="none" aria-hidden="true">
      <ellipse cx="60" cy="30" rx="55" ry="25" stroke="#FFB3C6" strokeWidth="2" strokeDasharray="6 4" opacity="0.4" />
    </svg>
  )
}

export function Avatar({ id, name, size = 'sm' }: { id: string; name: string; size?: 'xs' | 'sm' | 'md' }) {
  const sz = size === 'xs' ? 'w-5 h-5 text-[8px] border-2 border-white' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: colorFor(id) }}
      title={name}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  )
}

export function Tag({ label }: { label: string }) {
  const teal = /^(remote|hybrid|on-?site)$/i.test(label)
  return <span className={`tag-pill ${teal ? 'text-teal-700 border-teal-300 bg-teal-50' : 'text-purple-700 border-purple-300 bg-purple-soft'}`}>{label}</span>
}

/** A job's required skills, styled apart from tags. `limit` collapses the rest into "+N more". */
export function SkillList({ skills, limit }: { skills: string[]; limit?: number }) {
  if (!skills.length) return null
  const shown = limit ? skills.slice(0, limit) : skills
  const hidden = skills.length - shown.length
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
      {shown.map(s => (
        <li key={s} className="skill-chip">{s}</li>
      ))}
      {hidden > 0 && <li className="text-xs self-center" style={{ color: '#A899B5' }}>+{hidden} more</li>}
    </ul>
  )
}

export function AppliedToggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Applied"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 select-none cursor-pointer group disabled:cursor-wait"
    >
      <div className="toggle-track" style={{ borderColor: on ? '#9B87F5' : '#D1C4E9', backgroundColor: on ? '#9B87F5' : 'white' }}>
        <div className="toggle-thumb" style={{ left: on ? '22px' : '2px', backgroundColor: on ? 'white' : '#B0A0C8' }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: on ? '#7C5CBF' : '#6B5B7B' }}>
        {on ? '✓ Applied' : 'Not applied'}
      </span>
    </button>
  )
}

export function Spinner({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <span
      className={`spinner inline-block border-2 rounded-full ${className}`}
      style={{ borderColor: '#9B87F5', borderTopColor: 'transparent' }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="doodle-card p-5 fade-in" aria-hidden="true">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="skeleton h-5 w-48 mb-2" />
          <div className="skeleton h-4 w-32" />
        </div>
        <div className="skeleton h-8 w-20 rounded-full" />
      </div>
      <div className="skeleton h-4 w-full mb-2" />
      <div className="skeleton h-4 w-5/6 mb-4" />
      <div className="flex gap-2">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function EmptyState({ tab, filtered, onAdd, onClear }: { tab: TabKey; filtered: boolean; onAdd: () => void; onClear: () => void }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center py-16 fade-in text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="font-display text-2xl font-bold mb-2" style={{ color: '#7C5CBF' }}>No matches</h3>
        <p className="text-sm mb-6" style={{ color: '#6B5B7B' }}>Nothing in this tab matches your search and filters.</p>
        <button className="btn-doodle px-5 py-2.5 text-sm" style={PINK_BTN} onClick={onClear}>✕ Clear filters</button>
      </div>
    )
  }
  const msgs: Record<TabKey, { icon: string; title: string; sub: string }> = {
    all: { icon: '📋', title: 'No jobs here yet!', sub: 'Add your first job posting to get started.' },
    applied: { icon: '✉️', title: 'Nothing applied to yet', sub: "Switch on “Applied” for a job and it'll show up here." },
    irrelevant: { icon: '🗑️', title: 'No irrelevant jobs', sub: 'Jobs you mark as irrelevant will live here — out of the way, and restorable.' },
  }
  const { icon, title, sub } = msgs[tab]
  return (
    <div className="flex flex-col items-center py-16 fade-in text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="font-display text-2xl font-bold mb-2" style={{ color: '#7C5CBF' }}>{title}</h3>
      <p className="text-sm mb-6" style={{ color: '#6B5B7B' }}>{sub}</p>
      {tab === 'all' && (
        <button className="btn-doodle px-5 py-2.5 text-sm" style={SECONDARY_BTN} onClick={onAdd}>+ Add a Job</button>
      )}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 fade-in text-center">
      <div className="text-5xl mb-4">🌧️</div>
      <h3 className="font-display text-2xl font-bold mb-2" style={{ color: '#E84393' }}>Oops, something went wrong</h3>
      <p className="text-sm mb-6 max-w-md" style={{ color: '#6B5B7B' }}>We couldn't load your jobs. {message}</p>
      <button className="btn-doodle px-5 py-2.5 text-sm" style={{ color: '#FF85A2', borderColor: '#FF85A2' }} onClick={onRetry}>Retry</button>
    </div>
  )
}

export function Notice({ tone = 'purple', children }: { tone?: 'purple' | 'pink'; children: ReactNode }) {
  const style =
    tone === 'pink'
      ? { background: '#FFF0F5', border: '1.5px dashed #FFB3C6', color: '#8A2E5C' }
      : { background: '#F5F0FF', border: '1.5px dashed #C8B4FA', color: '#6B5B7B' }
  return (
    <div className="p-4 rounded-2xl text-sm fade-in" style={style} role={tone === 'pink' ? 'alert' : undefined}>
      {children}
    </div>
  )
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold block mb-1" style={{ color: '#6B5B7B' }}>{label}</span>
      {children}
      {hint && !error && <span className="text-xs mt-1 block" style={{ color: '#A899B5' }}>{hint}</span>}
      {error && <span className="text-xs mt-1 block" style={{ color: '#E84393' }}>{error}</span>}
    </label>
  )
}

export function BackLink({ onClick, label = '← Back to jobs' }: { onClick: () => void; label?: string }) {
  return (
    <button className="flex items-center gap-2 text-sm mb-6 hover:underline" style={{ color: '#9B87F5' }} onClick={onClick}>
      {label}
    </button>
  )
}

export interface ToastMsg {
  id: number
  text: string
  tone: 'error' | 'ok'
}

export function Toasts({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => onDismiss(toasts[0].id), 5000)
    return () => clearTimeout(t)
  }, [toasts, onDismiss])
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(92vw,420px)]" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className="fade-in px-4 py-3 rounded-2xl text-sm flex items-start gap-3 bg-white"
          style={{
            border: `2px solid ${t.tone === 'error' ? '#FFB3C6' : '#C8B4FA'}`,
            boxShadow: `3px 3px 0 ${t.tone === 'error' ? '#FFB3C6' : '#C8B4FA'}`,
            color: t.tone === 'error' ? '#8A2E5C' : '#4A3B5C',
          }}
        >
          <span>{t.tone === 'error' ? '⚠️' : '✦'}</span>
          <span className="flex-1">{t.text}</span>
          <button className="text-xs" style={{ color: '#A899B5' }} onClick={() => onDismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  )
}
