import type { ReactNode } from 'react'
import { DoodleStars, Notice } from './ui'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#FDFBFF' }}>
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-6 relative">
          <img src="/logo.png" alt="" className="w-20 h-20 mx-auto mb-2" />
          <h1 className="font-display text-4xl font-bold" style={{ color: '#2D2233' }}>Kiruthiga's Job Board</h1>
          <p className="text-sm mt-1" style={{ color: '#6B5B7B' }}>Track every opportunity, together ✦</p>
          <DoodleStars className="absolute -top-4 right-0 pointer-events-none hidden sm:block" />
        </div>
        <div className="doodle-card p-6">{children}</div>
      </div>
    </div>
  )
}

export function SetupScreen() {
  return (
    <Shell>
      <h2 className="font-display text-2xl font-bold mb-2" style={{ color: '#7C5CBF' }}>Almost there!</h2>
      <p className="text-sm mb-4" style={{ color: '#6B5B7B' }}>
        The app isn’t connected to a database yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase project URL and anon key, then restart <code>pnpm dev</code>.
      </p>
      <Notice>See <strong>README.md → Setup</strong> for the full walkthrough.</Notice>
    </Shell>
  )
}
