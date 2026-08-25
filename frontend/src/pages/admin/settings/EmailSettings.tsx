import { useState, type FormEvent } from 'react'
import { updateAdminSettings } from '../../../api/admin'
import { Field, SettingsPage } from './SettingsPage'
import { useSettingsContext } from './SettingsContext'

export default function EmailSettings() {
  const { settings, reload } = useSettingsContext()
  const [driver, setDriver] = useState(settings.mail_driver ?? 'log')
  const [host, setHost] = useState(settings.mail_host ?? '')
  const [port, setPort] = useState(settings.mail_port ?? '')
  const [encryption, setEncryption] = useState(settings.mail_encryption ?? 'tls')
  const [fromAddress, setFromAddress] = useState(settings.mail_from_address ?? '')
  const [username, setUsername] = useState(settings.mail_username ?? '')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateAdminSettings({
      mail_driver: driver,
      mail_host: host || null,
      mail_port: port || null,
      mail_encryption: encryption,
      mail_from_address: fromAddress || null,
      mail_username: username || null,
      ...(password ? { mail_password: password } : {}),
    })
    reload()
  }

  const isSmtp = driver === 'smtp'

  return (
    <SettingsPage title="Email" onSubmit={handleSubmit}>
      <Field label="Driver" hint="Log writes emails to the server log instead of sending them — useful until SMTP is configured.">
        <select value={driver} onChange={(e) => setDriver(e.target.value)}>
          <option value="log">Log</option>
          <option value="smtp">Custom SMTP</option>
        </select>
      </Field>
      {isSmtp && (
        <>
          <Field label="Host">
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
          </Field>
          <Field label="Port">
            <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
          </Field>
          <Field label="Encryption">
            <select value={encryption} onChange={(e) => setEncryption(e.target.value)}>
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </Field>
          <Field label="Email address">
            <input type="email" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="reports@yourdomain.com" />
          </Field>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Password" hint={settings.mail_password ? 'A password is already saved — leave blank to keep it.' : undefined}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </>
      )}
    </SettingsPage>
  )
}
