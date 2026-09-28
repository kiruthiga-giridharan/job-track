import { useState } from 'react'
import { relativeDay } from '../lib/jobs'
import type { Job } from '../lib/types'
import { ApplyButton } from './ApplyButton'
import { NotesField } from './NotesField'
import { AppliedToggle, SkillList, Tag } from './ui'

export interface JobActions {
  setApplied: (id: string, v: boolean) => void
  setIrrelevant: (id: string, v: boolean) => void
  saveNotes: (id: string, notes: string) => Promise<unknown>
  open: (id: string) => void
  edit: (id: string) => void
}

export function JobCard({ job, actions }: { job: Job; actions: JobActions }) {
  const [showNotes, setShowNotes] = useState(false)

  return (
    <article className={`doodle-card p-5 fade-in ${job.irrelevant ? 'opacity-70' : ''}`} aria-label={`${job.title} at ${job.company}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => actions.open(job.id)}>
          <h3 className="font-bold text-base leading-snug hover:underline" style={{ color: '#2D2233' }}>{job.title}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="font-semibold text-sm" style={{ color: '#9B87F5' }}>{job.company}</span>
            {job.location && (
              <>
                <span style={{ color: '#C8B4FA' }}>·</span>
                <span className="text-sm" style={{ color: '#6B5B7B' }}>{job.location}</span>
              </>
            )}
          </div>
        </button>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ApplyButton url={job.apply_url} />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        {job.applied && !job.irrelevant && (
          <span className="tag-pill" style={{ color: 'white', background: '#9B87F5', borderColor: '#9B87F5' }}>✓ Applied</span>
        )}
        {job.tags.map(t => <Tag key={t} label={t} />)}
        {job.salary && <span className="text-xs font-semibold" style={{ color: '#FF85A2' }}>{job.salary}</span>}
        <span className="text-xs ml-auto" style={{ color: '#A899B5' }} title={`Added ${job.date_added}`}>
          {relativeDay(job.date_added)}
        </span>
      </div>

      {/* Skills */}
      {job.skills?.length > 0 && (
        <div className="flex items-start gap-2 mb-3">
          <span className="text-xs font-semibold pt-0.5 flex-shrink-0" style={{ color: '#6B5B7B' }}>Skills</span>
          <SkillList skills={job.skills} limit={8} />
        </div>
      )}

      {/* Description */}
      {job.description && (
        <p className="text-sm leading-relaxed line-clamp-3 mb-3" style={{ color: '#4A3B5C' }}>{job.description}</p>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t" style={{ borderColor: '#EAE0F4' }}>
        {!job.irrelevant && <AppliedToggle on={job.applied} onChange={v => actions.setApplied(job.id, v)} />}
        <button className="text-xs ml-auto" style={{ color: '#6B5B7B' }} onClick={() => setShowNotes(s => !s)} aria-expanded={showNotes}>
          {showNotes ? '▲ Hide notes' : '▼ Notes' + (job.notes ? ' ✎' : '')}
        </button>
        <button className="text-xs" style={{ color: '#9B87F5' }} onClick={() => actions.edit(job.id)}>Edit</button>
        {!job.irrelevant ? (
          <button className="text-xs" style={{ color: '#E84393' }} onClick={() => actions.setIrrelevant(job.id, true)}>
            Mark irrelevant
          </button>
        ) : (
          <button className="text-xs font-semibold" style={{ color: '#9B87F5' }} onClick={() => actions.setIrrelevant(job.id, false)}>
            ↺ Restore
          </button>
        )}
      </div>

      {/* Notes */}
      {showNotes && (
        <div className="mt-3 fade-in">
          <NotesField value={job.notes} onSave={notes => actions.saveNotes(job.id, notes)} autoFocus />
        </div>
      )}
      {!showNotes && job.notes && (
        <p className="mt-2 text-xs line-clamp-1 cursor-pointer" style={{ color: '#6B5B7B' }} onClick={() => setShowNotes(true)}>
          📝 {job.notes}
        </p>
      )}
    </article>
  )
}
