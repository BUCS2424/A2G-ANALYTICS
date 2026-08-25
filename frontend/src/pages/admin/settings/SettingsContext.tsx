import { useEffect, useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import { fetchAdminSettings } from '../../../api/admin'

export interface SettingsOutletContext {
  settings: Record<string, string | null>
  reload: () => void
}

export function useSettingsContext(): SettingsOutletContext {
  return useOutletContext<SettingsOutletContext>()
}

export default function AdminSettingsLayout() {
  const [settings, setSettings] = useState<Record<string, string | null> | null>(null)

  function reload() {
    fetchAdminSettings().then(setSettings)
  }

  useEffect(reload, [])

  if (!settings) return <p className="muted">Loading…</p>

  return <Outlet context={{ settings, reload } satisfies SettingsOutletContext} />
}
