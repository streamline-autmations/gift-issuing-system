import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LogOut, LayoutDashboard, Gift, FileBarChart, Shield } from 'lucide-react'

export default function Navbar() {
  const { profile, session, signOut } = useAuth()
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  const navItems = [{ name: 'Issue', path: '/issue', icon: Gift }, { name: 'Reports', path: '/reports', icon: FileBarChart }]

  if (profile?.role === 'superadmin') {
    navItems.unshift({ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard })
    navItems.push({ name: 'Admin', path: '/admin', icon: Shield })
  }

  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="font-bold text-xl">Mining Distribution</span>
            </div>
            <div className="hidden md:ml-6 md:flex md:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon size={18} />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-300 hidden sm:block">
              {session?.user?.email}
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
