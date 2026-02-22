import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  const isLogin = location.pathname === '/login'

  if (!session && !isLogin) return <Navigate to="/login" replace />
  if (session && isLogin) return <Navigate to="/dashboard" replace />

  return <Outlet />
}

export default App
