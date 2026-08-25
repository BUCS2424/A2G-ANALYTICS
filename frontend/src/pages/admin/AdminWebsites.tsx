import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { deleteAdminWebsite, fetchAdminWebsites, type AdminWebsite } from '../../api/admin'
import RowMenu from '../../components/RowMenu'

const PRIVACY_LABELS = ['Public', 'Private', 'Password']

export default function AdminWebsites() {
  const [websites, setWebsites] = useState<AdminWebsite[]>([])
  const [search, setSearch] = useState('')

  function load() {
    fetchAdminWebsites(search || undefined).then(setWebsites)
  }

  useEffect(load, [search])

  async function handleDelete(w: AdminWebsite) {
    if (!confirm(`Delete ${w.domain}? This removes all of its collected stats.`)) return
    await deleteAdminWebsite(w.id)
    load()
  }

  return (
    <div>
      <div className="section-row">
        <h1>Websites</h1>
      </div>

      <div className="card">
        <div className="card-toolbar">
          <h3>All websites</h3>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table className="website-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Owner</th>
              <th>Privacy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {websites.map((w) => (
              <tr key={w.id}>
                <td>{w.domain}</td>
                <td className="muted">{w.owner_email ?? '—'}</td>
                <td>{PRIVACY_LABELS[w.privacy] ?? w.privacy}</td>
                <td>
                  <RowMenu actions={[{ label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => void handleDelete(w) }]} />
                </td>
              </tr>
            ))}
            {websites.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No websites found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
