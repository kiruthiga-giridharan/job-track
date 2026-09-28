export interface Job {
  id: string
  title: string
  company: string
  location: string
  description: string
  apply_url: string
  date_added: string // YYYY-MM-DD
  date_posted: string | null
  salary: string
  tags: string[]
  skills: string[]
  notes: string
  applied: boolean
  applied_at: string | null
  irrelevant: boolean
  created_at: string
  updated_at: string
}

/** Fields a person enters when adding or editing a job. */
export type JobInput = Pick<
  Job,
  'title' | 'company' | 'location' | 'description' | 'apply_url' | 'date_added' | 'date_posted' | 'salary' | 'tags' | 'skills'
>

export type JobPatch = Partial<JobInput & Pick<Job, 'notes' | 'applied' | 'irrelevant'>>

export interface ExtractedDraft {
  title: string
  company: string
  location: string
  description: string
  apply_url: string
  date_posted: string
  salary: string
  tags: string[]
  skills: string[]
}

export type ExtractResult =
  | { ok: true; draft: ExtractedDraft; source: 'url' | 'text'; usedAi: boolean; warnings: string[] }
  | { ok: false; code: string; message: string }
