import { useState } from 'react'
import { relativeDay } from '../lib/jobs'
import type { Job } from '../lib/types'
import { ApplyButton } from './ApplyButton'
import type { JobActions } from './JobCard'
import { NotesField } from './NotesField'
import { AppliedToggle, BackLink, MUTED_BTN, PINK_BTN, SECONDARY_BTN, SkillList, Tag } from './ui'

export function JobDetail({
  job,
  canDelete,
  actions,
  onBack,
  onDelete,
}: {
  job: Job
  canDelete: boolean
  actions: JobActions
  onBack: () => void
  onDelete: () => Promise<void>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="max-w-2xl mx-auto fade-in">
      <BackLink onClick={onBack} />

      <div className="doodle-card p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-bold mb-1 break-words" style={{ color: '#2D2233' }}>{job.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-lg" style={{ color: '#9B87F5' }}>{job.company}</span>
              {job.location && (
                <>
                  <span style={{ color: '#C8B4FA' }}>·</span>
                  <span style={{ color: '#6B5B7B' }}>{job.location}</span>
                </>
              )}
              {job.salary && (
                <>
                  <span style={{ color: '#C8B4FA' }}>·</span>
                  <span className="font-semibold" style={{ color: '#FF85A2' }}>{job.salary}</span>
                </>
              )}
            </div>
          </div>
          <ApplyButton url={job.apply_url} size="md" />
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          {job.irrelevant && <span className="tag-pill" style={{ color: '#E84393', borderColor: '#FFB3C6', background: '#FFF0F5' }}>Irrelevant</span>}
          {job.tags.map(t => <Tag key={t} label={t} />)}
          <span className="text-sm ml-auto" style={{ color: '#A899B5' }}>
            Added {relativeDay(job.date_added)}
            {job.date_posted && <> · Posted {relativeDay(job.date_posted)}</>}
          </span>
        </div>

        <div className="squiggle mb-5" />

        {job.skills?.length > 0 && (
          <>
            <h4 className="font-semibold text-sm mb-2" style={{ color: '#6B5B7B' }}>SKILLS</h4>
            <div className="mb-6">
              <SkillList skills={job.skills} />
            </div>
          </>
        )}

        <h4 className="font-semibold text-sm mb-2" style={{ color: '#6B5B7B' }}>DESCRIPTION</h4>
        <p className="text-sm leading-relaxed mb-6 whitespace-pre-wrap break-words" style={{ color: '#4A3B5C' }}>
          {job.description || <em style={{ color: '#A899B5' }}>No description yet.</em>}
        </p>

        <div className="squiggle mb-5" />

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <AppliedToggle on={job.applied} onChange={v => actions.setApplied(job.id, v)} />
          <button className="text-sm btn-doodle px-3 py-1.5" style={SECONDARY_BTN} onClick={() => actions.edit(job.id)}>
            ✎ Edit
          </button>
          {!job.irrelevant ? (
            <button className="text-sm btn-doodle px-3 py-1.5" style={PINK_BTN} onClick={() => actions.setIrrelevant(job.id, true)}>
              Mark irrelevant
            </button>
          ) : (
            <button className="text-sm btn-doodle px-3 py-1.5" style={SECONDARY_BTN} onClick={() => actions.setIrrelevant(job.id, false)}>
              ↺ Restore job
            </button>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2" style={{ color: '#6B5B7B' }}>YOUR NOTES</h4>
          <NotesField value={job.notes} rows={5} onSave={notes => actions.saveNotes(job.id, notes)} />
        </div>

        {canDelete && (
          <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-3" style={{ borderColor: '#EAE0F4' }}>
            {!confirmDelete ? (
              <button className="text-xs" style={{ color: '#A899B5' }} onClick={() => setConfirmDelete(true)}>
                Delete permanently…
              </button>
            ) : (
              <>
                <span className="text-sm" style={{ color: '#8A2E5C' }}>Delete this job for everyone? This can’t be undone.</span>
                <button
                  className="text-sm btn-doodle px-3 py-1.5"
                  style={{ color: 'white', background: '#E84393', borderColor: '#E84393' }}
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      await onDelete()
                    } finally {
                      setDeleting(false)
                    }
                  }}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button className="text-sm btn-doodle px-3 py-1.5" style={MUTED_BTN} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
