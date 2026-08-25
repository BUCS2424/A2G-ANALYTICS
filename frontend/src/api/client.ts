import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export interface User {
  id: string
  name: string
  email: string
  role: number
  locale: string | null
  timezone: string | null
  avatar: string | null
  tfa: number | null
}

export interface Website {
  id: string
  domain: string
  user_id: string
  privacy: number
  email: boolean | null
  client_emails: string[]
  exclude_bots: boolean | null
  exclude_params: string | null
  exclude_ips: string | null
  favorited_at: string | null
  created_at: string | null
}

export interface WebsiteSummary extends Website {
  visitors: number
  pageviews: number
}

export type SummaryPeriod = 'today' | 'month' | 'all'

export async function fetchWebsites() {
  const res = await api.get<Website[]>('/websites')
  return res.data
}

export async function fetchWebsitesSummary(period: SummaryPeriod) {
  const res = await api.get<WebsiteSummary[]>('/websites/summary', { params: { period } })
  return res.data
}

export function faviconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}
