import svgMap from 'svgmap'
import 'svgmap/style'
import { useEffect, useId, useRef } from 'react'
import type { BreakdownRow } from '../api/stats'
import { isoCodeOf } from '../utils/flags'

export default function WorldMap({ rows }: { rows: BreakdownRow[] }) {
  const containerId = `world-map-${useId().replace(/[:]/g, '')}`
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // svgMap does some of its layout work asynchronously. Under React 18
    // StrictMode's dev-only double-invoke, constructing it synchronously here
    // let two instances race and the later one could inherit half-applied
    // color state from the first. Deferring one tick and cancelling the
    // pending run on cleanup means only the final invocation ever fires.
    const timer = setTimeout(() => {
      container.innerHTML = ''

      const values: Record<string, { visitors: number }> = {}
      for (const row of rows) {
        if (!row.value) continue
        const code = isoCodeOf(row.value)
        if (!code) continue
        values[code] = { visitors: (values[code]?.visitors ?? 0) + row.count }
      }

      new svgMap({
        targetElementID: containerId,
        colorMax: '#4f46e5',
        colorMin: '#e0e7ff',
        colorNoData: 'var(--border)',
        flagType: 'emoji',
        showZoomReset: true,
        zoomButtonsPosition: 'bottomLeft',
        data: {
          data: {
            visitors: { name: 'Visitors', format: '{0}', thousandSeparator: ',' },
          },
          applyData: 'visitors',
          values,
        },
      })
    }, 0)

    return () => clearTimeout(timer)
  }, [rows, containerId])

  return (
    <div className="world-map-card">
      <div id={containerId} ref={containerRef} />
    </div>
  )
}
