import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/Layout'

function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  const isLogin = location.pathname === '/login'

  if (!session && !isLogin) return <Navigate to="/login" replace />
  if (session && isLogin) return <Navigate to="/issue" replace />

  if (isLogin) return <Outlet />

  return (
    <Layout />
  )
}

export default App
