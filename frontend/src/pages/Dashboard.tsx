import { ExternalLink, Eye, Pencil, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, faviconUrl, fetchWebsitesSummary, type SummaryPeriod, type WebsiteSummary } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import RowMenu from '../components/RowMenu'
import WebsiteFormDrawer from '../components/WebsiteFormDrawer'

const PERIODS: { key: SummaryPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<SummaryPeriod>('today')
  const [websites, setWebsites] = useState<WebsiteSummary[] | null>(null)
  const [search, setSearch] = useState('')
  const [editingSite, setEditingSite] = useState<WebsiteSummary | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)

  function loadWebsites() {
    fetchWebsitesSummary(period).then(setWebsites)
  }

  useEffect(loadWebsites, [period])

  function openCreate() {
    setEditingSite(null)
    setShowDrawer(true)
  }

  function openEdit(site: WebsiteSummary) {
    setEditingSite(site)
    setShowDrawer(true)
  }

  function handleSaved() {
    setShowDrawer(false)
    loadWebsites()
  }

  async function handleToggleFavorite(site: WebsiteSummary) {
    await api.patch(`/websites/${site.id}`, { favorited: !site.favorited_at })
    loadWebsites()
  }

  async function handleDelete(site: WebsiteSummary) {
    if (!confirm(`Delete ${site.domain}? This removes all of its collected stats.`)) return
    await api.delete(`/websites/${site.id}`)
    loadWebsites()
  }

  const filtered = (websites ?? []).filter((w) => w.domain.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="dashboard">
      <div className="profile-row">
        <div className="profile-identity">
          <span className="avatar-circle avatar-circle-lg">{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
          <div>
            <h2>{user?.name}</h2>
            <span className="muted">✉ {user?.email}</span>
          </div>
        </div>
        <button onClick={openCreate}>+ New website</button>
      </div>

      <div className="section-row">
        <h1>Websites</h1>
        <div className="period-toggle">
          {PERIODS.map((p) => (
            <button key={p.key} className={p.key === period ? 'active' : ''} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-toolbar">
          <h3>Websites</h3>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <table className="website-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Visitors</th>
              <th>Pageviews</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {websites === null && (
              <tr>
                <td colSpan={4} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {websites !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No websites yet — add one to start tracking.
                </td>
              </tr>
            )}
            {filtered.map((site) => (
              <tr key={site.id}>
                <td>
                  <Link className="domain-cell" to={`/stats/${site.domain}`}>
                    <img className="table-favicon" src={faviconUrl(site.domain)} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                    {site.domain}
                  </Link>
                </td>
                <td>
                  <span className="pill pill-blue">{site.visitors.toLocaleString()}</span>
                </td>
                <td>
                  <span className="pill pill-red">{site.pageviews.toLocaleString()}</span>
                </td>
                <td>
                  <RowMenu
                    actions={[
                      { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(site) },
                      { label: 'View', icon: <Eye size={14} />, onClick: () => navigate(`/stats/${site.domain}`) },
                      { label: 'Open', icon: <ExternalLink size={14} />, onClick: () => window.open(`https://${site.domain}`, '_blank') },
                      { label: site.favorited_at ? 'Unfavorite' : 'Favorite', icon: <Star size={14} />, onClick: () => void handleToggleFavorite(site) },
                      { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => void handleDelete(site) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDrawer && <WebsiteFormDrawer website={editingSite} onClose={() => setShowDrawer(false)} onSaved={handleSaved} />}
    </div>
  )
}
