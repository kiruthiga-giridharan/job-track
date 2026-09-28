// Supabase Edge Function: POST /functions/v1/extract-job
// Body: { url } or { description, applyUrl }. Open to anyone with the app's anon key (no sign-in).
import { extractWithClaude } from '../_shared/ai.ts'
import { handleExtract } from '../_shared/handler.ts'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map(s => s.trim())

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = allowedOrigins.includes('*') ? '*' : origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async req => {
  const cors = corsHeaders(req.headers.get('origin'))
  const reply = (status: number, json: unknown) =>
    new Response(JSON.stringify(json), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { ok: false, code: 'method', message: 'Use POST.' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return reply(400, { ok: false, code: 'bad_json', message: 'Request body must be JSON.' })
  }

  // Either an Anthropic API key, or a Bearer token for an Anthropic-compatible gateway.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || undefined
  const authToken = Deno.env.get('ANTHROPIC_AUTH_TOKEN') || undefined
  const baseURL = Deno.env.get('ANTHROPIC_BASE_URL') || undefined
  const model = Deno.env.get('ANTHROPIC_MODEL') || undefined

  try {
    const { status, json } = await handleExtract((body ?? {}) as Record<string, string>, {
      fetch,
      ai: apiKey || authToken ? (text, hints, { withDescription }) => extractWithClaude(text, { apiKey, authToken, baseURL, model, hints, withDescription }) : null,
    })
    return reply(status, json)
  } catch (err) {
    console.error('extract-job failed', err)
    return reply(500, { ok: false, code: 'server_error', message: 'Something went wrong while extracting. Try again or add the job manually.' })
  }
})
