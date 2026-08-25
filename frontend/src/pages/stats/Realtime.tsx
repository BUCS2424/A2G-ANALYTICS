import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartData } from 'chart.js'
import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { fetchRealtime, type RealtimeResponse } from '../../api/stats'
import { growthPercent, isPasswordRequired, useStatsContext } from './context'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function Realtime() {
  const { domain, onLocked } = useStatsContext()
  const [data, setData] = useState<RealtimeResponse | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetchRealtime(domain)
        if (!cancelled) setData(res)
      } catch (err) {
        if (isPasswordRequired(err)) onLocked()
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [domain, paused, onLocked])

  if (!data) return <p className="muted">Loading…</p>

  const labels = Object.keys(data.visitors_map)
  const chartData: ChartData<'bar'> = {
    labels: labels.map((l) => l.slice(-8)),
    datasets: [
      { label: 'Visitors', data: labels.map((l) => data.visitors_map[l]), backgroundColor: '#4f46e5' },
      { label: 'Pageviews', data: labels.map((l) => data.pageviews_map[l]), backgroundColor: '#22c55e' },
    ],
  }

  return (
    <div className="realtime">
      <div className="kpi-row">
        <div className="kpi">
          <span className="kpi-label">Visitors (last min)</span>
          <span className="kpi-value">{data.total_visitors}</span>
          <span className="kpi-growth">{growthPercent(data.total_visitors, data.visitors_old)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Pageviews (last min)</span>
          <span className="kpi-value">{data.total_pageviews}</span>
          <span className="kpi-growth">{growthPercent(data.total_pageviews, data.pageviews_old)}</span>
        </div>
        <button onClick={() => setPaused((p) => !p)}>{paused ? 'Resume' : 'Pause'}</button>
      </div>

      <div className="chart-card">
        <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { maxTicksLimit: 12 } } } }} height={220} />
      </div>

      <div className="breakdown-card">
        <h3>Recent activity</h3>
        {data.recent.length === 0 && <p className="muted">No activity in the last minute</p>}
        <table className="recent-table">
          <tbody>
            {data.recent.map((hit) => (
              <tr key={hit.id}>
                <td>{hit.page ?? '—'}</td>
                <td>{hit.country ?? '—'}</td>
                <td>{hit.browser ?? '—'}</td>
                <td>{hit.device ?? '—'}</td>
                <td>{new Date(hit.created_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
