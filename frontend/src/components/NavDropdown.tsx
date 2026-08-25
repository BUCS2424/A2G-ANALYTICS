import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

interface Item {
  key: string
  label: string
}

export default function NavDropdown({ icon, label, items }: { icon: ReactNode; label: string; items: Item[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isActive = items.some((item) => location.pathname.endsWith(`/${item.key}`))

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div className="nav-dropdown" ref={ref}>
      <button className={`nav-dropdown-trigger${isActive ? ' active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="sidebar-icon">{icon}</span>
        {label}
        <ChevronDown size={13} className="nav-dropdown-caret" />
      </button>
      {open && (
        <div className="nav-dropdown-menu">
          {items.map((item) => (
            <NavLink key={item.key} to={item.key} className={({ isActive: a }) => (a ? 'active' : '')} onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
