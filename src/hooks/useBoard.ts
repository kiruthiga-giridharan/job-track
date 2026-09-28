import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Job, JobInput, JobPatch } from '../lib/types'

type Status = 'loading' | 'ready' | 'error'

/** Loads jobs, keeps them live via Supabase Realtime, and exposes optimistic mutations. */
export function useBoard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      setJobs(await api.listJobs())
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Live updates from other people using the board.
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client
      .channel('jobs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<Job>).id
          setJobs(js => js.filter(j => j.id !== id))
        } else {
          // Realtime omits large unchanged columns (e.g. a long description) on UPDATE,
          // so merge into the row we already have instead of replacing it.
          const row = payload.new as Job
          setJobs(js => (js.some(j => j.id === row.id) ? js.map(j => (j.id === row.id ? { ...j, ...row } : j)) : [row, ...js]))
        }
      })
      .subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }, [])


  const create = useCallback(async (input: JobInput) => {
    const job = await api.createJob(input)
    setJobs(js => (js.some(j => j.id === job.id) ? js : [job, ...js]))
    return job
  }, [])

  /** Optimistic update; rolls back and rethrows on failure. */
  const update = useCallback(async (id: string, patch: JobPatch) => {
    const before = jobsRef.current.find(j => j.id === id)
    setJobs(js => js.map(j => (j.id === id ? { ...j, ...patch } : j)))
    try {
      const saved = await api.updateJob(id, patch)
      setJobs(js => js.map(j => (j.id === id ? saved : j)))
      return saved
    } catch (e) {
      if (before) setJobs(js => js.map(j => (j.id === id ? before : j)))
      throw e
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteJob(id)
    setJobs(js => js.filter(j => j.id !== id))
  }, [])

  return { jobs, status, error, reload: load, create, update, remove }
}

export type Board = ReturnType<typeof useBoard>
