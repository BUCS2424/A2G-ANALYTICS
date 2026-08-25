import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { faviconUrl } from '../../api/client'
import type { BreakdownRow } from '../../api/stats'
import { flagEmoji } from '../../utils/flags'

function rowIcon(kind: 'countries' | 'referrers' | 'pages' | 'plain', value: string | null): ReactNode {
  if (!value) return <span className="row-icon row-icon-dot" />
  if (kind === 'countries') {
    const flag = flagEmoji(value)
    return flag ? <span className="row-icon">{flag}</span> : <span className="row-icon row-icon-dot" />
  }
  if (kind === 'referrers') {
    return <img className="row-icon row-icon-img" src={faviconUrl(value)} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
  }
  return <span className="row-icon row-icon-dot" />
}

interface Props {
  title: string
  rows: BreakdownRow[]
  kind?: 'countries' | 'referrers' | 'pages' | 'plain'
  onViewAll?: () => void
}

export default function BreakdownList({ title, rows, kind = 'plain', onViewAll }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className="breakdown-card">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="muted">No data for this range</p>}
      <ul className="breakdown-list">
        {rows.map((row) => (
          <li key={row.value ?? 'direct'}>
            <div className="breakdown-row-top">
              <span className="breakdown-row-label">
                {rowIcon(kind, row.value)}
                {row.value ?? 'Direct / None'}
              </span>
              <span className="breakdown-count">{row.count.toLocaleString()}</span>
            </div>
            <div className="breakdown-bar-track">
              <div className="breakdown-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {onViewAll && (
        <button className="view-all-btn" onClick={onViewAll}>
          View all <ArrowRight size={13} />
        </button>
      )}
    </div>
  )
}
