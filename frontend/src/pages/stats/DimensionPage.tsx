import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DIMENSIONS, fetchBreakdown, type BreakdownRow } from '../../api/stats'
import WorldMap from '../../components/WorldMap'
import DimensionBrowser from './DimensionBrowser'
import { useStatsContext } from './context'

export default function DimensionPage() {
  const { dimension } = useParams<{ dimension: string }>()
  const { domain, from, to, onLocked } = useStatsContext()
  const meta = DIMENSIONS.find((d) => d.key === dimension)
  const [mapRows, setMapRows] = useState<BreakdownRow[] | null>(null)

  useEffect(() => {
    if (dimension !== 'countries') return
    setMapRows(null)
    // Map coloring needs every country's count, independent of the table's
    // own pagination below it.
    fetchBreakdown(domain, 'countries', { from, to, per_page: 250 })
      .then((res) => setMapRows(res.results))
      .catch(() => setMapRows([]))
  }, [domain, dimension, from, to])

  if (!dimension || !meta) return <p className="error">Unknown dimension</p>

  return (
    <div>
      <h2 className="dimension-page-title">{meta.label}</h2>
      {dimension === 'countries' && mapRows && mapRows.length > 0 && <WorldMap rows={mapRows} />}
      <DimensionBrowser domain={domain} dimension={dimension} from={from} to={to} onLocked={onLocked} />
    </div>
  )
}
