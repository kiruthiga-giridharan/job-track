// Pure, dependency-free helpers for turning a job posting (URL or pasted text)
// into suggested job fields. Shared by the `extract-job` Edge Function (Deno)
// and the unit tests (Node/Vitest).

export interface JobDraft {
  title: string
  company: string
  location: string
  description: string
  apply_url: string
  date_posted: string // YYYY-MM-DD or ''
  salary: string
  tags: string[]
}

export type FetchFailureCode = 'invalid_url' | 'blocked' | 'not_found' | 'fetch_failed' | 'unreadable' | 'not_html'

export class FetchFailure extends Error {
  constructor(
    public code: FetchFailureCode,
    message: string,
  ) {
    super(message)
  }
}

export const MAX_TEXT_CHARS = 60_000

export function emptyDraft(): JobDraft {
  return { title: '', company: '', location: '', description: '', apply_url: '', date_posted: '', salary: '', tags: [] }
}

// ─── URL safety ──────────────────────────────────────────────────────────────

/** Returns a normalised http(s) URL or null. Rejects credentials, non-web schemes and bare hosts. */
export function parseWebUrl(raw: string): URL | null {
  const value = raw.trim()
  if (!value || value.length > 2048) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  const host = url.hostname
  if (!host || (!host.includes('.') && !host.startsWith('['))) return null
  return url
}

/** Blocks obvious internal targets so the scraper can't be used to probe private networks (SSRF). */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127 || a === 0) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a >= 224) return false
    return true
  }
  if (host.includes(':')) {
    // IPv6 literal
    if (host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return false
    if (host.startsWith('::ffff:')) return isPublicHost(host.slice(7))
  }
  return true
}

// ─── HTML → text ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol|tr|table|header)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return decodeEntities(m[1]).trim()
  }
  return ''
}

// ─── Bot walls / blocked pages ───────────────────────────────────────────────

const BLOCK_MARKERS = [
  /cf-browser-verification|cf_chl_|challenge-platform/i,
  /<title>\s*(just a moment|attention required|access denied|security check)/i,
  /verify (that )?you are (a )?human/i,
  /captcha/i,
  /are you a robot/i,
  /request unsuccessful\. incapsula/i,
  /perimeterx|px-captcha/i,
  /authwall|sign in to (view|see) (this|the) job/i,
]

export function looksBlocked(html: string): boolean {
  // Only inspect the start of the document: real postings may mention "captcha" deep in scripts.
  const head = html.slice(0, 20_000)
  return BLOCK_MARKERS.some(re => re.test(head))
}

export function describeHttpFailure(status: number, host: string): FetchFailure {
  if (status === 401 || status === 403 || status === 429 || status === 451 || status === 999) {
    return new FetchFailure(
      'blocked',
      `${host} blocked the request (HTTP ${status}). Many job sites (e.g. LinkedIn, Indeed) refuse automated access. Open the posting in your browser, copy the description, and paste it instead.`,
    )
  }
  if (status === 404 || status === 410) {
    return new FetchFailure('not_found', `${host} says this page doesn't exist (HTTP ${status}). The posting may have been taken down — check the link.`)
  }
  return new FetchFailure('fetch_failed', `${host} returned an error (HTTP ${status}). Try again later, or paste the description instead.`)
}

// ─── schema.org JobPosting (JSON-LD) ─────────────────────────────────────────

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

function findJobPosting(node: Json): Record<string, Json> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findJobPosting(n)
      if (hit) return hit
    }
    return null
  }
  const type = node['@type']
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node
  for (const key of ['@graph', 'mainEntity', 'itemListElement']) {
    const hit = findJobPosting(node[key] ?? null)
    if (hit) return hit
  }
  return null
}

function str(v: Json | undefined): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return ''
}

function formatLocation(loc: Json | undefined): string {
  const places = Array.isArray(loc) ? loc : loc ? [loc] : []
  const parts = places
    .map(p => {
      if (!p || typeof p !== 'object' || Array.isArray(p)) return str(p as Json)
      const addr = (p.address ?? p) as Json
      if (!addr || typeof addr !== 'object' || Array.isArray(addr)) return str(addr)
      return [str(addr.addressLocality), str(addr.addressRegion), str(addr.addressCountry as Json)]
        .filter(Boolean)
        .join(', ')
    })
    .filter(Boolean)
  return [...new Set(parts)].join(' / ')
}

function formatSalary(base: Json | undefined): string {
  if (!base || typeof base !== 'object' || Array.isArray(base)) return str(base)
  const currency = str(base.currency)
  const value = base.value
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const min = str(value.minValue)
    const max = str(value.maxValue)
    const single = str(value.value)
    const unit = str(value.unitText).toLowerCase()
    const range = min && max ? `${min}–${max}` : min || max || single
    if (!range) return ''
    return [currency, range, unit ? `per ${unit}` : ''].filter(Boolean).join(' ')
  }
  return [currency, str(value)].filter(Boolean).join(' ')
}

/** Reads schema.org JobPosting structured data that many ATSs (Greenhouse, Lever, Workday…) embed. */
export function extractJsonLdJob(html: string): Partial<JobDraft> | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, raw] of blocks) {
    let parsed: Json
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      continue
    }
    const job = findJobPosting(parsed)
    if (!job) continue
    const org = job.hiringOrganization
    const company = org && typeof org === 'object' && !Array.isArray(org) ? str(org.name) : str(org)
    const remote = str(job.jobLocationType).toUpperCase() === 'TELECOMMUTE'
    let location = formatLocation(job.jobLocation)
    if (remote) location = location ? `Remote · ${location}` : 'Remote'
    const employment = Array.isArray(job.employmentType) ? job.employmentType.map(str) : [str(job.employmentType)]
    const tags = [
      ...(remote ? ['Remote'] : []),
      ...employment.filter(Boolean).map(e => e.replace(/_/g, '-').toLowerCase().replace(/^\w/, c => c.toUpperCase())),
    ]
    const datePosted = str(job.datePosted).slice(0, 10)
    return {
      title: decodeEntities(str(job.title)),
      company: decodeEntities(company),
      location,
      description: htmlToText(decodeEntities(str(job.description))),
      date_posted: /^\d{4}-\d{2}-\d{2}$/.test(datePosted) ? datePosted : '',
      salary: formatSalary(job.baseSalary),
      tags,
      apply_url: str(job.url),
    }
  }
  return null
}

// ─── Page → source text ──────────────────────────────────────────────────────

export interface PageContent {
  text: string
  structured: Partial<JobDraft> | null
  title: string
  siteName: string
}

/** Extracts readable content from a fetched HTML page; throws FetchFailure if it's a bot wall or empty shell. */
export function readJobPage(html: string, host: string): PageContent {
  const structured = extractJsonLdJob(html)
  if (!structured && looksBlocked(html)) {
    throw new FetchFailure(
      'blocked',
      `${host} showed a bot check (CAPTCHA / "verify you're human") instead of the job posting, so it can't be read automatically. Paste the description instead.`,
    )
  }
  const title = metaContent(html, 'og:title') || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
  const siteName = metaContent(html, 'og:site_name')
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html
  const text = htmlToText(main).slice(0, MAX_TEXT_CHARS)
  const usefulText = (structured?.description?.length ?? 0) + text.length
  if (!structured?.title && usefulText < 200) {
    throw new FetchFailure(
      'unreadable',
      `${host} didn't return readable job details — the page probably loads its content with JavaScript or requires sign-in. Paste the description instead.`,
    )
  }
  return { text, structured, title, siteName }
}

// ─── Fallback (no AI) heuristics ─────────────────────────────────────────────

// "Label: value" or "Label – value" lines; values must be short so sentences aren't mistaken for fields.
const SEP = String.raw`\s*(?::|\s[-–]\s)\s*`
const LABELS: { key: 'title' | 'company' | 'location' | 'salary'; re: RegExp }[] = [
  { key: 'title', re: new RegExp(`^(?:job\\s*title|title|position|role)${SEP}(.{2,120})$`, 'im') },
  { key: 'company', re: new RegExp(`^(?:company|employer|organi[sz]ation)${SEP}(.{2,120})$`, 'im') },
  { key: 'location', re: new RegExp(`^(?:location|based in|office)${SEP}(.{2,100})$`, 'im') },
  { key: 'salary', re: new RegExp(`^(?:salary|compensation|pay(?:\\s*range)?)${SEP}(.{2,100})$`, 'im') },
]

/** Best-effort extraction without an LLM: labelled lines, page title, and simple patterns. */
export function heuristicDraft(text: string, hints: { pageTitle?: string; siteName?: string } = {}): Partial<JobDraft> {
  const draft: Partial<JobDraft> = {}
  for (const { key, re } of LABELS) {
    const m = text.match(re)
    if (m) draft[key] = m[1].trim().slice(0, 200)
  }
  if (!draft.title && hints.pageTitle) {
    // "Senior Designer - Bloom Studio | Careers" → title + company guess
    const [first, second] = hints.pageTitle.split(/\s+[|\-–—@]\s+|\s+at\s+/i).map(s => s.trim())
    draft.title = first
    if (!draft.company && second && !/careers|jobs|job board/i.test(second)) draft.company = second
  }
  if (!draft.title) {
    const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 3 && l.length < 120)
    if (firstLine) draft.title = firstLine.replace(/^•\s*/, '')
  }
  if (!draft.company && hints.siteName) draft.company = hints.siteName
  if (!draft.salary) {
    const money = text.match(/[$£€]\s?\d[\d,.]*\s?[kK]?\s?(?:[-–to]+\s?[$£€]?\s?\d[\d,.]*\s?[kK]?)?/)
    if (money) draft.salary = money[0].trim()
  }
  const tags: string[] = []
  if (/\bremote\b/i.test(text)) tags.push('Remote')
  if (/\bhybrid\b/i.test(text)) tags.push('Hybrid')
  if (/\bfull[- ]time\b/i.test(text)) tags.push('Full-time')
  if (/\bpart[- ]time\b/i.test(text)) tags.push('Part-time')
  if (/\bcontract\b/i.test(text)) tags.push('Contract')
  draft.tags = tags
  draft.description = text.slice(0, 20_000)
  return draft
}

// ─── Merge / normalise ───────────────────────────────────────────────────────

function cleanDate(v: string | undefined): string {
  if (!v) return ''
  const d = v.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : ''
}

/** Layers sources left-to-right (later non-empty values win) and returns a clean, bounded draft. */
export function mergeDrafts(...sources: (Partial<JobDraft> | null | undefined)[]): JobDraft {
  const out = emptyDraft()
  for (const s of sources) {
    if (!s) continue
    for (const key of ['title', 'company', 'location', 'description', 'apply_url', 'salary'] as const) {
      const v = s[key]
      if (typeof v === 'string' && v.trim()) out[key] = v.trim()
    }
    if (s.date_posted && cleanDate(s.date_posted)) out.date_posted = cleanDate(s.date_posted)
    if (Array.isArray(s.tags) && s.tags.length) out.tags = s.tags
  }
  out.title = out.title.slice(0, 300)
  out.company = out.company.slice(0, 300)
  out.location = out.location.slice(0, 300)
  out.salary = out.salary.slice(0, 200)
  out.description = out.description.slice(0, 100_000)
  out.tags = [...new Set(out.tags.map(t => t.trim()).filter(t => t && t.length <= 40))].slice(0, 8)
  if (out.apply_url && !parseWebUrl(out.apply_url)) out.apply_url = ''
  return out
}
