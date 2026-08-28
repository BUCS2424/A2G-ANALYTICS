import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
} from 'chart.js'
import { Eye, FileText, Users, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { fetchOverview, type OverviewResponse } from '../../api/stats'
import Sparkline from '../../components/Sparkline'
import BreakdownList from './BreakdownList'
import DimensionDrawer from './DimensionDrawer'
import { growthPercent, isForbidden, isPasswordRequired, useStatsContext } from './context'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function Overview() {
  const { domain, from, to, onLocked } = useStatsContext()
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [openDimension, setOpenDimension] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setForbidden(false)
    fetchOverview(domain, from, to)
      .then(setData)
      .catch((err) => {
        if (isPasswordRequired(err)) onLocked()
        else if (isForbidden(err)) setForbidden(true)
      })
  }, [domain, from, to, onLocked])

  if (forbidden) return <p className="error">This website's stats are private.</p>
  if (!data) return <p className="muted">Loading…</p>

  const labels = Object.keys(data.visitors_map)
  const visitorSeries = labels.map((l) => data.visitors_map[l])
  const pageviewSeries = labels.map((l) => data.pageviews_map[l])
  const pagesPerVisitor = data.total_visitors > 0 ? data.total_pageviews / data.total_visitors : 0
  const totalDeviceHits = data.devices.reduce((sum, d) => sum + d.count, 0)

  const chartData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Visitors',
        data: visitorSeries,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79,70,229,0.15)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Pageviews',
        data: pageviewSeries,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  }

  return (
    <div className="overview">
      <div className="kpi-cards">
        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-card-label">Visitors</span>
            <span className="kpi-card-icon"><Users size={16} /></span>
          </div>
          <div className="kpi-card-value">{data.total_visitors.toLocaleString()}</div>
          <span className={`kpi-card-change ${data.total_visitors >= data.total_visitors_old ? 'positive' : 'negative'}`}>
            {growthPercent(data.total_visitors, data.total_visitors_old)} vs previous period
          </span>
          <Sparkline data={visitorSeries} color="#4f46e5" />
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-card-label">Pageviews</span>
            <span className="kpi-card-icon"><Eye size={16} /></span>
          </div>
          <div className="kpi-card-value">{data.total_pageviews.toLocaleString()}</div>
          <span className={`kpi-card-change ${data.total_pageviews >= data.total_pageviews_old ? 'positive' : 'negative'}`}>
            {growthPercent(data.total_pageviews, data.total_pageviews_old)} vs previous period
          </span>
          <Sparkline data={pageviewSeries} color="#22c55e" />
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-card-label">Pages / visitor</span>
            <span className="kpi-card-icon"><FileText size={16} /></span>
          </div>
          <div className="kpi-card-value">{pagesPerVisitor.toFixed(2)}</div>
          <span className="kpi-card-change muted">avg. pageviews per visitor</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-card-label">Events</span>
            <span className="kpi-card-icon"><Zap size={16} /></span>
          </div>
          <div className="kpi-card-value">{data.events.reduce((sum, e) => sum + e.count, 0).toLocaleString()}</div>
          <span className="kpi-card-change muted">custom events tracked</span>
        </div>
      </div>

      <div className="overview-grid">
        <div className="chart-card">
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} height={340} />
        </div>

        <div className="side-panels">
          <BreakdownList title="Top pages" rows={data.pages} kind="pages" domain={domain} onViewAll={() => setOpenDimension('pages')} />
          <div className="breakdown-card">
            <h3>Device acquisition</h3>
            {data.devices.length === 0 && <p className="muted">No data for this range</p>}
            {data.devices.map((d) => {
              const pct = totalDeviceHits > 0 ? (d.count / totalDeviceHits) * 100 : 0
              return (
                <div className="device-row" key={d.value ?? 'unknown'}>
                  <span className="device-label">{d.value ?? 'Unknown'}</span>
                  <span className="device-bar-track">
                    <span className="device-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="device-pct">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="breakdown-grid" style={{ marginTop: '1rem' }}>
        <BreakdownList title="Top referrers" rows={data.referrers} kind="referrers" onViewAll={() => setOpenDimension('referrers')} />
        <BreakdownList title="Top countries" rows={data.countries} kind="countries" onViewAll={() => setOpenDimension('countries')} />
        <BreakdownList title="Top browsers" rows={data.browsers} onViewAll={() => setOpenDimension('browsers')} />
        <BreakdownList title="Operating systems" rows={data.operating_systems} onViewAll={() => setOpenDimension('operating-systems')} />
      </div>

      {openDimension && (
        <DimensionDrawer
          domain={domain}
          dimension={openDimension}
          from={from}
          to={to}
          onLocked={onLocked}
          onClose={() => setOpenDimension(null)}
        />
      )}
    </div>
  )
}
