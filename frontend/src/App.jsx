import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import ErrorBoundary, { clearChunkReloadFlag } from './components/ErrorBoundary'

// Eager: Login is the first screen, keep it in the main bundle for instant paint.
import Login from './pages/Login'

// lazyRetry: if a dynamic import fails (almost always a stale chunk after a
// new deploy), reload the page ONCE to fetch fresh index.html + chunk hashes.
// The sessionStorage guard prevents an infinite reload loop.
function lazyRetry(factory) {
  return lazy(() =>
    factory().catch((err) => {
      if (!sessionStorage.getItem('afcc_chunk_reloaded')) {
        sessionStorage.setItem('afcc_chunk_reloaded', '1')
        window.location.reload()
        return new Promise(() => {})   // hang until the reload takes over
      }
      throw err                         // already retried once → let ErrorBoundary show fallback
    })
  )
}

// Lazy: each page (and its heavy deps like recharts/xlsx) loads only when visited.
const Dashboard = lazyRetry(() => import('./pages/Dashboard'))
const Shipments = lazyRetry(() => import('./pages/Shipments'))
const NewShipment = lazyRetry(() => import('./pages/NewShipment'))
const ShipmentDetail = lazyRetry(() => import('./pages/ShipmentDetail'))
const Reference = lazyRetry(() => import('./pages/Reference'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </Layout>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/shipments" element={<PrivateRoute><Shipments /></PrivateRoute>} />
      <Route path="/shipments/new" element={<PrivateRoute><NewShipment /></PrivateRoute>} />
      <Route path="/shipments/:id" element={<PrivateRoute><ShipmentDetail /></PrivateRoute>} />
      <Route path="/reference" element={<PrivateRoute><Reference /></PrivateRoute>} />
      <Route path="/rates" element={<PrivateRoute><Reference /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  // App rendered successfully → clear the one-shot reload guard so a FUTURE
  // deploy can trigger its own single recovery reload.
  useEffect(() => { clearChunkReloadFlag() }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
