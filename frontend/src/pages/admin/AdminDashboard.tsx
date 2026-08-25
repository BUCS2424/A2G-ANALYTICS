import { FileText, Globe, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminDashboard, type AdminDashboard } from '../../api/admin'

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null)

  useEffect(() => {
    fetchAdminDashboard().then(setData)
  }, [])

  if (!data) return <p className="muted">Loading…</p>

  return (
    <div className="admin-dashboard">
      <h1 className="section-row-title">Overview</h1>

      <div className="kpi-cards admin-kpi-cards">
        <Link to="/admin/users" className="kpi-card admin-kpi-link">
          <div className="kpi-card-top">
            <span className="kpi-card-icon"><Users size={16} /></span>
          </div>
          <div className="kpi-card-value">{data.counts.users}</div>
          <span className="kpi-card-change muted">Users →</span>
        </Link>
        <Link to="/admin/pages" className="kpi-card admin-kpi-link">
          <div className="kpi-card-top">
            <span className="kpi-card-icon"><FileText size={16} /></span>
          </div>
          <div className="kpi-card-value">{data.counts.pages}</div>
          <span className="kpi-card-change muted">Pages →</span>
        </Link>
        <Link to="/admin/websites" className="kpi-card admin-kpi-link">
          <div className="kpi-card-top">
            <span className="kpi-card-icon"><Globe size={16} /></span>
          </div>
          <div className="kpi-card-value">{data.counts.websites}</div>
          <span className="kpi-card-change muted">Websites →</span>
        </Link>
      </div>

      <h2 className="section-row-title">Activity</h2>
      <div className="breakdown-grid">
        <div className="card">
          <div className="card-toolbar">
            <h3>Latest users</h3>
          </div>
          <table className="website-table">
            <tbody>
              {data.latest_users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div>{u.name}</div>
                    <span className="muted">{u.email}</span>
                  </td>
                </tr>
              ))}
              {data.latest_users.length === 0 && (
                <tr>
                  <td className="muted">No users yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-toolbar">
            <h3>Latest websites</h3>
          </div>
          <table className="website-table">
            <tbody>
              {data.latest_websites.map((w) => (
                <tr key={w.id}>
                  <td>{w.domain}</td>
                </tr>
              ))}
              {data.latest_websites.length === 0 && (
                <tr>
                  <td className="muted">No websites yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
