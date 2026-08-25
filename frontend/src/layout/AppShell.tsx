import { LayoutGrid, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { faviconUrl, fetchWebsites, type Website } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'

export default function AppShell() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { domain: activeDomain } = useParams<{ domain?: string }>()
  const [websites, setWebsites] = useState<Website[]>([])

  useEffect(() => {
    fetchWebsites().then(setWebsites)
  }, [activeDomain])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">A2G</span>
          <span className="brand-name">Web Analytics</span>
        </div>

        <div className="sidebar-menu-label">
          <span>MENU</span>
          <button className="theme-toggle" onClick={toggle} title="Toggle light/dark theme" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>

        <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link dashboard-link${isActive ? ' active' : ''}`}>
          <span className="sidebar-icon">
            <LayoutGrid size={16} />
          </span>
          Dashboard
        </NavLink>

        {user?.role === 1 && (
          <NavLink to="/admin" className="sidebar-link">
            <span className="sidebar-icon">
              <Settings size={16} />
            </span>
            Admin
          </NavLink>
        )}

        <div className="sidebar-sites">
          {websites.map((site) => (
            <NavLink
              key={site.id}
              to={`/stats/${site.domain}`}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              title={site.domain}
            >
              <img className="sidebar-favicon" src={faviconUrl(site.domain)} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              <span className="sidebar-domain">{site.domain}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar-circle">{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="logout-link" onClick={() => void logout()} title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
