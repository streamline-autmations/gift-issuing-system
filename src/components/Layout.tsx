import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import InstallPrompt from './InstallPrompt'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <InstallPrompt />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </div>
    </div>
  )
}
