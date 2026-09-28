import { describe, expect, it, vi } from 'vitest'
import {
  extractJsonLdJob,
  heuristicDraft,
  htmlToText,
  isPublicHost,
  looksBlocked,
  mergeDrafts,
  parseWebUrl,
  readJobPage,
} from '../supabase/functions/_shared/extract'
import { handleExtract } from '../supabase/functions/_shared/handler'

const JSON_LD_PAGE = `<!doctype html><html><head><title>Senior Designer - Bloom | Careers</title>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: 'Bloom' },
    {
      '@type': 'JobPosting',
      title: 'Senior Product Designer',
      hiringOrganization: { '@type': 'Organization', name: 'Bloom Studio' },
      jobLocationType: 'TELECOMMUTE',
      jobLocation: { '@type': 'Place', address: { addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' } },
      description: '<p>Lead product design &amp; research.</p><ul><li>Figma</li><li>Prototyping</li></ul>',
      datePosted: '2026-09-20T10:00:00Z',
      employmentType: 'FULL_TIME',
      baseSalary: { '@type': 'MonetaryAmount', currency: 'USD', value: { minValue: 130000, maxValue: 160000, unitText: 'YEAR' } },
      url: 'https://jobs.bloom.example/123',
    },
  ],
})}</script></head><body><main><h1>Senior Product Designer</h1><p>Some body text.</p></main></body></html>`

function htmlResponse(html: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } })
}

describe('URL validation', () => {
  it('accepts http(s) links and rejects everything else', () => {
    expect(parseWebUrl('https://boards.greenhouse.io/acme/jobs/1')?.hostname).toBe('boards.greenhouse.io')
    expect(parseWebUrl('  http://example.com/x ')).not.toBeNull()
    for (const bad of ['javascript:alert(1)', 'ftp://example.com', 'example.com/jobs', 'https://user:pw@example.com', 'https://intranet/', '']) {
      expect(parseWebUrl(bad)).toBeNull()
    }
  })

  it('blocks private and local hosts (SSRF guard)', () => {
    for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.1', '172.20.0.1', '169.254.169.254', '[::1]', 'db.internal']) {
      expect(isPublicHost(host)).toBe(false)
    }
    expect(isPublicHost('jobs.lever.co')).toBe(true)
    expect(isPublicHost('8.8.8.8')).toBe(true)
  })
})

describe('page parsing', () => {
  it('reads schema.org JobPosting data', () => {
    const job = extractJsonLdJob(JSON_LD_PAGE)!
    expect(job).toMatchObject({
      title: 'Senior Product Designer',
      company: 'Bloom Studio',
      location: 'Remote · Austin, TX, US',
      date_posted: '2026-09-20',
      salary: 'USD 130000–160000 per year',
      apply_url: 'https://jobs.bloom.example/123',
    })
    expect(job.tags).toEqual(['Remote', 'Full-time'])
    expect(job.description).toContain('Lead product design & research.')
    expect(job.description).toContain('• Figma')
  })

  it('converts HTML to readable text without scripts', () => {
    expect(htmlToText('<p>Hello&nbsp;<b>world</b></p><script>evil()</script><p>Line&#39;2</p>')).toBe("Hello world\nLine'2")
  })

  it('detects bot walls and JavaScript-only shells', () => {
    const cf = '<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>'
    expect(looksBlocked(cf)).toBe(true)
    expect(() => readJobPage(cf, 'example.com')).toThrow(/bot check/)
    expect(() => readJobPage('<html><body><div id="root"></div></body></html>', 'example.com')).toThrow(/JavaScript/)
  })

  it('falls back to simple heuristics without AI', () => {
    const d = heuristicDraft('Job Title: Backend Engineer\nCompany: Quill\nLocation: Remote · EU\nSalary: €80k–€95k\nFull-time role, hybrid possible.')
    expect(d).toMatchObject({ title: 'Backend Engineer', company: 'Quill', location: 'Remote · EU', salary: '€80k–€95k' })
    expect(d.tags).toEqual(['Remote', 'Hybrid', 'Full-time'])
  })

  it('does not mistake sentences for labelled fields', () => {
    const d = heuristicDraft('Fellows Program\nLocation-based hybrid policy: Currently, we expect all staff to be in one of our offices at least 25% of the time.')
    expect(d.location).toBeUndefined()
  })

  it('merges sources, later non-empty values winning, and drops invalid URLs', () => {
    const d = mergeDrafts({ title: 'A', company: 'X', apply_url: 'nope' }, { title: '', company: 'Y', date_posted: '2026-13-45' })
    expect(d).toMatchObject({ title: 'A', company: 'Y', apply_url: '', date_posted: '' })
  })
})

describe('handleExtract', () => {
  it('extracts from a URL, preferring structured data, and never auto-fills from untrusted AI URLs', async () => {
    const fetchMock = vi.fn(async () => htmlResponse(JSON_LD_PAGE))
    const ai = vi.fn(async () => ({ draft: { title: 'Wrong title', location: 'Austin', description: 'AI summary' }, refused: false }))
    const res = await handleExtract({ url: 'https://jobs.bloom.example/123' }, { fetch: fetchMock as unknown as typeof fetch, ai })
    expect(res.status).toBe(200)
    if (!res.json.ok) throw new Error('expected ok')
    expect(res.json.usedAi).toBe(true)
    expect(res.json.draft.title).toBe('Senior Product Designer')
    expect(res.json.draft.apply_url).toBe('https://jobs.bloom.example/123')
  })

  it('explains when a site blocks access', async () => {
    const fetchMock = vi.fn(async () => htmlResponse('Forbidden', 403))
    const res = await handleExtract({ url: 'https://www.linkedin.com/jobs/view/1' }, { fetch: fetchMock as unknown as typeof fetch, ai: null })
    expect(res.status).toBe(422)
    expect(res.json).toMatchObject({ ok: false, code: 'blocked' })
    if (!res.json.ok) expect(res.json.message).toMatch(/paste it instead/i)
  })

  it('re-checks redirects so they cannot reach internal hosts', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }))
    const res = await handleExtract({ url: 'https://evil.example/r' }, { fetch: fetchMock as unknown as typeof fetch, ai: null })
    expect(res.json).toMatchObject({ ok: false, code: 'invalid_url' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses pasted text with the provided application URL, warning when AI is off', async () => {
    const res = await handleExtract(
      { description: 'Job Title: Data Analyst\nCompany: Fern Co.\nWe need SQL skills.', applyUrl: 'https://fern.example/apply' },
      { fetch: vi.fn(), ai: null },
    )
    if (!res.json.ok) throw new Error('expected ok')
    expect(res.json.draft).toMatchObject({ title: 'Data Analyst', company: 'Fern Co.', apply_url: 'https://fern.example/apply' })
    expect(res.json.warnings.join(' ')).toMatch(/ANTHROPIC_API_KEY/)
  })

  it('rejects an invalid application URL', async () => {
    const res = await handleExtract({ description: 'text', applyUrl: 'javascript:alert(1)' }, { fetch: vi.fn(), ai: null })
    expect(res.status).toBe(400)
  })

  it('degrades gracefully when the AI call throws', async () => {
    const ai = vi.fn(async () => {
      throw new Error('rate limited')
    })
    const res = await handleExtract({ description: 'Title: QA Lead\nCompany: Petal', applyUrl: 'https://petal.example/a' }, { fetch: vi.fn(), ai })
    if (!res.json.ok) throw new Error('expected ok')
    expect(res.json.usedAi).toBe(false)
    expect(res.json.draft.title).toBe('QA Lead')
  })
})
