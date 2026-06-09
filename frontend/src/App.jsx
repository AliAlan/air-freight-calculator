import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Shipments from './pages/Shipments'
import NewShipment from './pages/NewShipment'
import ShipmentDetail from './pages/ShipmentDetail'
import Reference from './pages/Reference'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
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
