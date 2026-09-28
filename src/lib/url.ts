// Same rules the server uses, so the Apply button and forms agree with the extractor.
import { parseWebUrl } from '../../supabase/functions/_shared/extract.ts'

export { parseWebUrl }

/** Returns the normalised URL to open for "Apply", or null if it isn't a safe http(s) link. */
export function safeApplyUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  return parseWebUrl(raw)?.toString() ?? null
}

export function applyUrlError(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Application URL is required'
  if (!/^https?:\/\//i.test(value)) return 'Start the link with https://'
  if (!parseWebUrl(value)) return 'That isn’t a valid web address'
  return null
}

export function hostOf(raw: string): string {
  return parseWebUrl(raw)?.hostname.replace(/^www\./, '') ?? ''
}
