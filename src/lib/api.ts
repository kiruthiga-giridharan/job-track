import { FunctionsHttpError } from '@supabase/supabase-js'
import { db } from './supabase'
import type { ExtractResult, Job, JobInput, JobPatch } from './types'

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  const msg = error?.message ?? fallback
  if (error?.code === '42501' || /row-level security/i.test(msg)) {
    throw new Error('You don’t have permission to do that.')
  }
  throw new Error(msg || fallback)
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function listJobs(): Promise<Job[]> {
  const { data, error } = await db()
    .from('jobs')
    .select('*')
    .order('date_added', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) fail(error, 'Could not load jobs')
  return data as Job[]
}

export async function createJob(input: JobInput): Promise<Job> {
  const { data, error } = await db().from('jobs').insert(input).select().single()
  if (error) fail(error, 'Could not save the job')
  return data as Job
}

export async function updateJob(id: string, patch: JobPatch): Promise<Job> {
  const { data, error } = await db().from('jobs').update(patch).eq('id', id).select().single()
  if (error) fail(error, 'Could not update the job')
  return data as Job
}

export async function deleteJob(id: string): Promise<void> {
  const { data, error } = await db().from('jobs').delete().eq('id', id).select('id')
  if (error) fail(error, 'Could not delete the job')
  if (!data?.length) throw new Error('Could not delete the job.')
}

// ─── Assistant ───────────────────────────────────────────────────────────────

export async function extractJob(body: { url: string } | { description: string; applyUrl: string }): Promise<ExtractResult> {
  const { data, error } = await db().functions.invoke<ExtractResult>('extract-job', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as ExtractResult
        if (payload && payload.ok === false) return payload
      } catch {
        /* fall through */
      }
    }
    return {
      ok: false,
      code: 'unavailable',
      message:
        'The assistant service isn’t reachable. Make sure the `extract-job` Edge Function is deployed — or add the job manually.',
    }
  }
  return data as ExtractResult
}
