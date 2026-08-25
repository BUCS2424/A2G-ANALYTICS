import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type Website } from '../api/client'

interface Props {
  website: Website | null // null = create mode
  onClose: () => void
  onSaved: () => void
}

type Privacy = 0 | 1 | 2

export default function WebsiteFormDrawer({ website, onClose, onSaved }: Props) {
  const isEdit = website !== null
  const [domain, setDomain] = useState(website?.domain ?? '')
  const [privacy, setPrivacy] = useState<Privacy>((website?.privacy as Privacy) ?? 1)
  const [password, setPassword] = useState('')
  const [emailReports, setEmailReports] = useState(website?.email ?? false)
  const [clientEmails, setClientEmails] = useState((website?.client_emails ?? []).join('\n'))
  const [excludeIps, setExcludeIps] = useState(website?.exclude_ips ?? '')
  const [excludeParams, setExcludeParams] = useState(website?.exclude_params ?? '')
  const [excludeBots, setExcludeBots] = useState(website?.exclude_bots ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'snippet' | 'link' | null>(null)
  const [sendingReport, setSendingReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const origin = window.location.origin
  const snippet = `<script data-host="${origin}" data-dnt="false" src="${origin}/js/script.js" id="ZwSg9rf6GA" async defer></script>`
  const publicLink = `${origin}/${domain || 'yourdomain.com'}`

  function copy(text: string, which: 'snippet' | 'link') {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  async function handleSendReportNow() {
    setSendingReport(true)
    setReportError(null)
    setReportSent(false)
    try {
      await api.post(`/websites/${website!.id}/send-report`)
      setReportSent(true)
      setTimeout(() => setReportSent(false), 3000)
    } catch {
      setReportError('Could not send the report — check the Email settings in Admin.')
    } finally {
      setSendingReport(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        domain,
        privacy,
        password: privacy === 2 && password ? password : undefined,
        email: emailReports,
        client_emails: clientEmails
          .split('\n')
          .map((e) => e.trim())
          .filter(Boolean),
        exclude_ips: excludeIps || null,
        exclude_params: excludeParams || null,
        exclude_bots: excludeBots,
      }
      if (isEdit) {
        await api.patch(`/websites/${website!.id}`, payload)
      } else {
        await api.post('/websites', payload)
      }
      onSaved()
    } catch {
      setError('Could not save — check the domain and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <form className="drawer-panel" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="drawer-header">
          <h2>{isEdit ? 'Edit website' : 'New website'}</h2>
          <button type="button" className="drawer-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {error && <p className="error">{error}</p>}

          <section className="drawer-section">
            <label className="field-label">Domain</label>
            <input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} required autoFocus={!isEdit} />
            <p className="field-hint">Add a domain or subdomain.</p>
          </section>

          <section className="drawer-section">
            <label className="field-label">Privacy</label>
            <div className="privacy-options">
              {[
                { value: 1 as Privacy, label: 'Private', hint: 'Stats accessible only by you.' },
                { value: 0 as Privacy, label: 'Public', hint: 'Stats accessible by anyone with the link.' },
                { value: 2 as Privacy, label: 'Password', hint: 'Stats accessible with a password.' },
              ].map((opt) => (
                <label key={opt.value} className="privacy-option">
                  <input type="radio" name="privacy" checked={privacy === opt.value} onChange={() => setPrivacy(opt.value)} />
                  <div>
                    <span className="field-label">{opt.label}</span>
                    <p className="field-hint">{opt.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            {privacy === 2 && (
              <input
                type="password"
                placeholder={isEdit ? 'Leave blank to keep current password' : 'Set a password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </section>

          <section className="drawer-section">
            <label className="checkbox-row">
              <input type="checkbox" checked={emailReports} onChange={(e) => setEmailReports(e.target.checked)} />
              <div>
                <span className="field-label">Email reports</span>
                <p className="field-hint">Sends a summary of the previous month's traffic on the 1st of every month.</p>
              </div>
            </label>
            {emailReports && (
              <>
                <textarea
                  rows={3}
                  placeholder={'client@example.com'}
                  value={clientEmails}
                  onChange={(e) => setClientEmails(e.target.value)}
                  style={{ marginTop: '0.5rem' }}
                />
                <p className="field-hint">One email per line. Reports are sent to all of them.</p>
              </>
            )}
            {isEdit && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button type="button" className="secondary" onClick={() => void handleSendReportNow()} disabled={sendingReport}>
                  {sendingReport ? 'Sending…' : 'Send report now'}
                </button>
                {reportSent && <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>Sent!</span>}
                {reportError && <span className="error">{reportError}</span>}
              </div>
            )}
          </section>

          <section className="drawer-section drawer-two-col">
            <div>
              <label className="field-label">Exclude IPs</label>
              <textarea rows={3} value={excludeIps} onChange={(e) => setExcludeIps(e.target.value)} />
              <p className="field-hint">One per line.</p>
            </div>
            <div>
              <label className="field-label">Exclude URL query parameters</label>
              <textarea rows={3} value={excludeParams} onChange={(e) => setExcludeParams(e.target.value)} />
              <p className="field-hint">One per line.</p>
            </div>
          </section>

          <section className="drawer-section">
            <label className="checkbox-row">
              <input type="checkbox" checked={excludeBots} onChange={(e) => setExcludeBots(e.target.checked)} />
              <div>
                <span className="field-label">Exclude bots</span>
                <p className="field-hint">Exclude common bots from being tracked.</p>
              </div>
            </label>
          </section>

          <section className="drawer-section">
            <label className="field-label">Tracking code</label>
            <p className="field-hint">Include this in the &lt;head&gt; or &lt;body&gt; of your website.</p>
            <div className="code-box">
              <code>{snippet}</code>
              <button type="button" onClick={() => copy(snippet, 'snippet')}>
                {copied === 'snippet' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </section>

          {privacy === 0 && (
            <section className="drawer-section">
              <label className="field-label">Public analytics link</label>
              <p className="field-hint">Share this so anyone can view {domain || 'this site'}'s analytics without logging in.</p>
              <div className="code-box">
                <code>{publicLink}</code>
                <button type="button" onClick={() => copy(publicLink, 'link')}>
                  {copied === 'link' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="drawer-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
