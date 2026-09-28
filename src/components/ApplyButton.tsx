import { hostOf, safeApplyUrl } from '../lib/url'

/**
 * Opens the company's application page in a new tab. It never changes the
 * job's Applied status — that's only done with the Applied toggle.
 */
export function ApplyButton({ url, size = 'sm' }: { url: string; size?: 'sm' | 'md' }) {
  const href = safeApplyUrl(url)
  const pad = size === 'md' ? 'px-5 py-2.5' : 'px-4 py-1.5'
  if (!href) {
    return (
      <span
        className={`btn-doodle ${pad} text-sm whitespace-nowrap opacity-60 cursor-not-allowed inline-block`}
        style={{ color: '#E84393', borderColor: '#FFB3C6', boxShadow: 'none' }}
        title="This job's application link is missing or invalid — edit the job to fix it."
        aria-disabled="true"
      >
        ⚠ Invalid link
      </span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className={`btn-doodle ${pad} text-sm whitespace-nowrap inline-block`}
      style={{ color: '#9B87F5', borderColor: '#9B87F5', textDecoration: 'none' }}
      title={`Opens ${hostOf(href)} in a new tab`}
    >
      Apply →
    </a>
  )
}
