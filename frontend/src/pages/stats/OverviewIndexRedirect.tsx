import { Navigate, useLocation } from 'react-router-dom'

/** Redirects the bare /:domain (or /stats/:domain) index to its overview
 * sub-page, preserving any ?from=&to= query string on the shared public link. */
export default function OverviewIndexRedirect() {
  const location = useLocation()
  return <Navigate to={`overview${location.search}`} replace />
}
