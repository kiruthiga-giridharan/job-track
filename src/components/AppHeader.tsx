import type { Route } from '../hooks/useHashRoute'

export function AppHeader({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const navBtn = (active: boolean) => ({
    color: active ? '#9B87F5' : '#6B5B7B',
    background: active ? '#F5F0FF' : 'transparent',
  })
  const onJobs = route.name === 'jobs' || route.name === 'job' || route.name === 'edit'

  return (
    <header
      className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3"
      style={{ background: 'rgba(253,251,255,0.95)', borderBottom: '2px solid #EAE0F4', backdropFilter: 'blur(8px)' }}
    >
      <button onClick={() => navigate({ name: 'jobs' })} className="flex items-center gap-2">
        <img src="/logo.png" alt="" className="w-9 h-9" />
        <span className="font-display text-xl font-bold" style={{ color: '#9B87F5' }}>Kiruthiga's Job Board</span>
      </button>
      <nav className="flex items-center gap-1 sm:gap-2">
        <button onClick={() => navigate({ name: 'jobs' })} className="text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors" style={navBtn(onJobs)}>
          Jobs
        </button>
        <button onClick={() => navigate({ name: 'add' })} className="text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors" style={navBtn(route.name === 'add')}>
          + Add
        </button>
      </nav>
    </header>
  )
}
