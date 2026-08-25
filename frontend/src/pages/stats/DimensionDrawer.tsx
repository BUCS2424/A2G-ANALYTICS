import { X } from 'lucide-react'
import { DIMENSIONS } from '../../api/stats'
import DimensionBrowser from './DimensionBrowser'

interface Props {
  domain: string
  dimension: string
  from: string
  to: string
  onLocked: () => void
  onClose: () => void
}

export default function DimensionDrawer({ domain, dimension, from, to, onLocked, onClose }: Props) {
  const meta = DIMENSIONS.find((d) => d.key === dimension)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>{meta?.label ?? dimension}</h2>
          <button type="button" className="drawer-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="drawer-body">
          <DimensionBrowser domain={domain} dimension={dimension} from={from} to={to} onLocked={onLocked} />
        </div>
      </div>
    </div>
  )
}
