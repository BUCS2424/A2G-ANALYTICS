import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface RowMenuAction {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

export default function RowMenu({ actions }: { actions: RowMenuAction[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div className="row-menu" ref={ref}>
      <button className="row-menu-trigger" onClick={() => setOpen((o) => !o)} aria-label="Actions">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="row-menu-dropdown">
          {actions.map((action, i) => (
            <button
              key={action.label}
              className={`row-menu-item${action.danger ? ' danger' : ''}${i > 0 && action.danger && !actions[i - 1].danger ? ' with-divider' : ''}`}
              onClick={() => {
                setOpen(false)
                action.onClick()
              }}
            >
              <span className="row-menu-icon">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
