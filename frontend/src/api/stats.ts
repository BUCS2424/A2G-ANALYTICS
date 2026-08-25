import { api } from './client'

export interface OverviewResponse {
  range: { from: string; to: string; unit: string }
  visitors_map: Record<string, number>
  pageviews_map: Record<string, number>
  total_visitors: number
  total_pageviews: number
  total_visitors_old: number
  total_pageviews_old: number
  pages: BreakdownRow[]
  referrers: BreakdownRow[]
  countries: BreakdownRow[]
  browsers: BreakdownRow[]
  operating_systems: BreakdownRow[]
  devices: BreakdownRow[]
  events: BreakdownRow[]
}

export interface RealtimeResponse {
  visitors_map: Record<string, number>
  pageviews_map: Record<string, number>
  total_visitors: number
  total_pageviews: number
  visitors_old: number
  pageviews_old: number
  recent: RecentHit[]
}

export interface RecentHit {
  id: string
  page: string | null
  referrer: string | null
  browser: string | null
  operating_system: string | null
  device: string | null
  country: string | null
  created_at: string
}

export interface BreakdownRow {
  value: string | null
  count: number
}

export interface BreakdownResponse {
  range: { from: string; to: string }
  total: number
  total_count: number
  page: number
  per_page: number
  results: BreakdownRow[]
}

export const DIMENSIONS = [
  { key: 'pages', label: 'Pages', group: 'Behavior' },
  { key: 'landing-pages', label: 'Landing pages', group: 'Behavior' },
  { key: 'referrers', label: 'Referrers', group: 'Acquisitions' },
  { key: 'search-engines', label: 'Search engines', group: 'Acquisitions' },
  { key: 'social-networks', label: 'Social networks', group: 'Acquisitions' },
  { key: 'campaigns', label: 'Campaigns', group: 'Acquisitions' },
  { key: 'continents', label: 'Continents', group: 'Geographic' },
  { key: 'countries', label: 'Countries', group: 'Geographic' },
  { key: 'cities', label: 'Cities', group: 'Geographic' },
  { key: 'languages', label: 'Languages', group: 'Geographic' },
  { key: 'browsers', label: 'Browsers', group: 'Technology' },
  { key: 'operating-systems', label: 'Operating systems', group: 'Technology' },
  { key: 'screen-resolutions', label: 'Screen resolutions', group: 'Technology' },
  { key: 'devices', label: 'Devices', group: 'Technology' },
  { key: 'events', label: 'Events', group: 'Events' },
] as const

export const NAV_GROUPS = ['Behavior', 'Acquisitions', 'Geographic', 'Technology'] as const

export async function fetchOverview(domain: string, from: string, to: string) {
  const res = await api.get<OverviewResponse>(`/websites/${domain}/stats/overview`, { params: { from, to } })
  return res.data
}

export async function fetchRealtime(domain: string) {
  const res = await api.get<RealtimeResponse>(`/websites/${domain}/stats/realtime`)
  return res.data
}

export async function fetchBreakdown(
  domain: string,
  dimension: string,
  params: { from: string; to: string; search?: string; sort_by?: string; sort?: string; page?: number; per_page?: number },
) {
  const res = await api.get<BreakdownResponse>(`/websites/${domain}/stats/${dimension}`, { params })
  return res.data
}

export function exportUrl(
  domain: string,
  dimension: string,
  params: { from: string; to: string; search?: string },
) {
  const query = new URLSearchParams(params as Record<string, string>).toString()
  return `/api/websites/${domain}/stats/${dimension}/export?${query}`
}

export async function unlockStats(domain: string, password: string) {
  await api.post(`/websites/${domain}/stats/unlock`, { password })
}
