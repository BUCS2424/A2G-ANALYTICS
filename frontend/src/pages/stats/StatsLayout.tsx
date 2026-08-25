import { LayoutDashboard, MapPin, MonitorSmartphone, MousePointerClick, Share2, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink, Outlet, useParams, useSearchParams } from 'react-router-dom'
import DateRangePicker from '../../components/DateRangePicker'
import NavDropdown from '../../components/NavDropdown'
import { DIMENSIONS, NAV_GROUPS, unlockStats } from '../../api/stats'
import PasswordGate from './PasswordGate'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const GROUP_ICONS: Record<(typeof NAV_GROUPS)[number], ReactNode> = {
  Behavior: <MousePointerClick size={15} />,
  Acquisitions: <Share2 size={15} />,
  Geographic: <MapPin size={15} />,
  Technology: <MonitorSmartphone size={15} />,
}

export default function StatsLayout() {
  const { domain } = useParams<{ domain: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [locked, setLocked] = useState(false)

  const from = searchParams.get('from') ?? isoDaysAgo(30)
  const to = searchParams.get('to') ?? isoDaysAgo(0)

  function updateRange(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(searchParams)
    next.set('from', nextFrom)
    next.set('to', nextTo)
    setSearchParams(next)
  }

  async function handleUnlock(password: string) {
    await unlockStats(domain!, password)
    setLocked(false)
    window.location.reload()
  }

  if (locked) {
    return <PasswordGate onUnlock={handleUnlock} />
  }

  return (
    <div className="stats-page">
      <header className="stats-header">
        <div>
          <h1>{domain}</h1>
        </div>
        <DateRangePicker from={from} to={to} onChange={updateRange} />
      </header>

      <nav className="stats-nav">
        <NavLink to="realtime" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="live-dot" /> Realtime
        </NavLink>
        <NavLink to="overview" className={({ isActive }) => (isActive ? 'active' : '')}>
          <LayoutDashboard size={15} /> Overview
        </NavLink>
        {NAV_GROUPS.map((group) => (
          <NavDropdown
            key={group}
            icon={GROUP_ICONS[group]}
            label={group}
            items={DIMENSIONS.filter((d) => d.group === group).map((d) => ({ key: d.key, label: d.label }))}
          />
        ))}
        <NavLink to="events" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Zap size={15} /> Events
        </NavLink>
      </nav>

      <main className="stats-content">
        <Outlet context={{ domain: domain!, from, to, onLocked: () => setLocked(true) }} />
      </main>
    </div>
  )
}
