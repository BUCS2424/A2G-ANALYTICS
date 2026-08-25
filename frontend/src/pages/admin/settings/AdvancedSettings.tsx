import { useState, type FormEvent } from 'react'
import { updateAdminSettings } from '../../../api/admin'
import { Field, SettingsPage } from './SettingsPage'
import { useSettingsContext } from './SettingsContext'

export default function AdvancedSettings() {
  const { settings, reload } = useSettingsContext()
  const [cdnUrl, setCdnUrl] = useState(settings.cdn_url ?? '')
  const [webhookCreated, setWebhookCreated] = useState(settings.webhook_user_created ?? '')
  const [webhookUpdated, setWebhookUpdated] = useState(settings.webhook_user_updated ?? '')
  const [webhookDeleted, setWebhookDeleted] = useState(settings.webhook_user_deleted ?? '')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateAdminSettings({
      cdn_url: cdnUrl || null,
      webhook_user_created: webhookCreated || null,
      webhook_user_updated: webhookUpdated || null,
      webhook_user_deleted: webhookDeleted || null,
    })
    reload()
  }

  return (
    <SettingsPage title="Advanced" onSubmit={handleSubmit}>
      <Field label="CDN URL" hint="Serve the tracking script and static assets from this URL instead of this server directly.">
        <input value={cdnUrl} onChange={(e) => setCdnUrl(e.target.value)} placeholder="https://cdn.yourdomain.com" />
      </Field>
      <Field label="Webhook: user created" hint="POSTed with the new user's details whenever an account is created.">
        <input value={webhookCreated} onChange={(e) => setWebhookCreated(e.target.value)} placeholder="https://" />
      </Field>
      <Field label="Webhook: user updated">
        <input value={webhookUpdated} onChange={(e) => setWebhookUpdated(e.target.value)} placeholder="https://" />
      </Field>
      <Field label="Webhook: user deleted">
        <input value={webhookDeleted} onChange={(e) => setWebhookDeleted(e.target.value)} placeholder="https://" />
      </Field>
    </SettingsPage>
  )
}
