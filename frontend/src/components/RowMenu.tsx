import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface RowMenuAction {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

export default function RowMenu({ actions }: { actions: RowMenuAction[] }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="row-menu">
      <button ref={triggerRef} className="row-menu-trigger" onClick={toggle} aria-label="Actions">
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <div ref={dropdownRef} className="row-menu-dropdown" style={{ position: 'fixed', top: position.top, right: position.right }}>
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
          </div>,
          document.body,
        )}
    </div>
  )
}
