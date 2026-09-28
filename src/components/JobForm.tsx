import { useState, type ReactNode } from 'react'
import { normaliseJobInput, todayIso, validateJobInput, type FormErrors } from '../lib/jobs'
import type { JobInput } from '../lib/types'
import { Field, MUTED_BTN, PRIMARY_BTN, Spinner } from './ui'

export function blankJobInput(): JobInput {
  return {
    title: '',
    company: '',
    location: '',
    description: '',
    apply_url: '',
    date_added: todayIso(),
    date_posted: null,
    salary: '',
    tags: [],
    skills: [],
  }
}

/** Shared form for manual add, edit, and reviewing assistant suggestions. */
export function JobForm({
  initial,
  heading,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = 'Cancel',
  banner,
}: {
  initial: JobInput
  heading: string
  submitLabel: string
  onSubmit: (input: JobInput) => Promise<void>
  onCancel: () => void
  cancelLabel?: string
  banner?: (form: JobInput) => ReactNode
}) {
  const [form, setForm] = useState<JobInput>(initial)
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [skillsText, setSkillsText] = useState(initial.skills.join(', '))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function set<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const splitList = (text: string) => text.split(',').map(t => t.trim()).filter(Boolean)
    const input: JobInput = { ...form, tags: splitList(tagsText), skills: splitList(skillsText) }
    const errs = validateJobInput(input)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    try {
      await onSubmit(normaliseJobInput(input))
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const input = (key: 'title' | 'company' | 'location' | 'salary' | 'apply_url', placeholder: string, type = 'text') => (
    <input
      type={type}
      className="doodle-input text-sm"
      placeholder={placeholder}
      value={form[key]}
      onChange={e => set(key, e.target.value)}
      style={{ borderColor: errors[key] ? '#FF85A2' : undefined }}
      aria-invalid={!!errors[key]}
    />
  )

  return (
    <form className="doodle-card p-5 fade-in" onSubmit={handleSubmit} noValidate>
      <h3 className="font-display text-xl font-bold mb-4" style={{ color: '#7C5CBF' }}>{heading}</h3>
      {banner && <div className="mb-4">{banner(form)}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job title *" error={errors.title}>{input('title', 'e.g. Senior Product Designer')}</Field>
        <Field label="Company *" error={errors.company}>{input('company', 'e.g. Acme Corp')}</Field>
        <Field label="Location" error={errors.location}>{input('location', 'e.g. Remote · US')}</Field>
        <Field label="Salary (optional)" error={errors.salary}>{input('salary', 'e.g. $120k–$150k')}</Field>
        <div className="sm:col-span-2">
          <Field label="Application URL *" error={errors.apply_url} hint="The company’s real application page — the Apply button opens this.">
            {input('apply_url', 'https://company.com/careers/apply/123', 'url')}
          </Field>
        </div>
        <Field label="Date added *" error={errors.date_added} hint="Jobs are listed newest first by this date.">
          <input
            type="date"
            className="doodle-input text-sm"
            value={form.date_added}
            max="9999-12-31"
            onChange={e => set('date_added', e.target.value)}
            style={{ borderColor: errors.date_added ? '#FF85A2' : undefined }}
          />
        </Field>
        <Field label="Date posted (optional)" error={errors.date_posted}>
          <input
            type="date"
            className="doodle-input text-sm"
            value={form.date_posted ?? ''}
            max="9999-12-31"
            onChange={e => set('date_posted', e.target.value || null)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tags (comma-separated)">
            <input
              className="doodle-input text-sm"
              placeholder="e.g. Design, Remote, Full-time"
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Skills (comma-separated)" hint="Most important first — the assistant fills these in from the posting.">
            <input
              className="doodle-input text-sm"
              placeholder="e.g. Salesforce, Photoshop, Budget management"
              value={skillsText}
              onChange={e => setSkillsText(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              className="doodle-input text-sm"
              rows={8}
              placeholder="Paste or type the job description…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>
        </div>
      </div>
      {submitError && <p className="text-sm mt-3" style={{ color: '#E84393' }} role="alert">{submitError}</p>}
      <div className="flex flex-wrap gap-3 mt-5 justify-end">
        <button type="button" className="btn-doodle px-4 py-2 text-sm" style={MUTED_BTN} onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </button>
        <button type="submit" className="btn-doodle px-5 py-2.5 text-sm font-bold flex items-center gap-2" style={PRIMARY_BTN} disabled={saving}>
          {saving && <Spinner className="w-3 h-3" />}
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
