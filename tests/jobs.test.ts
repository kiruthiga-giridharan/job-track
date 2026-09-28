import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, filterJobs, relativeDay, tabCounts, validateJobInput } from '../src/lib/jobs'
import type { Job } from '../src/lib/types'
import { applyUrlError, safeApplyUrl } from '../src/lib/url'

function job(p: Partial<Job>): Job {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Designer',
    company: 'Acme',
    location: 'Remote',
    description: '',
    apply_url: 'https://acme.example/apply',
    date_added: '2026-09-01',
    date_posted: null,
    salary: '',
    tags: [],
    skills: [],
    notes: '',
    applied: false,
    applied_at: null,
    irrelevant: false,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...p,
  }
}

const jobs = [
  job({ id: 'old', date_added: '2026-08-01' }),
  job({ id: 'new-late', date_added: '2026-09-27', created_at: '2026-09-27T18:00:00Z', applied: true, title: 'Frontend Engineer', notes: 'Used résumé v3' }),
  job({ id: 'new-early', date_added: '2026-09-27', created_at: '2026-09-27T08:00:00Z', location: 'Austin, TX', tags: ['Hybrid'] }),
  job({ id: 'junk', date_added: '2026-09-28', irrelevant: true }),
]

describe('filterJobs', () => {
  it('lists newest first by date added, breaking ties by creation time', () => {
    expect(filterJobs(jobs, 'all', EMPTY_FILTERS).map(j => j.id)).toEqual(['new-late', 'new-early', 'old'])
  })

  it('separates the Applied and Irrelevant tabs', () => {
    expect(filterJobs(jobs, 'applied', EMPTY_FILTERS).map(j => j.id)).toEqual(['new-late'])
    expect(filterJobs(jobs, 'irrelevant', EMPTY_FILTERS).map(j => j.id)).toEqual(['junk'])
    expect(tabCounts(jobs)).toEqual({ all: 3, applied: 1, irrelevant: 1 })
  })

  it('searches across fields including notes, all words required', () => {
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, search: 'résumé v3' }).map(j => j.id)).toEqual(['new-late'])
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, search: 'frontend acme' }).map(j => j.id)).toEqual(['new-late'])
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, search: 'frontend nope' })).toHaveLength(0)
  })

  it('applies location, tag, status and date filters', () => {
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, location: 'austin, tx' }).map(j => j.id)).toEqual(['new-early'])
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, tag: 'hybrid' }).map(j => j.id)).toEqual(['new-early'])
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, status: 'not_applied' }).map(j => j.id)).toEqual(['new-early', 'old'])
    expect(filterJobs(jobs, 'all', { ...EMPTY_FILTERS, addedFrom: '2026-09-01', addedTo: '2026-09-27' })).toHaveLength(2)
  })
})

describe('validation', () => {
  const base = { title: 'T', company: 'C', location: '', description: '', apply_url: 'https://c.example/apply', date_added: '2026-09-28', date_posted: null, salary: '', tags: [], skills: [] }

  it('accepts a complete job', () => {
    expect(validateJobInput(base)).toEqual({})
  })

  it('requires title, company, a real http(s) application URL and a date', () => {
    const errs = validateJobInput({ ...base, title: ' ', company: '', apply_url: 'javascript:alert(1)', date_added: '' })
    expect(Object.keys(errs).sort()).toEqual(['apply_url', 'company', 'date_added', 'title'])
  })

  it('validates Apply links', () => {
    expect(applyUrlError('company.com/apply')).toMatch(/https/)
    expect(safeApplyUrl('https://jobs.lever.co/acme/123')).toBe('https://jobs.lever.co/acme/123')
    expect(safeApplyUrl('data:text/html,hi')).toBeNull()
  })
})

describe('relativeDay', () => {
  const now = new Date(2026, 8, 28, 12)
  it('formats recent dates in local time', () => {
    expect(relativeDay('2026-09-28', now)).toBe('Today')
    expect(relativeDay('2026-09-27', now)).toBe('Yesterday')
    expect(relativeDay('2026-09-20', now)).toBe('8d ago')
  })
})
