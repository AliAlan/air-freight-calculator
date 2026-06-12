import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

// Eager: Login is the first screen, keep it in the main bundle for instant paint.
import Login from './pages/Login'

// Lazy: each page (and its heavy deps like recharts/xlsx) loads only when visited.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Shipments = lazy(() => import('./pages/Shipments'))
const NewShipment = lazy(() => import('./pages/NewShipment'))
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'))
const Reference = lazy(() => import('./pages/Reference'))

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
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
