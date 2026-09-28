import { useMemo } from 'react'
import { EMPTY_FILTERS, filterJobs, hasActiveFilters, tabCounts, uniqueSorted, type Filters, type TabKey } from '../lib/jobs'
import type { Job } from '../lib/types'
import { JobCard, type JobActions } from './JobCard'
import { DoodleStars, EmptyState, ErrorState, PRIMARY_BTN, SkeletonCard } from './ui'

const TAB_LABELS: Record<TabKey, string> = { all: 'All Jobs', applied: 'Applied', irrelevant: 'Irrelevant' }

export function JobsPage({
  jobs,
  status,
  error,
  tab,
  setTab,
  filters,
  setFilters,
  actions,
  onAdd,
  onRetry,
}: {
  jobs: Job[]
  status: 'loading' | 'ready' | 'error'
  error: string
  tab: TabKey
  setTab: (t: TabKey) => void
  filters: Filters
  setFilters: (f: Filters) => void
  actions: JobActions
  onAdd: () => void
  onRetry: () => void
}) {
  const visible = useMemo(() => filterJobs(jobs, tab, filters), [jobs, tab, filters])
  const counts = useMemo(() => tabCounts(jobs), [jobs])
  const locations = useMemo(() => uniqueSorted(jobs.map(j => j.location)), [jobs])
  const tags = useMemo(() => uniqueSorted(jobs.flatMap(j => j.tags)), [jobs])
  const filtered = hasActiveFilters(filters)
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v })

  const selectStyle = { width: 'auto', flex: '0 1 160px', paddingRight: '8px' }

  return (
    <>
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="relative">
          <h1 className="font-display text-4xl font-bold leading-tight flex items-center gap-3" style={{ color: '#2D2233' }}>
            <img src="/logo.png" alt="" className="w-14 h-14 flex-shrink-0" />
            Kiruthiga's Job Board
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B5B7B' }}>Track every opportunity, together ✦</p>
          <DoodleStars className="absolute -top-3 -right-16 pointer-events-none hidden sm:block" />
        </div>
        <button className="btn-doodle px-5 py-2.5 text-sm font-bold flex-shrink-0" style={PRIMARY_BTN} onClick={onAdd}>+ Add Job</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: '#EAE0F4' }} role="tablist">
        {(['all', 'applied', 'irrelevant'] as TabKey[]).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="relative px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"
            style={{
              color: tab === t ? '#9B87F5' : '#6B5B7B',
              borderBottom: tab === t ? '2.5px solid #9B87F5' : '2.5px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {TAB_LABELS[t]}
            <span
              className="ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-semibold"
              style={{ background: tab === t ? '#F5F0FF' : '#EAE0F4', color: tab === t ? '#9B87F5' : '#6B5B7B' }}
            >
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <input
          className="doodle-input text-sm"
          style={{ width: 'auto', flex: '1 1 220px', minWidth: 0 }}
          placeholder="🔍 Search titles, companies, descriptions, notes…"
          aria-label="Search jobs"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
        />
        {tab === 'all' && (
          <select className="doodle-input text-sm" style={selectStyle} value={filters.status} onChange={e => set('status', e.target.value as Filters['status'])} aria-label="Application status">
            <option value="any">Any status</option>
            <option value="not_applied">Not applied yet</option>
            <option value="applied">Applied</option>
          </select>
        )}
        <select className="doodle-input text-sm" style={selectStyle} value={filters.location} onChange={e => set('location', e.target.value)} aria-label="Location">
          <option value="">All locations</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="doodle-input text-sm" style={selectStyle} value={filters.tag} onChange={e => set('tag', e.target.value)} aria-label="Tag">
          <option value="">All tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#6B5B7B' }}>Added</span>
          <input type="date" className="doodle-input text-sm" style={{ width: 'auto', flex: '0 1 150px' }} value={filters.addedFrom} onChange={e => set('addedFrom', e.target.value)} aria-label="Added from" />
          <span className="text-xs" style={{ color: '#A899B5' }}>to</span>
          <input type="date" className="doodle-input text-sm" style={{ width: 'auto', flex: '0 1 150px' }} value={filters.addedTo} onChange={e => set('addedTo', e.target.value)} aria-label="Added to" />
        </div>
        {filtered && (
          <button
            className="text-xs px-3 py-1.5 rounded-full border-2 font-semibold"
            style={{ color: '#E84393', borderColor: '#FFB3C6', background: '#FFF0F5' }}
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            ✕ Clear all
          </button>
        )}
      </div>

      {status === 'ready' && filtered && visible.length > 0 && (
        <p className="text-xs mb-3" style={{ color: '#A899B5' }}>{visible.length} matching job{visible.length === 1 ? '' : 's'}</p>
      )}

      {/* Content */}
      {status === 'error' ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : status === 'loading' ? (
        <div className="grid gap-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState tab={tab} filtered={filtered} onAdd={onAdd} onClear={() => setFilters(EMPTY_FILTERS)} />
      ) : (
        <div className="grid gap-4">
          {visible.map(job => (
            <JobCard key={job.id} job={job} actions={actions} />
          ))}
        </div>
      )}
    </>
  )
}
