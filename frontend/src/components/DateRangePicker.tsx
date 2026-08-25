import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'Today', range: () => [iso(daysAgo(0)), iso(daysAgo(0))] },
  { label: 'Yesterday', range: () => [iso(daysAgo(1)), iso(daysAgo(1))] },
  { label: 'Last 7 days', range: () => [iso(daysAgo(6)), iso(daysAgo(0))] },
  { label: 'Last 30 days', range: () => [iso(daysAgo(29)), iso(daysAgo(0))] },
  {
    label: 'This month',
    range: () => {
      const d = new Date()
      return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(daysAgo(0))]
    },
  },
  { label: 'All time', range: () => ['2000-01-01', iso(daysAgo(0))] },
]

function describeRange(from: string, to: string): string {
  const preset = PRESETS.find((p) => {
    const [pf, pt] = p.range()
    return pf === from && pt === to
  })
  if (preset) return preset.label
  return `${from} → ${to}`
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
  return cells
}

export default function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [pickingSecond, setPickingSecond] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date(to))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setDraftFrom(from)
      setDraftTo(to)
      setPickingSecond(false)
      setViewDate(new Date(to))
    }
  }, [open, from, to])

  function applyPreset(range: () => [string, string]) {
    const [f, t] = range()
    onChange(f, t)
    setOpen(false)
  }

  function handleDayClick(day: Date) {
    const value = iso(day)
    if (!pickingSecond) {
      setDraftFrom(value)
      setDraftTo(value)
      setPickingSecond(true)
    } else {
      if (value < draftFrom) {
        setDraftTo(draftFrom)
        setDraftFrom(value)
      } else {
        setDraftTo(value)
      }
      setPickingSecond(false)
    }
  }

  function applyCustom() {
    onChange(draftFrom, draftTo)
    setOpen(false)
  }

  const cells = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth())
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="date-range-picker" ref={containerRef}>
      <button className="date-range-trigger" onClick={() => setOpen((o) => !o)}>
        <CalendarDays size={14} /> {describeRange(from, to)} <ChevronDown size={13} />
      </button>

      {open && (
        <div className="date-range-panel">
          <div className="date-range-presets">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.range)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="date-range-calendar">
            <div className="calendar-header">
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                <ChevronLeft size={14} />
              </button>
              <span>{monthLabel}</span>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="calendar-weekdays">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {cells.map((day, i) => {
                if (!day) return <span key={i} />
                const value = iso(day)
                const inRange = value >= draftFrom && value <= draftTo
                const isEdge = value === draftFrom || value === draftTo
                return (
                  <button
                    key={i}
                    className={`calendar-day${inRange ? ' in-range' : ''}${isEdge ? ' edge' : ''}`}
                    onClick={() => handleDayClick(day)}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="calendar-footer">
              <span className="muted">
                {draftFrom} → {draftTo}
              </span>
              <button onClick={applyCustom}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
