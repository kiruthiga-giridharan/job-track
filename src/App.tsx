import { useCallback, useMemo, useState } from 'react'
import { AddJobPage } from './components/AddJobPage'
import { AppHeader } from './components/AppHeader'
import { SetupScreen } from './components/SetupScreen'
import { JobDetail } from './components/JobDetail'
import { JobForm } from './components/JobForm'
import type { JobActions } from './components/JobCard'
import { JobsPage } from './components/JobsPage'
import { BackLink, Toasts, type ToastMsg } from './components/ui'
import { useBoard } from './hooks/useBoard'
import { useHashRoute } from './hooks/useHashRoute'
import { EMPTY_FILTERS, type Filters, type TabKey } from './lib/jobs'
import { isSupabaseConfigured } from './lib/supabase'

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />
  return <Board />
}

function Board() {
  const board = useBoard()
  const { route, navigate } = useHashRoute()
  const [tab, setTab] = useState<TabKey>('all')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  const toast = useCallback((text: string, tone: 'error' | 'ok' = 'error') => {
    setToasts(t => [...t.slice(-2), { id: Date.now() + Math.random(), text, tone }])
  }, [])
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), [])

  const { update } = board
  const actions: JobActions = useMemo(
    () => ({
      setApplied: (id, applied) => {
        update(id, { applied }).catch(e => toast(e.message))
      },
      setIrrelevant: (id, irrelevant) => {
        update(id, { irrelevant })
          .then(() => toast(irrelevant ? 'Moved to Irrelevant. Restore it from the Irrelevant tab.' : 'Job restored.', 'ok'))
          .catch(e => toast(e.message))
      },
      saveNotes: (id, notes) => update(id, { notes }),
      open: id => navigate({ name: 'job', id }),
      edit: id => navigate({ name: 'edit', id }),
    }),
    [update, navigate, toast],
  )

  const findJob = (id: string) => board.jobs.find(j => j.id === id)

  let content: React.ReactNode
  if (route.name === 'add') {
    content = (
      <AddJobPage
        jobs={board.jobs}
        onCancel={() => navigate({ name: 'jobs' })}
        onSave={async input => {
          await board.create(input)
          toast('🎉 Job saved!', 'ok')
          setTab('all')
          navigate({ name: 'jobs' })
        }}
      />
    )
  } else if ((route.name === 'job' || route.name === 'edit') && board.status === 'ready') {
    const job = findJob(route.id)
    if (!job) {
      content = (
        <div className="max-w-2xl mx-auto">
          <BackLink onClick={() => navigate({ name: 'jobs' })} />
          <p style={{ color: '#6B5B7B' }}>This job doesn’t exist any more.</p>
        </div>
      )
    } else if (route.name === 'edit') {
      content = (
        <div className="max-w-2xl mx-auto fade-in">
          <BackLink onClick={() => navigate({ name: 'job', id: job.id })} label="← Back to job" />
          <JobForm
            initial={{
              title: job.title,
              company: job.company,
              location: job.location,
              description: job.description,
              apply_url: job.apply_url,
              date_added: job.date_added,
              date_posted: job.date_posted,
              salary: job.salary,
              tags: job.tags,
            }}
            heading="Edit Job"
            submitLabel="Save changes ✓"
            onCancel={() => navigate({ name: 'job', id: job.id })}
            onSubmit={async input => {
              await board.update(job.id, input)
              toast('Changes saved.', 'ok')
              navigate({ name: 'job', id: job.id })
            }}
          />
        </div>
      )
    } else {
      content = (
        <JobDetail
          job={job}
          canDelete
          actions={actions}
          onBack={() => navigate({ name: 'jobs' })}
          onDelete={async () => {
            try {
              await board.remove(job.id)
              toast('Job deleted.', 'ok')
              navigate({ name: 'jobs' })
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not delete')
            }
          }}
        />
      )
    }
  } else {
    content = (
      <JobsPage
        jobs={board.jobs}
        status={board.status}
        error={board.error}
        tab={tab}
        setTab={setTab}
        filters={filters}
        setFilters={setFilters}
        actions={actions}
        onAdd={() => navigate({ name: 'add' })}
        onRetry={board.reload}
      />
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDFBFF' }}>
      <AppHeader route={route} navigate={navigate} />
      <main className="max-w-4xl mx-auto px-4 py-8">{content}</main>
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
