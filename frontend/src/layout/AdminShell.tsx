import { ArrowLeft, ChevronDown, ChevronUp, FileText, Globe, LayoutGrid, Moon, Settings, Sun, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'

const SETTINGS_TABS = [
  { key: 'general', label: 'General' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'email', label: 'Email' },
]

export default function AdminShell() {
  const { theme, toggle } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(true)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">A2G</span>
          <span className="brand-name">Admin</span>
        </div>

        <div className="sidebar-menu-label">
          <span>MENU</span>
          <button className="theme-toggle" onClick={toggle} title="Toggle light/dark theme" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>

        <NavLink to="/admin" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="sidebar-icon">
            <LayoutGrid size={16} />
          </span>
          Dashboard
        </NavLink>

        <button className="sidebar-link admin-settings-toggle" onClick={() => setSettingsOpen((o) => !o)}>
          <span className="sidebar-icon">
            <Settings size={16} />
          </span>
          Settings
          <span className="admin-settings-caret">{settingsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
        </button>
        {settingsOpen &&
          SETTINGS_TABS.map((tab) => (
            <NavLink key={tab.key} to={`/admin/settings/${tab.key}`} className={({ isActive }) => `sidebar-link admin-sub-link${isActive ? ' active' : ''}`}>
              {tab.label}
            </NavLink>
          ))}

        <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="sidebar-icon">
            <Users size={16} />
          </span>
          Users
        </NavLink>
        <NavLink to="/admin/pages" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="sidebar-icon">
            <FileText size={16} />
          </span>
          Pages
        </NavLink>
        <NavLink to="/admin/websites" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="sidebar-icon">
            <Globe size={16} />
          </span>
          Websites
        </NavLink>

        <div className="sidebar-sites" />

        <div className="sidebar-footer">
          <Link to="/dashboard" className="muted sidebar-back-link">
            <ArrowLeft size={14} /> Back to app
          </Link>
        </div>
      </aside>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
