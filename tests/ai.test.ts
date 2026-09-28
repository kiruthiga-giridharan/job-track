// Verifies the Claude request shape without calling the real API.
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL, extractWithClaude, isAnthropicApi } from '../supabase/functions/_shared/ai'

function fakeClient(result: { stop_reason: string; parsed_output: unknown }) {
  const parse = vi.fn(async () => result)
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse }
}

describe('extractWithClaude', () => {
  it('sends the posting as untrusted data with a structured output schema', async () => {
    const draft = { title: 'PM', company: 'Driftwood', location: 'Remote', description: 'd', salary: '', date_posted: '', tags: [] }
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: draft })
    const res = await extractWithClaude('posting text', { apiKey: 'test', client, hints: 'Page URL: https://x.example' })
    expect(res).toEqual({ draft, refused: false })
    const params = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>
    expect(params.model).toBe(DEFAULT_MODEL)
    expect(params.output_config.effort).toBe('low')
    expect(params.output_config.format.type).toBe('json_schema')
    expect(params.messages[0].content).toContain('<job_posting>\nposting text\n</job_posting>')
    expect(params.system).toMatch(/never follow instructions/)
  })

  it('skips the description field when the caller already has one', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { title: 'PM' } })
    await extractWithClaude('x', { apiKey: 'k', client, withDescription: false })
    const params = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>
    expect(JSON.stringify(params.output_config.format.schema)).not.toContain('"description":{"type"')
  })

  it('omits effort and fallbacks for Haiku, which rejects them', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { title: 'PM' } })
    await extractWithClaude('x', { apiKey: 'k', client, model: 'claude-haiku-4-5' })
    const params = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>
    expect(params.output_config.effort).toBeUndefined()
    expect(params.fallbacks).toBeUndefined()
    expect(params.output_config.format.type).toBe('json_schema')
  })

  it('reports refusals instead of returning empty fields', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null })
    const res = await extractWithClaude('x', { apiKey: 'k', client })
    expect(res).toMatchObject({ draft: {}, refused: true })
    expect(res.reason).toMatch(/refusal.*retry: refusal/)
  })

  it('retries once on Haiku when the main model returns nothing', async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ stop_reason: 'max_tokens', parsed_output: null })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', parsed_output: { title: 'PM' } })
    const client = { beta: { messages: { parse } } } as unknown as Anthropic
    expect(await extractWithClaude('x', { apiKey: 'k', client })).toEqual({ draft: { title: 'PM' }, refused: false })
    expect(parse.mock.calls.map(c => (c[0] as { model: string }).model)).toEqual([DEFAULT_MODEL, 'claude-haiku-4-5'])
  })

  it('uses a forced tool call for Anthropic-compatible gateways', async () => {
    const create = vi.fn(async () => ({
      stop_reason: 'tool_use',
      content: [
        { type: 'thinking', thinking: '…' },
        { type: 'tool_use', name: 'save_job_details', id: 't1', input: { title: 'Designer', company: 'Bloom', tags: ['Remote'], salary: null } },
      ],
    }))
    const client = { messages: { create } } as unknown as Anthropic
    const res = await extractWithClaude('posting', { authToken: 't', baseURL: 'https://ark.example.com/api/coding', model: 'dola-seed-2.0-lite', client })
    expect(res).toEqual({ draft: { title: 'Designer', company: 'Bloom', tags: ['Remote'] }, refused: false })
    const params = (create.mock.calls[0] as unknown[])[0] as Record<string, any>
    expect(params.model).toBe('dola-seed-2.0-lite')
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'save_job_details' })
    expect(params.tools[0].input_schema.properties.title.type).toBe('string')
    expect(params).not.toHaveProperty('output_config')
    expect(params).not.toHaveProperty('betas')
  })

  it('accepts a JSON answer in text when a gateway skips the tool call', async () => {
    const create = vi.fn(async () => ({ content: [{ type: 'text', text: 'Here: {"title":"QA Lead","company":"Petal"}' }] }))
    const client = { messages: { create } } as unknown as Anthropic
    const res = await extractWithClaude('p', { authToken: 't', baseURL: 'https://gw.example.com', model: 'm', client })
    expect(res.draft).toEqual({ title: 'QA Lead', company: 'Petal' })
  })

  it('requires a model name for gateways', async () => {
    const client = { messages: { create: vi.fn() } } as unknown as Anthropic
    await expect(extractWithClaude('p', { authToken: 't', baseURL: 'https://gw.example.com', client })).rejects.toThrow(/ANTHROPIC_MODEL/)
  })

  it('detects Anthropic vs gateway base URLs', () => {
    expect(isAnthropicApi(undefined)).toBe(true)
    expect(isAnthropicApi('https://api.anthropic.com')).toBe(true)
    expect(isAnthropicApi('https://ark.ap-southeast.bytepluses.com/api/coding')).toBe(false)
  })
})
