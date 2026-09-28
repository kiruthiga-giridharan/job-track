import type { Job, JobInput } from './types'
import { applyUrlError } from './url'

export type TabKey = 'all' | 'applied' | 'irrelevant'
export type StatusFilter = 'any' | 'not_applied' | 'applied'

export interface Filters {
  search: string
  location: string
  tag: string
  status: StatusFilter
  addedFrom: string
  addedTo: string
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  location: '',
  tag: '',
  status: 'any',
  addedFrom: '',
  addedTo: '',
}

export function hasActiveFilters(f: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).some(k => f[k] !== EMPTY_FILTERS[k])
}

/** Newest first by date added; ties broken by when the row was created. */
export function compareNewestFirst(a: Job, b: Job): number {
  if (a.date_added !== b.date_added) return a.date_added < b.date_added ? 1 : -1
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
  return 0
}

export function inTab(job: Job, tab: TabKey): boolean {
  if (tab === 'irrelevant') return job.irrelevant
  if (tab === 'applied') return job.applied && !job.irrelevant
  return !job.irrelevant
}

export function tabCounts(jobs: Job[]): Record<TabKey, number> {
  return {
    all: jobs.filter(j => inTab(j, 'all')).length,
    applied: jobs.filter(j => inTab(j, 'applied')).length,
    irrelevant: jobs.filter(j => inTab(j, 'irrelevant')).length,
  }
}

function matchesSearch(job: Job, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = [job.title, job.company, job.location, job.description, job.notes, job.salary, ...job.tags]
    .join('\n')
    .toLowerCase()
  return words.every(w => haystack.includes(w))
}

export function filterJobs(jobs: Job[], tab: TabKey, f: Filters): Job[] {
  return jobs
    .filter(j => inTab(j, tab))
    .filter(j => {
      if (!matchesSearch(j, f.search)) return false
      if (f.location && j.location.toLowerCase() !== f.location.toLowerCase()) return false
      if (f.tag && !j.tags.some(t => t.toLowerCase() === f.tag.toLowerCase())) return false
      if (f.status === 'applied' && !j.applied) return false
      if (f.status === 'not_applied' && j.applied) return false
      if (f.addedFrom && j.date_added < f.addedFrom) return false
      if (f.addedTo && j.date_added > f.addedTo) return false
      return true
    })
    .sort(compareNewestFirst)
}

export function uniqueSorted(values: string[]): string[] {
  const seen = new Map<string, string>()
  for (const v of values) {
    const t = v.trim()
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

// ─── Dates ───────────────────────────────────────────────────────────────────

export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "Today", "Yesterday", "3d ago", or a short date — computed in local time. */
export function relativeDay(isoDate: string, now = new Date()): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const then = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 30) return `${days}d ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: then.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type FormErrors = Partial<Record<keyof JobInput, string>>

export function validateJobInput(input: JobInput): FormErrors {
  const errors: FormErrors = {}
  if (!input.title.trim()) errors.title = 'Title is required'
  else if (input.title.length > 300) errors.title = 'Keep the title under 300 characters'
  if (!input.company.trim()) errors.company = 'Company is required'
  else if (input.company.length > 300) errors.company = 'Keep the company under 300 characters'
  const urlErr = applyUrlError(input.apply_url)
  if (urlErr) errors.apply_url = urlErr
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date_added)) errors.date_added = 'Pick the date this job was added'
  if (input.date_posted && !/^\d{4}-\d{2}-\d{2}$/.test(input.date_posted)) errors.date_posted = 'Use a valid date'
  if (input.location.length > 300) errors.location = 'Keep the location under 300 characters'
  if (input.salary.length > 200) errors.salary = 'Keep the salary under 200 characters'
  return errors
}

export function normaliseJobInput(input: JobInput): JobInput {
  return {
    ...input,
    title: input.title.trim(),
    company: input.company.trim(),
    location: input.location.trim(),
    apply_url: input.apply_url.trim(),
    salary: input.salary.trim(),
    description: input.description.trim(),
    date_posted: input.date_posted || null,
    tags: uniqueSorted(input.tags).slice(0, 12),
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#9B87F5', '#FF85A2', '#4ECDC4', '#F7A072', '#7C5CBF', '#E84393', '#5B9BD5']

export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initialsOf(name: string): string {
  const parts = name.replace(/[@._-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
