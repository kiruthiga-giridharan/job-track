// Server-renders the main screens with sample data to catch runtime render errors.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AddJobPage } from '../src/components/AddJobPage'
import { JobDetail } from '../src/components/JobDetail'
import { JobsPage } from '../src/components/JobsPage'
import { EMPTY_FILTERS } from '../src/lib/jobs'
import type { Job } from '../src/lib/types'

const jobs: Job[] = [
  {
    id: 'j1', title: 'Senior Product Designer', company: 'Bloom Studio', location: 'Remote · US', description: 'Lead design.',
    apply_url: 'https://bloom.example/apply', date_added: '2026-09-27', date_posted: '2026-09-20', salary: '$130k–$160k',
    tags: ['Design', 'Remote'], skills: ['Figma', 'User research'], notes: 'Résumé v3', applied: true, applied_at: null, irrelevant: false, created_at: '2026-09-27T10:00:00Z', updated_at: '2026-09-27T11:00:00Z',
  },
  {
    id: 'j2', title: 'PM', company: 'Driftwood', location: '', description: '', apply_url: 'not a url', date_added: '2026-09-20',
    date_posted: null, salary: '', tags: [], skills: [], notes: '', applied: false, applied_at: null, irrelevant: false, created_at: '2026-09-20T10:00:00Z', updated_at: '2026-09-20T10:00:00Z',
  },
]

const actions = { setApplied: vi.fn(), setIrrelevant: vi.fn(), saveNotes: vi.fn(async () => {}), open: vi.fn(), edit: vi.fn() }

describe('screens render', () => {
  it('jobs list shows tabs and validated Apply links', () => {
    const html = renderToStaticMarkup(
      <JobsPage jobs={jobs} status="ready" error="" tab="all" setTab={vi.fn()}
        filters={EMPTY_FILTERS} setFilters={vi.fn()} actions={actions} onAdd={vi.fn()} onRetry={vi.fn()} />,
    )
    expect(html).toContain('All Jobs')
    expect(html).toContain('Irrelevant')
    expect(html).toContain('href="https://bloom.example/apply" target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('Invalid link')
    expect(html).toContain('<li class="skill-chip">User research</li>')
    expect(html.indexOf('Senior Product Designer')).toBeLessThan(html.indexOf('>PM<'))
  })

  it('job detail and add pages render', () => {
    expect(renderToStaticMarkup(
      <JobDetail job={jobs[0]} canDelete actions={actions} onBack={vi.fn()} onDelete={vi.fn()} />,
    )).toMatch(/SKILLS[\s\S]*Figma[\s\S]*DESCRIPTION/)
    expect(renderToStaticMarkup(<AddJobPage jobs={jobs} onSave={vi.fn()} onCancel={vi.fn()} />)).toContain('Add with assistant')
  })
})
