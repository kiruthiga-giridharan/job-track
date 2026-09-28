// Request handling for the `extract-job` Edge Function, written against
// injected dependencies so it can be unit-tested outside Deno.
import {
  FetchFailure,
  type JobDraft,
  MAX_TEXT_CHARS,
  describeHttpFailure,
  heuristicDraft,
  isPublicHost,
  mergeDrafts,
  parseWebUrl,
  readJobPage,
} from './extract.ts'

export interface ExtractRequest {
  url?: string
  description?: string
  applyUrl?: string
}

export type ExtractResponse =
  | { ok: true; draft: JobDraft; source: 'url' | 'text'; usedAi: boolean; warnings: string[] }
  | { ok: false; code: string; message: string }

export interface Deps {
  fetch: typeof fetch
  ai: ((text: string, hints: string, opts: { withDescription: boolean }) => Promise<{ draft: Partial<JobDraft>; refused: boolean }>) | null
}

const MAX_BYTES = 3_000_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 15_000

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    chunks.push(value)
    if (size > MAX_BYTES) {
      await reader.cancel()
      break
    }
  }
  const all = new Uint8Array(Math.min(size, MAX_BYTES + 65_536))
  let offset = 0
  for (const c of chunks) {
    const slice = c.subarray(0, all.length - offset)
    all.set(slice, offset)
    offset += slice.length
  }
  return new TextDecoder().decode(all.subarray(0, offset))
}

/** Fetches a public web page, re-validating every redirect hop. */
export async function fetchPage(rawUrl: string, doFetch: typeof fetch): Promise<{ html: string; finalUrl: URL }> {
  const first = parseWebUrl(rawUrl)
  if (!first) throw new FetchFailure('invalid_url', 'That doesn’t look like a valid http(s) link.')
  let url: URL = first
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHost(url.hostname)) {
      throw new FetchFailure('invalid_url', 'That link points to a private or local address, which can’t be fetched.')
    }
    let res: Response
    try {
      res = await doFetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KittuJobBoard/1.0; +personal job tracker)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en;q=0.9',
        },
      })
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      throw new FetchFailure(
        'fetch_failed',
        timedOut
          ? `${url.hostname} took too long to respond. Paste the description instead.`
          : `Couldn’t reach ${url.hostname} (${err instanceof Error ? err.message : 'network error'}). Check the link or paste the description instead.`,
      )
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      await res.body?.cancel()
      const next: URL | null = location ? parseWebUrl(new URL(location, url).toString()) : null
      if (!next) throw new FetchFailure('fetch_failed', `${url.hostname} redirected somewhere unexpected.`)
      url = next
      continue
    }
    if (!res.ok) {
      await res.body?.cancel()
      throw describeHttpFailure(res.status, url.hostname)
    }
    const type = res.headers.get('content-type') ?? ''
    if (type && !/html|xml|text\/plain/i.test(type)) {
      await res.body?.cancel()
      throw new FetchFailure('not_html', `That link returned ${type.split(';')[0]}, not a web page. If it’s a PDF, open it and paste the text instead.`)
    }
    return { html: await readLimited(res), finalUrl: url }
  }
  throw new FetchFailure('fetch_failed', 'Too many redirects.')
}

export async function handleExtract(body: ExtractRequest, deps: Deps): Promise<{ status: number; json: ExtractResponse }> {
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const pasted = typeof body.description === 'string' ? body.description.trim() : ''
  const applyUrlRaw = typeof body.applyUrl === 'string' ? body.applyUrl.trim() : ''
  const warnings: string[] = []

  if (applyUrlRaw && !parseWebUrl(applyUrlRaw)) {
    return { status: 400, json: { ok: false, code: 'invalid_apply_url', message: 'The application URL must be a full http(s) link.' } }
  }
  if (!url && !pasted) {
    return { status: 400, json: { ok: false, code: 'empty', message: 'Provide a job posting URL or paste a job description.' } }
  }

  let sourceText = pasted
  let structured: Partial<JobDraft> | null = null
  let heuristics: Partial<JobDraft> = {}
  let postingUrl = ''
  let hints = ''

  if (!pasted) {
    try {
      const { html, finalUrl } = await fetchPage(url, deps.fetch)
      const page = readJobPage(html, finalUrl.hostname)
      postingUrl = finalUrl.toString()
      structured = page.structured
      sourceText = [page.title, page.structured?.description, page.text].filter(Boolean).join('\n\n').slice(0, MAX_TEXT_CHARS)
      heuristics = heuristicDraft(page.text, { pageTitle: page.title, siteName: page.siteName })
      hints = `Page URL: ${postingUrl}`
    } catch (err) {
      if (err instanceof FetchFailure) {
        return { status: 422, json: { ok: false, code: err.code, message: err.message } }
      }
      throw err
    }
  } else {
    if (pasted.length > MAX_TEXT_CHARS) {
      warnings.push(`The pasted text was long, so only the first ${MAX_TEXT_CHARS.toLocaleString()} characters were analysed.`)
      sourceText = pasted.slice(0, MAX_TEXT_CHARS)
    }
    heuristics = heuristicDraft(sourceText)
    if (applyUrlRaw) hints = `Application URL: ${applyUrlRaw}`
  }

  let aiDraft: Partial<JobDraft> | null = null
  if (deps.ai) {
    try {
      // Pasted text and the page's structured data are already clean descriptions; only ask the
      // model to write one out (slow) when all we have is raw page text.
      const withDescription = !pasted && !structured?.description
      const result = await deps.ai(sourceText, hints, { withDescription })
      if (result.refused) warnings.push('The assistant couldn’t process this posting, so basic extraction was used. Please check every field.')
      else aiDraft = result.draft
    } catch (err) {
      console.error('AI extraction failed', err)
      warnings.push('The AI assistant is unavailable right now, so basic extraction was used. Please check every field.')
    }
  } else {
    warnings.push('AI extraction isn’t configured (no ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN on the server), so only basic extraction was used. Please check every field.')
  }

  // Priority: heuristics < AI < structured data from the page (most reliable) < explicit user input.
  const draft = mergeDrafts(heuristics, aiDraft, structured, {
    apply_url: applyUrlRaw || structured?.apply_url || postingUrl,
  })
  // Pasted descriptions: keep the user's own text if the model returned nothing useful.
  if (!draft.description && pasted) draft.description = pasted.slice(0, 100_000)
  if (!draft.apply_url) warnings.push('No application URL was found — add one before saving.')

  return { status: 200, json: { ok: true, draft, source: pasted ? 'text' : 'url', usedAi: !!aiDraft, warnings } }
}
