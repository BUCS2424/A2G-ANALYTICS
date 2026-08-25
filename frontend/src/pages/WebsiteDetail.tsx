import { Link, useParams } from 'react-router-dom'

export default function WebsiteDetail() {
  const { id } = useParams()

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Website #{id}</h1>
        <Link to="/dashboard">Back to dashboard</Link>
      </header>
      <p>Stats dashboard (overview, realtime, referrers, geography, devices) lands here in the next milestone.</p>
    </div>
  )
}
