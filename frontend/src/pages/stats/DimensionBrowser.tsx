import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { faviconUrl } from '../../api/client'
import { DIMENSIONS, exportUrl, fetchBreakdown, type BreakdownResponse } from '../../api/stats'
import { flagEmoji } from '../../utils/flags'
import { isPasswordRequired } from './context'

function rowIcon(dimension: string, value: string | null) {
  if (!value) return null
  if (dimension === 'countries' || dimension === 'cities') {
    const flag = flagEmoji(value)
    return flag ? <span className="row-icon">{flag}</span> : null
  }
  if (dimension === 'referrers' || dimension === 'search-engines' || dimension === 'social-networks') {
    return <img className="row-icon row-icon-img" src={faviconUrl(value)} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
  }
  return null
}

interface Props {
  domain: string
  dimension: string
  from: string
  to: string
  onLocked: () => void
}

export default function DimensionBrowser({ domain, dimension, from, to, onLocked }: Props) {
  const [data, setData] = useState<BreakdownResponse | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'count' | 'value'>('count')
  const [sort, setSort] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const meta = DIMENSIONS.find((d) => d.key === dimension)

  useEffect(() => {
    setPage(1)
  }, [dimension, from, to])

  function load() {
    if (!dimension) return
    fetchBreakdown(domain, dimension, { from, to, search: search || undefined, sort_by: sortBy, sort, page, per_page: 25 })
      .then((res) => {
        setData(res)
        setGeneratedAt(new Date())
      })
      .catch((err) => {
        if (isPasswordRequired(err)) onLocked()
      })
  }

  useEffect(load, [domain, dimension, from, to, search, sortBy, sort, page, onLocked])

  if (!dimension || !meta) return <p className="error">Unknown dimension</p>
  if (!data) return <p className="muted">Loading…</p>

  const totalPages = Math.max(1, Math.ceil(data.total / data.per_page))
  const rangeStart = data.total === 0 ? 0 : (page - 1) * data.per_page + 1
  const rangeEnd = Math.min(page * data.per_page, data.total)

  function toggleSort(field: 'count' | 'value') {
    if (sortBy === field) {
      setSort(sort === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSort('desc')
    }
  }

  return (
    <div className="dimension-page">
      <div className="dimension-toolbar">
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <a className="icon-btn" href={exportUrl(domain, dimension, { from, to, search: search || undefined })} title="Export CSV">
          <Download size={15} />
        </a>
      </div>

      <table className="dimension-table">
        <thead>
          <tr>
            <th onClick={() => toggleSort('value')}>Name</th>
            <th onClick={() => toggleSort('count')}>Visitors</th>
          </tr>
        </thead>
        <tbody>
          <tr className="totals-row">
            <td>Total</td>
            <td>
              {data.total_count.toLocaleString()} <span className="muted">100.0%</span>
            </td>
          </tr>
          {data.results.map((row) => {
            const pct = data.total_count > 0 ? (row.count / data.total_count) * 100 : 0
            const isPage = (dimension === 'pages' || dimension === 'landing-pages') && row.value
            return (
              <tr key={row.value ?? 'direct'} className="dimension-row">
                <td className="dimension-row-label">
                  {rowIcon(dimension, row.value)}
                  {isPage ? (
                    <a
                      className="breakdown-row-text"
                      href={`https://${domain}${row.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={row.value ?? undefined}
                    >
                      {row.value}
                    </a>
                  ) : (
                    <span className="breakdown-row-text" title={row.value ?? undefined}>
                      {row.value ?? 'Direct / None'}
                    </span>
                  )}
                </td>
                <td>
                  {row.count.toLocaleString()} <span className="muted">{pct.toFixed(1)}%</span>
                  <div className="dimension-row-bar">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
          {data.results.length === 0 && (
            <tr>
              <td colSpan={2} className="muted">
                No data for this range
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="dimension-footer-row">
        <span className="muted">
          Showing {rangeStart}-{rangeEnd} of {data.total}
        </span>
        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </div>

      {generatedAt && (
        <p className="report-footer muted">
          Report generated on {generatedAt.toLocaleString()}.{' '}
          <button className="link-btn" onClick={load}>
            Refresh report
          </button>
        </p>
      )}
    </div>
  )
}
