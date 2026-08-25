import { isAxiosError } from 'axios'
import { useOutletContext } from 'react-router-dom'

export interface StatsOutletContext {
  domain: string
  from: string
  to: string
  onLocked: () => void
}

export function useStatsContext(): StatsOutletContext {
  return useOutletContext<StatsOutletContext>()
}

export function isPasswordRequired(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 401 && err.response.data?.detail === 'password_required'
}

export function isForbidden(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 403
}

export function growthPercent(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - previous) / previous) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}
