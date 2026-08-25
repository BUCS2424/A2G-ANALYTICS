import { api } from './client'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: number
  has_websites: boolean
  website_pageviews_count: number
  created_at: string | null
  authed_at: string | null
}

export interface AdminWebsite {
  id: string
  domain: string
  user_id: string
  owner_email: string | null
  privacy: number
  created_at: string | null
}

export interface AdminPage {
  id: string
  name: string
  slug: string
  visibility: number
  language: string | null
  content: string
  created_at: string | null
  updated_at: string | null
}

export interface AdminDashboard {
  counts: { users: number; pages: number; websites: number }
  latest_users: AdminUser[]
  latest_websites: AdminWebsite[]
}

export const fetchAdminDashboard = () => api.get<AdminDashboard>('/admin/dashboard').then((r) => r.data)

export const fetchAdminUsers = (search?: string) => api.get<AdminUser[]>('/admin/users', { params: { search } }).then((r) => r.data)
export const createAdminUser = (data: { name: string; email: string; password: string; role: number }) =>
  api.post<AdminUser>('/admin/users', data).then((r) => r.data)
export const updateAdminUser = (id: string, data: Partial<{ name: string; email: string; password: string; role: number }>) =>
  api.patch<AdminUser>(`/admin/users/${id}`, data).then((r) => r.data)
export const deleteAdminUser = (id: string) => api.delete(`/admin/users/${id}`)

export const fetchAdminWebsites = (search?: string) => api.get<AdminWebsite[]>('/admin/websites', { params: { search } }).then((r) => r.data)
export const deleteAdminWebsite = (id: string) => api.delete(`/admin/websites/${id}`)

export const fetchAdminPages = () => api.get<AdminPage[]>('/admin/pages').then((r) => r.data)
export const createAdminPage = (data: { name: string; slug: string; visibility: number; content: string }) =>
  api.post<AdminPage>('/admin/pages', data).then((r) => r.data)
export const updateAdminPage = (id: string, data: Partial<{ name: string; slug: string; visibility: number; content: string }>) =>
  api.patch<AdminPage>(`/admin/pages/${id}`, data).then((r) => r.data)
export const deleteAdminPage = (id: string) => api.delete(`/admin/pages/${id}`)

export const fetchAdminSettings = () => api.get<Record<string, string | null>>('/admin/settings').then((r) => r.data)
export const updateAdminSettings = (data: Record<string, string | null>) =>
  api.patch<Record<string, string | null>>('/admin/settings', data).then((r) => r.data)

export async function uploadAdminAsset(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<{ url: string }>('/admin/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data.url
}
