import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { AuthProvider } from '@/context/AuthContext'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Issue from '@/pages/Issue'
import Reports from '@/pages/Reports'
import Admin from '@/pages/Admin'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/issue', element: <Issue /> },
      { path: '/reports', element: <Reports /> },
      { path: '/admin', element: <Admin /> },
      { path: '/', element: <Navigate to="/issue" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
