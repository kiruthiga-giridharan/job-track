import { useCallback, useEffect, useState } from 'react'

export type Route =
  | { name: 'jobs' }
  | { name: 'add' }
  | { name: 'job'; id: string }
  | { name: 'edit'; id: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [a, b, c] = path.split('/')
  if (a === 'add') return { name: 'add' }
  if (a === 'job' && b) return c === 'edit' ? { name: 'edit', id: b } : { name: 'job', id: b }
  return { name: 'jobs' }
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'add':
      return '#/add'
    case 'job':
      return `#/job/${r.id}`
    case 'edit':
      return `#/job/${r.id}/edit`
    default:
      return '#/'
  }
}

/** Tiny hash router so refresh and the browser Back button keep your place. */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((r: Route) => {
    const next = routeToHash(r)
    if (window.location.hash !== next) window.location.hash = next
  }, [])

  return { route, navigate }
}
