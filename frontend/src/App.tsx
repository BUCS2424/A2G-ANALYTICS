import { Navigate, Route, Routes } from 'react-router-dom'
import AdminRoute from './auth/AdminRoute'
import ProtectedRoute from './auth/ProtectedRoute'
import AdminShell from './layout/AdminShell'
import AppShell from './layout/AppShell'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboardPage from './pages/admin/AdminDashboard'
import AdminPages from './pages/admin/AdminPages'
import AdminUsers from './pages/admin/AdminUsers'
import AdminWebsites from './pages/admin/AdminWebsites'
import AdvancedSettings from './pages/admin/settings/AdvancedSettings'
import AppearanceSettings from './pages/admin/settings/AppearanceSettings'
import EmailSettings from './pages/admin/settings/EmailSettings'
import GeneralSettings from './pages/admin/settings/GeneralSettings'
import AdminSettingsLayout from './pages/admin/settings/SettingsContext'
import DimensionPage from './pages/stats/DimensionPage'
import Overview from './pages/stats/Overview'
import OverviewIndexRedirect from './pages/stats/OverviewIndexRedirect'
import Realtime from './pages/stats/Realtime'
import StatsLayout from './pages/stats/StatsLayout'
import WebsiteDetail from './pages/WebsiteDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/websites/:id" element={<WebsiteDetail />} />
        <Route path="/stats/:domain" element={<StatsLayout />}>
          <Route index element={<OverviewIndexRedirect />} />
          <Route path="overview" element={<Overview />} />
          <Route path="realtime" element={<Realtime />} />
          <Route path=":dimension" element={<DimensionPage />} />
        </Route>
      </Route>

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="pages" element={<AdminPages />} />
        <Route path="websites" element={<AdminWebsites />} />
        <Route path="settings" element={<AdminSettingsLayout />}>
          <Route index element={<Navigate to="general" replace />} />
          <Route path="general" element={<GeneralSettings />} />
          <Route path="appearance" element={<AppearanceSettings />} />
          <Route path="advanced" element={<AdvancedSettings />} />
          <Route path="email" element={<EmailSettings />} />
        </Route>
      </Route>

      {/* Public share link — no auth, no app shell. Same stats views, gated
          server-side by each website's privacy setting. Exact format:
          https://a2ganalytics.com/{domain} or .../{domain}?from=&to= */}
      <Route path="/:domain" element={<StatsLayout />}>
        <Route index element={<OverviewIndexRedirect />} />
        <Route path="overview" element={<Overview />} />
        <Route path="realtime" element={<Realtime />} />
        <Route path=":dimension" element={<DimensionPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
