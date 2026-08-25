import { useState, type FormEvent } from 'react'
import { updateAdminSettings } from '../../../api/admin'
import { Field, SettingsPage } from './SettingsPage'
import { useSettingsContext } from './SettingsContext'

export default function GeneralSettings() {
  const { settings, reload } = useSettingsContext()
  const [title, setTitle] = useState(settings.title ?? 'A2G Analytics')
  const [tagline, setTagline] = useState(settings.tagline ?? '')
  const [customIndexUrl, setCustomIndexUrl] = useState(settings.custom_index_url ?? '')
  const [paginate, setPaginate] = useState(settings.paginate ?? '100')
  const [forceHttps, setForceHttps] = useState(settings.force_https ?? 'enabled')
  const [timezone, setTimezone] = useState(settings.timezone ?? 'UTC')
  const [customJs, setCustomJs] = useState(settings.custom_js ?? '')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateAdminSettings({
      title,
      tagline,
      custom_index_url: customIndexUrl || null,
      paginate,
      force_https: forceHttps,
      timezone,
      custom_js: customJs || null,
    })
    reload()
  }

  return (
    <SettingsPage title="General" onSubmit={handleSubmit}>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Tagline">
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </Field>
      <Field label="Custom index URL" hint="Redirect the homepage to this URL instead of the default landing page.">
        <input value={customIndexUrl} onChange={(e) => setCustomIndexUrl(e.target.value)} placeholder="https://" />
      </Field>
      <Field label="Results per page">
        <select value={paginate} onChange={(e) => setPaginate(e.target.value)}>
          {['10', '25', '50', '100'].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Force HTTPS">
        <select value={forceHttps} onChange={(e) => setForceHttps(e.target.value)}>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </Field>
      <Field label="Timezone">
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London'].map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Custom JS">
        <textarea rows={4} value={customJs} onChange={(e) => setCustomJs(e.target.value)} />
      </Field>
    </SettingsPage>
  )
}
