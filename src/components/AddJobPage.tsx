import { useEffect, useRef, useState } from 'react'
import { extractJob } from '../lib/api'
import { todayIso } from '../lib/jobs'
import type { ExtractedDraft, Job, JobInput } from '../lib/types'
import { applyUrlError, safeApplyUrl } from '../lib/url'
import { JobForm, blankJobInput } from './JobForm'
import { BackLink, DoodleStars, Notice, PRIMARY_BTN, SECONDARY_BTN, Spinner } from './ui'

type Mode = 'assistant' | 'manual'
type Source = 'url' | 'paste'

interface ChatMessage {
  role: 'user' | 'bot'
  content: string
  tone?: 'error'
}

// Failures where pasting the description is the right next step.
const PASTE_INSTEAD = new Set(['blocked', 'unreadable', 'fetch_failed', 'not_found', 'not_html'])

function draftToInput(d: ExtractedDraft): JobInput {
  return {
    title: d.title,
    company: d.company,
    location: d.location,
    description: d.description,
    apply_url: d.apply_url,
    date_added: todayIso(),
    date_posted: d.date_posted || null,
    salary: d.salary,
    tags: d.tags,
    skills: d.skills ?? [],
  }
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-3 fade-in">
        <div className="chat-bubble-user break-words">{msg.content}</div>
      </div>
    )
  }
  return (
    <div className="flex gap-2 mb-3 fade-in">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 mt-0.5 text-white"
        style={{ background: 'linear-gradient(135deg, #C8B4FA, #FFB3C6)' }}
        aria-hidden="true"
      >
        ✦
      </div>
      <div className="chat-bubble-bot" style={msg.tone === 'error' ? { borderColor: '#FFB3C6', background: '#FFF0F5', color: '#8A2E5C' } : undefined}>
        {msg.content}
      </div>
    </div>
  )
}

export function AddJobPage({
  jobs,
  onSave,
  onCancel,
}: {
  jobs: Job[]
  onSave: (input: JobInput) => Promise<void>
  onCancel: () => void
}) {
  const [mode, setMode] = useState<Mode>('assistant')
  const [source, setSource] = useState<Source>('url')
  const [postingUrl, setPostingUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [applyUrl, setApplyUrl] = useState('')
  const [inputError, setInputError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'bot',
      content:
        'Hi! 👋 Paste a job posting link, or paste the description plus the application link. I’ll suggest the details — you review and edit them before anything is saved.',
    },
  ])
  const [processing, setProcessing] = useState(false)
  const [failureCode, setFailureCode] = useState('')
  const [review, setReview] = useState<{ input: JobInput; warnings: string[]; usedAi: boolean; key: number } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, processing])

  function say(msg: ChatMessage) {
    setMessages(m => [...m, msg])
  }

  async function handleExtract() {
    setInputError('')
    setFailureCode('')
    let body: { url: string } | { description: string; applyUrl: string }
    if (source === 'url') {
      const err = applyUrlError(postingUrl)
      if (err) return setInputError(err === 'Application URL is required' ? 'Paste a job posting link' : err)
      body = { url: postingUrl.trim() }
      say({ role: 'user', content: `🔗 ${postingUrl.trim()}` })
    } else {
      if (pasted.trim().length < 40) return setInputError('Paste the full job description (at least a few sentences).')
      const err = applyUrlError(applyUrl)
      if (err) return setInputError(err)
      body = { description: pasted, applyUrl: applyUrl.trim() }
      say({ role: 'user', content: `📝 Pasted description (${pasted.trim().length.toLocaleString()} characters) + ${applyUrl.trim()}` })
    }

    setProcessing(true)
    try {
      const res = await extractJob(body)
      if (!res.ok) {
        setFailureCode(res.code)
        say({ role: 'bot', content: res.message, tone: 'error' })
        return
      }
      say({
        role: 'bot',
        content: res.usedAi
          ? '✦ Got it! I’ve filled in what I found. Please review and edit below — nothing is saved until you confirm.'
          : '✦ I pulled out what I could. Please check each field below — nothing is saved until you confirm.',
      })
      setReview({ input: draftToInput(res.draft), warnings: res.warnings, usedAi: res.usedAi, key: Date.now() })
    } finally {
      setProcessing(false)
    }
  }

  function switchToPaste() {
    setSource('paste')
    if (!applyUrl && safeApplyUrl(postingUrl)) setApplyUrl(postingUrl.trim())
    setFailureCode('')
    say({ role: 'bot', content: 'No problem — open the posting in your browser, copy the description, and paste it below. I’ve kept the link as the application URL (change it if the “Apply” page is different).' })
  }

  function duplicateBanner(form: JobInput) {
    const url = safeApplyUrl(form.apply_url)
    const dupe = url && jobs.find(j => safeApplyUrl(j.apply_url) === url)
    return dupe ? (
      <Notice tone="pink">
        Heads up: <strong>{dupe.title}</strong> at {dupe.company} already uses this application link. You can still save it.
      </Notice>
    ) : null
  }

  const modeBtn = (key: Mode, icon: string, label: string) => (
    <button
      key={key}
      onClick={() => setMode(key)}
      className="btn-doodle px-4 py-1.5 text-sm"
      aria-pressed={mode === key}
      style={{
        color: mode === key ? 'white' : '#9B87F5',
        borderColor: '#9B87F5',
        backgroundColor: mode === key ? '#9B87F5' : 'white',
        boxShadow: mode === key ? '2px 2px 0 #7C5CBF' : '3px 3px 0 #9B87F5',
      }}
    >
      {icon} {label}
    </button>
  )

  const sourceBtn = (key: Source, label: string) => (
    <button
      onClick={() => {
        setSource(key)
        setInputError('')
      }}
      className="text-sm font-semibold px-3 py-1.5 rounded-xl"
      aria-pressed={source === key}
      style={{ color: source === key ? '#9B87F5' : '#6B5B7B', background: source === key ? '#F5F0FF' : 'transparent' }}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-2xl mx-auto fade-in">
      <BackLink onClick={onCancel} />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-3xl font-bold" style={{ color: '#2D2233' }}>Add a Job</h1>
        <DoodleStars className="opacity-80" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {modeBtn('assistant', '✦', 'Add with assistant')}
        {modeBtn('manual', '✏️', 'Manual entry')}
      </div>

      {mode === 'manual' && (
        <JobForm
          initial={blankJobInput()}
          heading="Enter Job Details"
          submitLabel="Save Job ✓"
          onSubmit={onSave}
          onCancel={onCancel}
          banner={duplicateBanner}
        />
      )}

      {mode === 'assistant' && (
        <>
          <div className="doodle-card p-5 mb-4">
            <div className="mb-4 max-h-64 overflow-y-auto pr-1" aria-live="polite">
              {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
              {processing && (
                <div className="flex gap-2 mb-3 fade-in">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 text-white" style={{ background: 'linear-gradient(135deg, #C8B4FA, #FFB3C6)' }}>✦</div>
                  <div className="chat-bubble-bot flex items-center gap-1">
                    <Spinner />
                    <span className="text-sm ml-1" style={{ color: '#6B5B7B' }}>
                      {source === 'url' ? 'Reading the posting…' : 'Reading the description…'}
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {failureCode && PASTE_INSTEAD.has(failureCode) && source === 'url' && (
              <div className="mb-4">
                <Notice tone="pink">
                  <p className="mb-2">
                    <strong>Couldn’t read that page automatically.</strong> Some job sites block automated access or only show
                    postings after sign-in.
                  </p>
                  <button className="btn-doodle px-4 py-1.5 text-sm" style={SECONDARY_BTN} onClick={switchToPaste}>
                    📝 Paste the description instead
                  </button>
                </Notice>
              </div>
            )}

            <div className="border-t pt-4" style={{ borderColor: '#EAE0F4' }}>
              <div className="flex gap-1 mb-3" role="group" aria-label="Input type">
                {sourceBtn('url', '🔗 Job posting URL')}
                {sourceBtn('paste', '📝 Paste description')}
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  if (!processing) handleExtract()
                }}
              >
                {source === 'url' ? (
                  <input
                    className="doodle-input mb-3"
                    type="url"
                    placeholder="https://company.com/jobs/awesome-role"
                    aria-label="Job posting URL"
                    value={postingUrl}
                    onChange={e => setPostingUrl(e.target.value)}
                  />
                ) : (
                  <>
                    <textarea
                      className="doodle-input mb-2"
                      placeholder="Paste the full job description here…"
                      aria-label="Job description"
                      rows={7}
                      value={pasted}
                      onChange={e => setPasted(e.target.value)}
                    />
                    <input
                      className="doodle-input mb-3"
                      type="url"
                      placeholder="Application URL (the company’s apply page) *"
                      aria-label="Application URL"
                      value={applyUrl}
                      onChange={e => setApplyUrl(e.target.value)}
                    />
                  </>
                )}
                {inputError && <p className="text-xs mb-3" style={{ color: '#E84393' }} role="alert">{inputError}</p>}
                <div className="flex justify-end">
                  <button type="submit" className="btn-doodle px-5 py-2.5 text-sm font-bold flex items-center gap-2" style={PRIMARY_BTN} disabled={processing}>
                    {processing ? 'Extracting…' : review ? 'Extract again ✦' : 'Extract Details ✦'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {review && (
            <JobForm
              key={review.key}
              initial={review.input}
              heading="Review & Edit"
              submitLabel="Confirm & Save ✓"
              cancelLabel="Discard"
              onSubmit={onSave}
              onCancel={() => {
                setReview(null)
                say({ role: 'bot', content: 'Discarded — nothing was saved.' })
              }}
              banner={form => (
                <div className="grid gap-2">
                  {review.warnings.map(w => (
                    <Notice key={w} tone="pink">{w}</Notice>
                  ))}
                  <Notice>
                    <span style={{ color: '#7C5CBF' }}>✦</span> These are <strong>suggestions</strong>
                    {review.usedAi ? ' from the AI assistant' : ''}. Double-check the title, company and application link before saving.
                  </Notice>
                  {duplicateBanner(form)}
                </div>
              )}
            />
          )}
        </>
      )}
    </div>
  )
}
