import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function SettingsPage({ title, children, onSubmit }: { title: string; children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <div>
      <div className="admin-breadcrumb muted">
        <Link to="/admin">Admin</Link> <span>›</span> <span>Settings</span>
      </div>
      <h1 className="settings-title">{title}</h1>
      <form className="card settings-card" onSubmit={onSubmit}>
        <div className="card-toolbar">
          <h3>{title}</h3>
        </div>
        <div className="settings-fields">{children}</div>
        <div className="settings-footer">
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-field">
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}
