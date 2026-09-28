import { useEffect, useRef, useState } from 'react'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** Notes textarea that autosaves (debounced) and on blur, showing save status. */
export function NotesField({
  value,
  onSave,
  rows = 3,
  autoFocus,
}: {
  value: string
  onSave: (notes: string) => Promise<unknown>
  rows?: number
  autoFocus?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastSaved = useRef(value)
  const pending = useRef<string | null>(null)

  // Accept remote changes (e.g. a collaborator's edit) unless you're mid-edit.
  useEffect(() => {
    if (state === 'idle' || state === 'saved') {
      setDraft(value)
      lastSaved.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  async function save(text: string) {
    clearTimeout(timer.current)
    if (text === lastSaved.current) {
      setState(s => (s === 'dirty' ? 'idle' : s))
      return
    }
    pending.current = text
    setState('saving')
    try {
      await onSave(text)
      lastSaved.current = text
      if (pending.current === text) setState('saved')
    } catch {
      setState('error')
    }
  }

  // Flush unsaved text when the field unmounts (e.g. navigating away).
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (draftRef.current !== lastSaved.current) onSave(draftRef.current).catch(() => {})
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const label =
    state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : state === 'error' ? 'Couldn’t save — click to retry' : state === 'dirty' ? 'Unsaved…' : ''

  return (
    <div>
      <textarea
        className="doodle-input text-sm"
        placeholder="Which résumé did you use? Contacts, deadlines, interview notes…"
        rows={rows}
        value={draft}
        maxLength={20000}
        autoFocus={autoFocus}
        aria-label="Notes"
        onChange={e => {
          const text = e.target.value
          setDraft(text)
          setState('dirty')
          clearTimeout(timer.current)
          timer.current = setTimeout(() => save(text), 900)
        }}
        onBlur={() => save(draft)}
      />
      <div className="h-4 mt-1 text-xs text-right" aria-live="polite">
        {state === 'error' ? (
          <button className="underline" style={{ color: '#E84393' }} onClick={() => save(draft)}>{label}</button>
        ) : (
          <span style={{ color: state === 'saved' ? '#7C5CBF' : '#A899B5' }}>{label}</span>
        )}
      </div>
    </div>
  )
}
